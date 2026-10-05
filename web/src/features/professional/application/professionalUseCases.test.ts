import { describe, expect, it, vi } from 'vitest';
import { AppError } from '../../../shared/domain/appError';
import { cohortSummaryOf, patientPageOf } from '../../../test/professionalFakes';
import { createProfessionalUseCases, normalizeInviteCode } from './professionalUseCases';

const LINK = { patientId: 'p1', grantId: 'g1' };

function setup(zone = 'America/Sao_Paulo') {
  const professionals = {
    listPatients: vi.fn().mockResolvedValue(patientPageOf()),
    cohort: vi.fn().mockResolvedValue(cohortSummaryOf()),
  };
  const redemptions = { redeem: vi.fn().mockResolvedValue(LINK) };
  const useCases = createProfessionalUseCases({ professionals, redemptions, timeZone: { timeZone: () => zone } });
  return { useCases, professionals, redemptions };
}

const validation = (code: string) => expect.objectContaining({ kind: 'validation', code });

describe('loadPatients (PRO-02, PRO-05)', () => {
  it('asks for the period in the browser zone, with the default first page of 50', async () => {
    const { useCases, professionals } = setup();

    const page = await useCases.loadPatients({ days: 30 });

    expect(page).toEqual(patientPageOf());
    expect(professionals.listPatients).toHaveBeenCalledWith({ days: 30, page: 1, limit: 50, timeZone: 'America/Sao_Paulo' });
  });

  it.each([7, 14, 30, 90])('accepts a period of %i days', async (days) => {
    const { useCases, professionals } = setup();
    await useCases.loadPatients({ days });
    expect(professionals.listPatients).toHaveBeenCalledWith(expect.objectContaining({ days }));
  });

  it.each([0, 6, 8, 15, 91, 365, -7, 7.5, Number.NaN])('refuses a period of %s days without calling the repository', async (days) => {
    const { useCases, professionals } = setup();

    await expect(useCases.loadPatients({ days })).rejects.toEqual(validation('INVALID_PERIOD'));
    await expect(useCases.loadCohort({ days })).rejects.toEqual(validation('INVALID_PERIOD'));
    expect(professionals.listPatients).not.toHaveBeenCalled();
    expect(professionals.cohort).not.toHaveBeenCalled();
  });

  it.each([
    [1, 200, true],
    [3, 1, true],
    [0, 50, false],
    [1, 0, false],
    [1, 201, false],
    [1.5, 50, false],
    [1, 10.5, false],
  ])('page %s with limit %s is accepted: %s', async (page, limit, accepted) => {
    const { useCases, professionals } = setup();

    const result = useCases.loadPatients({ days: 14, page, limit });

    if (accepted) await expect(result).resolves.toBeDefined();
    else await expect(result).rejects.toEqual(validation('INVALID_PAGINATION'));
    expect(professionals.listPatients).toHaveBeenCalledTimes(accepted ? 1 : 0);
  });

  it('reads the zone at each call and lets the repository error through unchanged', async () => {
    const professionals = { listPatients: vi.fn(), cohort: vi.fn() };
    const failure = new AppError('forbidden', { code: 'NO_ACTIVE_GRANT' });
    professionals.listPatients.mockRejectedValueOnce(failure).mockResolvedValue(patientPageOf());
    let zone = 'America/Sao_Paulo';
    const useCases = createProfessionalUseCases({
      professionals,
      redemptions: { redeem: vi.fn() },
      timeZone: { timeZone: () => zone },
    });

    await expect(useCases.loadPatients({ days: 7 })).rejects.toBe(failure);
    zone = 'Europe/Lisbon';
    await useCases.loadPatients({ days: 7 });

    expect(professionals.listPatients.mock.calls.map(([query]) => query.timeZone)).toEqual(['America/Sao_Paulo', 'Europe/Lisbon']);
  });
});

describe('loadCohort (PRO-05)', () => {
  it('asks for the period in the browser zone', async () => {
    const { useCases, professionals } = setup('UTC');

    expect(await useCases.loadCohort({ days: 90 })).toEqual(cohortSummaryOf());
    expect(professionals.cohort).toHaveBeenCalledWith({ days: 90, timeZone: 'UTC' });
  });
});

describe('redeemInvite (CON-04)', () => {
  it.each([
    [' ab12 cd34 ', 'AB12CD34'],
    ['ab12-cd34', 'AB12CD34'],
    ['\tab 12\n-cd-34 ', 'AB12CD34'],
    ['AB12CD34', 'AB12CD34'],
  ])('sends %j as %s', async (typed, sent) => {
    const { useCases, redemptions } = setup();

    expect(await useCases.redeemInvite(typed)).toEqual(LINK);
    expect(redemptions.redeem).toHaveBeenCalledWith(sent);
  });

  it.each(['', '   ', ' - - '])('refuses the empty code %j without a request, with the code of a bad invite', async (typed) => {
    const { useCases, redemptions } = setup();

    await expect(useCases.redeemInvite(typed)).rejects.toEqual(validation('INVALID_INVITE'));
    expect(redemptions.redeem).not.toHaveBeenCalled();
  });

  it('lets the repository error through unchanged', async () => {
    const { useCases, redemptions } = setup();
    const failure = new AppError('validation', { code: 'INVALID_INVITE' });
    redemptions.redeem.mockRejectedValue(failure);

    await expect(useCases.redeemInvite('AB12CD34')).rejects.toBe(failure);
  });

  it('normalizes a code the same way for any caller', () => {
    expect(normalizeInviteCode(' ab12 cd34 ')).toBe('AB12CD34');
  });
});
