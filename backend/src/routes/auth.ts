import crypto from 'crypto';
import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import nodemailer from 'nodemailer';
import { verifyJwt, AuthRequest } from '../middleware/auth';
import { asyncHandler } from '../middleware/asyncHandler';
import { prisma } from '../lib/prisma';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET ?? 'dev-secret';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function signToken(userId: number): string {
  return jwt.sign({ sub: userId }, JWT_SECRET, { expiresIn: '30d' });
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
    subject: 'Glucore - Recuperação de senha',
    text: `Use o código abaixo para redefinir sua senha:\n\n${token}\n\nEste código expira em 6 horas.`,
  });
}

router.post(
  '/register',
  asyncHandler(async (req: Request, res: Response) => {
    const { email, password } = req.body as { email?: string; password?: string };
    if (!email || !EMAIL_RE.test(email) || !password || password.length < 8) {
      res.status(400).json({ error: 'Invalid input' });
      return;
    }
    const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (existing) {
      res.status(409).json({ error: 'Email already registered' });
      return;
    }
    const passwordHash = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: { email: email.toLowerCase(), passwordHash },
    });
    console.log(`[auth] register success email=${email.toLowerCase()}`);
    res.status(201).json({ token: signToken(user.id) });
  }),
);

router.post(
  '/login',
  asyncHandler(async (req: Request, res: Response) => {
    const { email, password } = req.body as { email?: string; password?: string };
    if (!email || !password) {
      res.status(400).json({ error: 'Invalid input' });
      return;
    }
    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }
    console.log(`[auth] login success email=${email.toLowerCase()}`);
    res.json({ token: signToken(user.id) });
  }),
);

router.get('/status', verifyJwt, (req: AuthRequest, res: Response): void => {
  res.json({ loggedIn: true, userId: req.userId });
});

router.post(
  '/forgot-password',
  asyncHandler(async (req: Request, res: Response) => {
    const { email } = req.body as { email?: string };
    if (!email || !EMAIL_RE.test(email)) {
      res.status(400).json({ error: 'Invalid email' });
      return;
    }
    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    // Always return 200 to not reveal whether email is registered
    if (!user) {
      res.json({ message: 'If the email is registered, instructions were sent.' });
      return;
    }
    await prisma.passwordResetToken.deleteMany({ where: { userId: user.id } });
    const token = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 6 * 60 * 60 * 1000);
    await prisma.passwordResetToken.create({ data: { token, userId: user.id, expiresAt } });
    try {
      await sendPasswordResetEmail(email.toLowerCase(), token);
      console.log(`[auth] forgot-password email sent to ${email.toLowerCase()}`);
    } catch {
      console.log(`[auth] forgot-password SMTP not configured — token=${token} for ${email.toLowerCase()}`);
    }
    res.json({ message: 'If the email is registered, instructions were sent.' });
  }),
);

router.post(
  '/reset-password',
  asyncHandler(async (req: Request, res: Response) => {
    const { token, password } = req.body as { token?: string; password?: string };
    if (!token || !password || password.length < 8) {
      res.status(400).json({ error: 'Invalid input' });
      return;
    }
    const record = await prisma.passwordResetToken.findUnique({ where: { token } });
    if (!record || record.expiresAt < new Date()) {
      res.status(400).json({ error: 'Invalid or expired token' });
      return;
    }
    const passwordHash = await bcrypt.hash(password, 12);
    await prisma.user.update({ where: { id: record.userId }, data: { passwordHash } });
    await prisma.passwordResetToken.delete({ where: { token } });
    console.log(`[auth] password reset success userId=${record.userId}`);
    res.json({ message: 'Password reset successful.' });
  }),
);

router.put(
  '/profile',
  verifyJwt,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { currentPassword, newEmail, newPassword } = req.body as {
      currentPassword?: string;
      newEmail?: string;
      newPassword?: string;
    };
    if (!currentPassword) {
      res.status(400).json({ error: 'Current password required' });
      return;
    }
    const user = await prisma.user.findUnique({ where: { id: req.userId! } });
    if (!user || !(await bcrypt.compare(currentPassword, user.passwordHash))) {
      res.status(401).json({ error: 'Invalid password' });
      return;
    }
    if (newEmail) {
      if (!EMAIL_RE.test(newEmail)) {
        res.status(400).json({ error: 'Invalid email' });
        return;
      }
      const taken = await prisma.user.findFirst({
        where: { email: newEmail.toLowerCase(), NOT: { id: req.userId! } },
      });
      if (taken) {
        res.status(409).json({ error: 'Email already registered' });
        return;
      }
      await prisma.user.update({
        where: { id: req.userId! },
        data: { email: newEmail.toLowerCase() },
      });
      console.log(`[auth] email updated userId=${req.userId}`);
    }
    if (newPassword) {
      if (newPassword.length < 8) {
        res.status(400).json({ error: 'Password too short' });
        return;
      }
      const passwordHash = await bcrypt.hash(newPassword, 12);
      await prisma.user.update({ where: { id: req.userId! }, data: { passwordHash } });
      console.log(`[auth] password updated userId=${req.userId}`);
    }
    res.json({ message: 'Profile updated.' });
  }),
);

export default router;
