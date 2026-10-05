import type { ActiveGrantListItem } from './sharing.repository';

/** What the app reads: the professional is named by the gateway, which adds `fullName`. */
export interface GrantDto {
  id: string;
  professionalId: string;
  specialty: string;
  grantedAt: string;
}

export interface InviteDto {
  code: string;
  expiresAt: string;
}

export interface RedeemDto {
  patientId: string;
  grantId: string;
}

export const toGrantDto = (row: ActiveGrantListItem): GrantDto => ({
  id: row.id,
  professionalId: row.professionalId,
  specialty: row.specialty,
  grantedAt: row.grantedAt.toISOString(),
});
