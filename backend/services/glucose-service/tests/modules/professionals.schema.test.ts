import { BadRequestError } from '@glucore/shared';
import { describe, expect, it } from 'vitest';

import { parseProfessional } from '../../src/modules/professionals/professionals.schema';

/** REG-05: licenseNumber 1..40 and specialty 1..80 characters, trimmed. */

const VALID = { licenseNumber: 'CRM-SP 123456', specialty: 'Endocrinologia' };

describe('parseProfessional', () => {
  it('returns the two fields of a valid body', () => {
    expect(parseProfessional(VALID)).toEqual(VALID);
  });

  it('trims both fields', () => {
    expect(parseProfessional({ licenseNumber: '  CRM 1  ', specialty: '\tClínica médica\n' })).toEqual({
      licenseNumber: 'CRM 1',
      specialty: 'Clínica médica',
    });
  });

  it('ignores any other field, such as an id or a role', () => {
    expect(parseProfessional({ ...VALID, userId: 'someone-else', role: 'ADMINISTRATOR' })).toEqual(VALID);
  });

  describe.each([
    ['licenseNumber', 40],
    ['specialty', 80],
  ] as const)('%s length boundary', (field, max) => {
    const withField = (value: string) => ({ ...VALID, [field]: value });

    it.each([1, max - 1, max])('accepts %i characters', (length) => {
      expect(parseProfessional(withField('a'.repeat(length)))[field]).toHaveLength(length);
    });

    it(`rejects ${max + 1} characters`, () => {
      expect(() => parseProfessional(withField('a'.repeat(max + 1)))).toThrow(BadRequestError);
    });

    it('counts the length after trimming', () => {
      expect(parseProfessional(withField(` ${'a'.repeat(max)} `))[field]).toHaveLength(max);
    });

    it.each([
      ['empty', ''],
      ['only spaces', '   '],
      ['only a tab and a newline', '\t\n'],
    ])('rejects %s', (_label, value) => {
      expect(() => parseProfessional(withField(value))).toThrow(BadRequestError);
    });

    it.each([
      ['missing', undefined],
      ['null', null],
      ['a number', 123],
      ['an object', { crm: '1' }],
    ])('rejects %s', (_label, value) => {
      expect(() => parseProfessional({ ...VALID, [field]: value })).toThrow(BadRequestError);
    });
  });

  it('answers the generic 400 Invalid input', () => {
    expect(() => parseProfessional({})).toThrow(expect.objectContaining({ status: 400, message: 'Invalid input' }));
  });
});
