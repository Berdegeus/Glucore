import { prisma } from './prisma';

export async function ensurePatient(userId: string): Promise<string> {
  const patient = await prisma.patient.upsert({
    where: { userId },
    update: {},
    create: { userId },
  });
  return patient.userId;
}
