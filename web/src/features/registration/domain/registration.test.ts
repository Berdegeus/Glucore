import { describe, expect, it } from 'vitest';
import {
  checkRegistration,
  normalizeRegistration,
  type ProfessionalRegistration,
  type RegistrationProblem,
} from './registration';

const VALID: ProfessionalRegistration = {
  fullName: 'Ana Souza',
  email: 'ana@clinica.com',
  password: 'Senha123!',
  licenseNumber: 'CRM-SP 123456',
  specialty: 'Endocrinologia',
};

const check = (patch: Partial<ProfessionalRegistration>) => checkRegistration({ ...VALID, ...patch });

describe('checkRegistration (REG-02, REG-05)', () => {
  it('accepts a complete registration', () => {
    expect(check({})).toBeNull();
  });

  it.each<[string, Partial<ProfessionalRegistration>, RegistrationProblem | null]>([
    ['registration number of 40 characters', { licenseNumber: 'A'.repeat(40) }, null],
    ['registration number of 41 characters', { licenseNumber: 'A'.repeat(41) }, 'INVALID_LICENSE_NUMBER'],
    ['empty registration number', { licenseNumber: '' }, 'INVALID_LICENSE_NUMBER'],
    ['specialty of 80 characters', { specialty: 'E'.repeat(80) }, null],
    ['specialty of 81 characters', { specialty: 'E'.repeat(81) }, 'INVALID_SPECIALTY'],
    ['empty specialty', { specialty: '' }, 'INVALID_SPECIALTY'],
    ['full name of 3 characters', { fullName: 'Ana' }, null],
    ['full name of 2 characters', { fullName: 'An' }, 'INVALID_FULL_NAME'],
    ['e-mail without a domain dot', { email: 'ana@clinica' }, 'INVALID_EMAIL'],
    ['e-mail with a space', { email: 'ana @clinica.com' }, 'INVALID_EMAIL'],
    ['password of 7 characters', { password: 'Senha1!' }, 'WEAK_PASSWORD'],
    ['password of 8 characters', { password: 'Senha12!' }, null],
  ])('%s', (_label, patch, expected) => {
    expect(check(patch)).toBe(expected);
  });
});

describe('normalizeRegistration', () => {
  it('trims every field but the password and keeps the password as typed', () => {
    const normalized = normalizeRegistration({
      fullName: '  Ana Souza ',
      email: ' ana@clinica.com ',
      password: ' Senha123! ',
      licenseNumber: ' 123 ',
      specialty: ' Endocrinologia ',
    });

    expect(normalized).toEqual({
      fullName: 'Ana Souza',
      email: 'ana@clinica.com',
      password: ' Senha123! ',
      licenseNumber: '123',
      specialty: 'Endocrinologia',
    });
  });

  it.each([undefined, '', '   '])('leaves the phone out when it is %j', (phone) => {
    expect(normalizeRegistration({ ...VALID, phone })).not.toHaveProperty('phone');
  });

  it('keeps a typed phone, trimmed', () => {
    expect(normalizeRegistration({ ...VALID, phone: ' +55 11 99999-0000 ' }).phone).toBe('+55 11 99999-0000');
  });
});
