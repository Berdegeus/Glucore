import { describe, expect, it } from 'vitest';

import { querySuffix, withPatientName } from '../../src/modules/professional/patientNames';

/** The initials shown when a name is long, short, accented or unknown (PRO-15). */

const ID = 'c7000000-0000-4000-8000-000000000001';
const initialsOf = (fullName: string | undefined) =>
  withPatientName({ patientId: ID }, new Map(fullName === undefined ? [] : [[ID, fullName]])).initials;

describe('withPatientName initials', () => {
  it.each([
    ['Maria da Silva', 'MS'],
    ['João Pedro', 'JP'],
    ['  ana   souza  ', 'AS'],
    ['Maria', 'MA'],
    ['X', 'X'],
    ['Álvaro Ñandú', 'ÁÑ'],
  ])('derives %j as %s', (fullName, initials) => {
    expect(initialsOf(fullName)).toBe(initials);
  });

  it('falls back to P and the first two characters of the id, uppercased, with a null name', () => {
    const entry = withPatientName({ patientId: ID, hypoEpisodes: 1 }, new Map());

    expect(entry).toEqual({ patientId: ID, hypoEpisodes: 1, fullName: null, initials: 'PC7' });
  });
});

describe('querySuffix', () => {
  it.each([
    ['/api/v1/professional/patients', ''],
    ['/api/v1/professional/patients?days=7&page=2', '?days=7&page=2'],
    ['/api/v1/professional/cohort/summary?tz=America%2FSao_Paulo', '?tz=America%2FSao_Paulo'],
  ])('%s gives %j', (originalUrl, suffix) => {
    expect(querySuffix({ originalUrl } as never)).toBe(suffix);
  });
});
