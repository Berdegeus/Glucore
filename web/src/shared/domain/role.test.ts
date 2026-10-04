import { describe, expect, it } from 'vitest';
import { homePathFor, isRole, ROLES } from './role';

describe('Role', () => {
  it('mirrors the backend UserRole enum', () => {
    expect([...ROLES]).toEqual(['PATIENT', 'HEALTH_PROFESSIONAL', 'ADMINISTRATOR']);
  });
});

describe('homePathFor (ACC-02)', () => {
  it.each([
    ['PATIENT', '/paciente'],
    ['HEALTH_PROFESSIONAL', '/profissional'],
    ['ADMINISTRATOR', '/admin'],
  ] as const)('opens %s at %s', (role, path) => {
    expect(homePathFor(role)).toBe(path);
  });
});

describe('isRole', () => {
  it.each(['PATIENT', 'HEALTH_PROFESSIONAL', 'ADMINISTRATOR'])('accepts %s', (value) => {
    expect(isRole(value)).toBe(true);
  });

  it.each([
    ['an unknown role', 'SUPERUSER'],
    ['a lower-case role', 'patient'],
    ['an empty string', ''],
    ['a number', 1],
    ['null', null],
    ['undefined', undefined],
  ])('rejects %s', (_label, value) => {
    expect(isRole(value)).toBe(false);
  });
});
