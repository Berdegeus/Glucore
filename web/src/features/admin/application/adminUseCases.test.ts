import { describe, expect, it, vi } from 'vitest';
import { AppError } from '../../../shared/domain/appError';
import { accountPageOf, overviewOf } from '../../../test/adminFakes';
import { createAdminUseCases } from './adminUseCases';

function setup() {
  const admin = {
    overview: vi.fn().mockResolvedValue(overviewOf()),
    users: vi.fn().mockResolvedValue(accountPageOf()),
  };
  return { useCases: createAdminUseCases({ admin }), admin };
}

const validation = (code: string) => expect.objectContaining({ kind: 'validation', code });

describe('loadOverview (ADM-01, ADM-07)', () => {
  it.each([7, 30, 90])('asks the repository for %i days', async (days) => {
    const { useCases, admin } = setup();

    expect(await useCases.loadOverview(days)).toEqual(overviewOf());
    expect(admin.overview).toHaveBeenCalledWith(days);
  });

  it.each([0, 6, 8, 14, 29, 31, 89, 91, 365, -7, 7.5, Number.NaN])('refuses %s days without calling the repository', async (days) => {
    const { useCases, admin } = setup();

    await expect(useCases.loadOverview(days)).rejects.toEqual(validation('INVALID_DASHBOARD_RANGE'));
    expect(admin.overview).not.toHaveBeenCalled();
  });

  it('lets the repository error through unchanged', async () => {
    const { useCases, admin } = setup();
    const failure = new AppError('forbidden', { code: 'FORBIDDEN_ROLE' });
    admin.overview.mockRejectedValue(failure);

    await expect(useCases.loadOverview(30)).rejects.toBe(failure);
  });
});

describe('loadUsers (ADM-04)', () => {
  it('asks for the first page of 25 when no page is given', async () => {
    const { useCases, admin } = setup();

    expect(await useCases.loadUsers()).toEqual(accountPageOf());
    expect(admin.users).toHaveBeenCalledWith({ page: 1, limit: 25 });
  });

  it('passes the role, status and search on as given', async () => {
    const { useCases, admin } = setup();

    await useCases.loadUsers({ role: 'HEALTH_PROFESSIONAL', status: 'BLOCKED', q: 'ana', page: 3 });

    expect(admin.users).toHaveBeenCalledWith({ role: 'HEALTH_PROFESSIONAL', status: 'BLOCKED', q: 'ana', page: 3, limit: 25 });
  });

  it.each([
    [1, 100, true],
    [2, 1, true],
    [0, 25, false],
    [1, 0, false],
    [1, 101, false],
    [1.5, 25, false],
    [1, 2.5, false],
  ])('page %s with limit %s is accepted: %s', async (page, limit, accepted) => {
    const { useCases, admin } = setup();

    const result = useCases.loadUsers({ page, limit });

    if (accepted) await expect(result).resolves.toBeDefined();
    else await expect(result).rejects.toEqual(validation('INVALID_PAGINATION'));
    expect(admin.users).toHaveBeenCalledTimes(accepted ? 1 : 0);
  });
});
