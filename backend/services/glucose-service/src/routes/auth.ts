import crypto from 'crypto';
import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import nodemailer from 'nodemailer';
import rateLimit from 'express-rate-limit';
import { Prisma } from '@prisma/client';
import { verifyJwt, AuthRequest } from '../middleware/auth';
import { asyncHandler, optionalText } from '@glucore/shared';
import { prisma } from '../lib/prisma';
import {
  DEFAULT_TARGET_MAX,
  DEFAULT_TARGET_MIN,
  toProfileDto,
} from '../modules/patient/patient.mapper';
import {
  parseOptionalDate,
  parseOptionalInt,
  parseOptionalNumber,
} from '../modules/patient/patient.parsers';
import { getJwtSecret } from '../lib/env';
import { assertStrongPassword } from '../lib/passwordPolicy';
import { auditRequestContext, recordAudit } from '../lib/audit';

const router = Router();
const TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Every supertest request arrives from the same loopback address, so the shared
// per-IP counter would exhaust itself a few cases into the suite and turn the
// rest into 429s. Keyed off NODE_ENV rather than a dedicated variable so no
// deployment can accidentally switch the limiter off.
//
// The limiters move to the gateway in phase 4; the 429 behaviour is covered
// there, where the counter is per-client again.
const rateLimitingDisabled = (): boolean => process.env.NODE_ENV === 'test';

// bcrypt is intentionally slow, which costs ~300 ms per password in the test
// suite and dominates its runtime. Tests do not assert on the work factor, only
// that hashing round-trips, so they run at the library minimum. Keyed off
// NODE_ENV for the same reason as the limiter above: a deployment cannot weaken
// it by setting a variable.
const BCRYPT_ROUNDS = process.env.NODE_ENV === 'test' ? 4 : 12;

// Strict limiter for credential-sensitive endpoints (login, password reset flows).
const strictAuthLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skip: rateLimitingDisabled,
});

// Looser limiter for account creation.
const registerLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  skip: rateLimitingDisabled,
});

type RegisterBody = {
  fullName?: string;
  email?: string;
  password?: string;
  phone?: string;
  birthDate?: string | null;
  diabetesType?: string | null;
  weightKg?: number | string | null;
  targetRangeMin?: number | string;
  targetRangeMax?: number | string;
};

type ProfileBody = {
  currentPassword?: string;
  newEmail?: string;
  newPassword?: string;
  fullName?: string;
  phone?: string | null;
  birthDate?: string | null;
  diabetesType?: string | null;
  weightKg?: number | string | null;
  targetRangeMin?: number | string;
  targetRangeMax?: number | string;
};

function signToken(userId: string): string {
  return jwt.sign({ sub: userId }, getJwtSecret(), { expiresIn: '30d' });
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

async function sendPasswordResetEmail(email: string, token: string): Promise<void> {
  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT ?? '587');
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) throw new Error('SMTP not configured');

  const transporter = nodemailer.createTransport({ host, port, auth: { user, pass } });
  await transporter.sendMail({
    from: user,
    to: email,
    subject: 'Glucore - Recuperacao de senha',
    text: `Use o codigo abaixo para redefinir sua senha:\n\n${token}\n\nEste codigo expira em 6 horas.`,
  });
}

router.post(
  '/register',
  registerLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const body = req.body as RegisterBody;
    const email = body.email == null ? undefined : normalizeEmail(body.email);
    const fullName = body.fullName?.trim();
    const targetRangeMin = parseOptionalInt(body.targetRangeMin) ?? DEFAULT_TARGET_MIN;
    const targetRangeMax = parseOptionalInt(body.targetRangeMax) ?? DEFAULT_TARGET_MAX;
    const birthDate = parseOptionalDate(body.birthDate);
    const weightKg = parseOptionalNumber(body.weightKg);

    if (
      !email ||
      !EMAIL_RE.test(email) ||
      !body.password ||
      !fullName ||
      fullName.length < 3 ||
      targetRangeMin >= targetRangeMax ||
      (body.birthDate !== undefined && birthDate === undefined) ||
      (body.weightKg !== undefined && weightKg === undefined) ||
      (typeof weightKg === 'number' && weightKg <= 0)
    ) {
      res.status(400).json({ error: 'Invalid input' });
      return;
    }

    // Throws WeakPasswordError; prismaErrorHandler answers 400 WEAK_PASSWORD.
    assertStrongPassword(body.password);

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      res.status(409).json({ error: 'Email already registered', code: 'EMAIL_TAKEN' });
      return;
    }

    const passwordHash = await bcrypt.hash(body.password, BCRYPT_ROUNDS);
    const diabetesType = optionalText(body.diabetesType);
    const phone = optionalText(body.phone);

    const user = await prisma.user.create({
      data: {
        email,
        fullName,
        phone,
        role: 'PATIENT',
        authCredential: { create: { passwordHash } },
        patient: {
          create: {
            birthDate,
            diabetesType,
            weightKg,
            targetRangeMin,
            targetRangeMax,
            alertThresholdConfig: {
              create: {
                lowGlucoseMgDl: targetRangeMin,
                highGlucoseMgDl: targetRangeMax,
              },
            },
          },
        },
      },
    });

    await prisma.authSession.create({
      data: {
        userId: user.id,
        expiresAt: new Date(Date.now() + TOKEN_TTL_MS),
        userAgent: req.get('user-agent'),
      },
    });

    console.log(`[auth] register success email=${email}`);
    await recordAudit({
      userId: user.id,
      entity: 'User',
      action: 'REGISTER',
      entityId: user.id,
      metadata: { email },
      ...auditRequestContext(req),
    });
    res.status(201).json({ token: signToken(user.id) });
  }),
);

router.post(
  '/login',
  strictAuthLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const { email, password } = req.body as { email?: string; password?: string };
    if (!email || !password) {
      res.status(400).json({ error: 'Invalid input' });
      return;
    }
    const normalizedEmail = normalizeEmail(email);
    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      include: { authCredential: true },
    });
    if (!user?.authCredential || !(await bcrypt.compare(password, user.authCredential.passwordHash))) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    await prisma.$transaction([
      prisma.authCredential.update({
        where: { userId: user.id },
        data: { lastLoginAt: new Date() },
      }),
      prisma.authSession.create({
        data: {
          userId: user.id,
          expiresAt: new Date(Date.now() + TOKEN_TTL_MS),
          userAgent: req.get('user-agent'),
        },
      }),
    ]);

    console.log(`[auth] login success email=${normalizedEmail}`);
    await recordAudit({
      userId: user.id,
      entity: 'User',
      action: 'LOGIN',
      entityId: user.id,
      ...auditRequestContext(req),
    });
    res.json({ token: signToken(user.id) });
  }),
);

router.get('/status', verifyJwt, (req: AuthRequest, res: Response): void => {
  res.json({ loggedIn: true, userId: req.userId });
});

router.get(
  '/profile',
  verifyJwt,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const user = await prisma.user.findUnique({
      where: { id: req.userId! },
      include: { patient: true },
    });
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    res.json(toProfileDto(user));
  }),
);

router.post(
  '/forgot-password',
  strictAuthLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const { email } = req.body as { email?: string };
    if (!email || !EMAIL_RE.test(email)) {
      res.status(400).json({ error: 'Invalid email' });
      return;
    }
    const normalizedEmail = normalizeEmail(email);
    const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    // Always return 200 to not reveal whether email is registered
    if (!user) {
      res.json({ message: 'If the email is registered, instructions were sent.' });
      return;
    }
    await prisma.passwordResetToken.deleteMany({
      where: { userId: user.id, usedAt: null },
    });
    const token = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 6 * 60 * 60 * 1000);
    await prisma.passwordResetToken.create({ data: { token, userId: user.id, expiresAt } });
    try {
      await sendPasswordResetEmail(normalizedEmail, token);
      console.log(`[auth] forgot-password email sent to ${normalizedEmail}`);
    } catch {
      console.log(`[auth] forgot-password SMTP not configured - token=${token} for ${normalizedEmail}`);
    }
    // Recorded only for an existing account: the response is identical either
    // way, and a row for an unknown address would turn the trail into an
    // account-enumeration list. The reset token is never part of metadata.
    await recordAudit({
      userId: user.id,
      entity: 'User',
      action: 'FORGOT_PASSWORD',
      entityId: user.id,
      ...auditRequestContext(req),
    });
    res.json({ message: 'If the email is registered, instructions were sent.' });
  }),
);

router.post(
  '/reset-password',
  strictAuthLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const { token, password } = req.body as { token?: string; password?: string };
    if (!token || !password) {
      res.status(400).json({ error: 'Invalid input' });
      return;
    }
    assertStrongPassword(password);
    const record = await prisma.passwordResetToken.findUnique({ where: { token } });
    if (!record || record.usedAt || record.expiresAt < new Date()) {
      res.status(400).json({ error: 'Invalid or expired token' });
      return;
    }
    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    await prisma.$transaction([
      prisma.authCredential.upsert({
        where: { userId: record.userId },
        update: { passwordHash },
        create: { userId: record.userId, passwordHash },
      }),
      prisma.passwordResetToken.update({
        where: { token },
        data: { usedAt: new Date() },
      }),
    ]);
    console.log(`[auth] password reset success userId=${record.userId}`);
    await recordAudit({
      userId: record.userId,
      entity: 'User',
      action: 'RESET_PASSWORD',
      entityId: record.userId,
      ...auditRequestContext(req),
    });
    res.json({ message: 'Password reset successful.' });
  }),
);

router.put(
  '/profile',
  verifyJwt,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const body = req.body as ProfileBody;
    const updatesEmail = body.newEmail !== undefined && body.newEmail.trim().length > 0;
    const updatesPassword = body.newPassword !== undefined && body.newPassword.length > 0;

    const user = await prisma.user.findUnique({
      where: { id: req.userId! },
      include: { authCredential: true, patient: true },
    });
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    if (updatesEmail || updatesPassword) {
      if (!body.currentPassword) {
        res.status(400).json({ error: 'Current password required' });
        return;
      }
      if (
        !user.authCredential ||
        !(await bcrypt.compare(body.currentPassword, user.authCredential.passwordHash))
      ) {
        // Distinct from TOKEN_INVALID: the session stays valid, only the
        // supplied current password is wrong, so the app must not log out.
        res.status(401).json({ error: 'Invalid password', code: 'INVALID_CURRENT_PASSWORD' });
        return;
      }
    }

    const userData: { email?: string; fullName?: string; phone?: string | null } = {};
    const patientData: {
      birthDate?: Date | null;
      diabetesType?: string | null;
      weightKg?: number | null;
      targetRangeMin?: number;
      targetRangeMax?: number;
    } = {};

    if (body.fullName !== undefined) {
      const fullName = body.fullName.trim();
      if (fullName.length < 3) {
        res.status(400).json({ error: 'Invalid input' });
        return;
      }
      userData.fullName = fullName;
    }

    const phone = optionalText(body.phone);
    if (phone !== undefined) userData.phone = phone;

    if (updatesEmail) {
      const newEmail = normalizeEmail(body.newEmail!);
      if (!EMAIL_RE.test(newEmail)) {
        res.status(400).json({ error: 'Invalid email' });
        return;
      }
      const taken = await prisma.user.findFirst({
        where: { email: newEmail, NOT: { id: req.userId! } },
      });
      if (taken) {
        res.status(409).json({ error: 'Email already registered', code: 'EMAIL_TAKEN' });
        return;
      }
      userData.email = newEmail;
    }

    if (body.birthDate !== undefined) {
      const birthDate = parseOptionalDate(body.birthDate);
      if (birthDate === undefined) {
        res.status(400).json({ error: 'Invalid input' });
        return;
      }
      patientData.birthDate = birthDate;
    }

    const diabetesType = optionalText(body.diabetesType);
    if (diabetesType !== undefined) patientData.diabetesType = diabetesType;

    if (body.weightKg !== undefined) {
      const weightKg = parseOptionalNumber(body.weightKg);
      if (weightKg === undefined || (typeof weightKg === 'number' && weightKg <= 0)) {
        res.status(400).json({ error: 'Invalid input' });
        return;
      }
      patientData.weightKg = weightKg;
    }

    if (body.targetRangeMin !== undefined) {
      const targetRangeMin = parseOptionalInt(body.targetRangeMin);
      if (targetRangeMin === undefined) {
        res.status(400).json({ error: 'Invalid input' });
        return;
      }
      patientData.targetRangeMin = targetRangeMin;
    }

    if (body.targetRangeMax !== undefined) {
      const targetRangeMax = parseOptionalInt(body.targetRangeMax);
      if (targetRangeMax === undefined) {
        res.status(400).json({ error: 'Invalid input' });
        return;
      }
      patientData.targetRangeMax = targetRangeMax;
    }

    const nextTargetRangeMin =
      patientData.targetRangeMin ?? user.patient?.targetRangeMin ?? DEFAULT_TARGET_MIN;
    const nextTargetRangeMax =
      patientData.targetRangeMax ?? user.patient?.targetRangeMax ?? DEFAULT_TARGET_MAX;
    if (nextTargetRangeMin >= nextTargetRangeMax) {
      res.status(400).json({ error: 'Invalid input' });
      return;
    }

    const operations: Prisma.PrismaPromise<unknown>[] = [];
    if (Object.keys(userData).length > 0) {
      operations.push(prisma.user.update({ where: { id: req.userId! }, data: userData }));
    }

    if (Object.keys(patientData).length > 0) {
      operations.push(
        prisma.patient.upsert({
          where: { userId: req.userId! },
          update: patientData,
          create: {
            userId: req.userId!,
            targetRangeMin: nextTargetRangeMin,
            targetRangeMax: nextTargetRangeMax,
            ...patientData,
          },
        }),
      );
    }

    if (patientData.targetRangeMin !== undefined || patientData.targetRangeMax !== undefined) {
      operations.push(
        prisma.alertThresholdConfig.upsert({
          where: { patientId: req.userId! },
          update: {
            lowGlucoseMgDl: nextTargetRangeMin,
            highGlucoseMgDl: nextTargetRangeMax,
          },
          create: {
            patientId: req.userId!,
            lowGlucoseMgDl: nextTargetRangeMin,
            highGlucoseMgDl: nextTargetRangeMax,
          },
        }),
      );
    }

    if (updatesPassword) {
      const newPassword = body.newPassword as string;
      assertStrongPassword(newPassword);
      const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
      operations.push(
        prisma.authCredential.upsert({
          where: { userId: req.userId! },
          update: { passwordHash },
          create: { userId: req.userId!, passwordHash },
        }),
      );
    }

    if (operations.length > 0) {
      await prisma.$transaction(operations);
    }

    // Only the names of the changed areas, never the values.
    const changed = [
      ...Object.keys(userData),
      ...Object.keys(patientData),
      ...(updatesPassword ? ['password'] : []),
    ];
    await recordAudit({
      userId: req.userId,
      entity: 'User',
      action: 'UPDATE_PROFILE',
      entityId: req.userId,
      metadata: { changed },
      ...auditRequestContext(req),
    });

    res.json({ message: 'Profile updated.' });
  }),
);

export default router;
