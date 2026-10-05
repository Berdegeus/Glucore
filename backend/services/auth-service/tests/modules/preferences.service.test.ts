import { beforeEach, describe, expect, it } from 'vitest';

import { BadRequestError } from '@glucore/shared';

import type { PreferencesRepository } from '../../src/modules/preferences/preferences.repository';
import type { LayoutItem } from '../../src/modules/preferences/preferences.schema';
import { PreferencesService } from '../../src/modules/preferences/preferences.service';

/**
 * LAY-07..09 and LAY-12 at the service, over an in-memory repository: the
 * layout is read, written and reset for the user handed in, never another.
 */

class InMemoryPreferencesRepository implements PreferencesRepository {
  readonly rows = new Map<string, LayoutItem[]>();

  async find(userId: string): Promise<LayoutItem[] | null> {
    return this.rows.get(userId) ?? null;
  }

  async upsert(userId: string, widgets: LayoutItem[]): Promise<LayoutItem[]> {
    this.rows.set(userId, widgets);
    return widgets;
  }

  async delete(userId: string): Promise<void> {
    this.rows.delete(userId);
  }
}

const USER = 'user-a';
const OTHER = 'user-b';
const LAYOUT: LayoutItem[] = [
  { id: 'kpi-tir', size: 'S' },
  { id: 'chart-trend', size: 'L' },
];

let repo: InMemoryPreferencesRepository;
let service: PreferencesService;

beforeEach(() => {
  repo = new InMemoryPreferencesRepository();
  service = new PreferencesService(repo);
});

async function expectInvalidLayout(promise: Promise<unknown>): Promise<void> {
  const error = await promise.then(
    () => undefined,
    (e: unknown) => e,
  );
  expect(error).toBeInstanceOf(BadRequestError);
  expect((error as BadRequestError).code).toBe('INVALID_LAYOUT');
}

describe('PreferencesService.get', () => {
  it('answers { widgets: null } when the user has no layout', async () => {
    expect(await service.get(USER)).toEqual({ widgets: null });
  });

  it('answers the saved layout of that user only', async () => {
    repo.rows.set(OTHER, [{ id: 'kpi-cv', size: 'M' }]);
    repo.rows.set(USER, LAYOUT);
    expect(await service.get(USER)).toEqual({ widgets: LAYOUT });
  });
});

describe('PreferencesService.save', () => {
  it('stores the layout under the user id it receives and returns it', async () => {
    repo.rows.set(OTHER, [{ id: 'kpi-cv', size: 'M' }]);

    const saved = await service.save(USER, 'PATIENT', { userId: OTHER, widgets: LAYOUT });

    expect(saved).toEqual({ widgets: LAYOUT });
    expect(repo.rows.get(USER)).toEqual(LAYOUT);
    expect(repo.rows.get(OTHER)).toEqual([{ id: 'kpi-cv', size: 'M' }]);
    expect(repo.rows.size).toBe(2);
  });

  it('validates against the role it receives', async () => {
    const proLayout: LayoutItem[] = [{ id: 'pro-patients-table', size: 'L' }];
    expect(await service.save(USER, 'HEALTH_PROFESSIONAL', { widgets: proLayout })).toEqual({
      widgets: proLayout,
    });
  });

  it("rejects a widget id from another role's catalog and writes nothing", async () => {
    await expectInvalidLayout(
      service.save(USER, 'HEALTH_PROFESSIONAL', { widgets: [{ id: 'kpi-tir', size: 'M' }] }),
    );
    expect(repo.rows.has(USER)).toBe(false);
  });

  it('keeps the previous layout when the new one is invalid', async () => {
    repo.rows.set(USER, LAYOUT);
    await expectInvalidLayout(
      service.save(USER, 'PATIENT', { widgets: [{ id: 'kpi-tir', size: 'XL' }] }),
    );
    expect(repo.rows.get(USER)).toEqual(LAYOUT);
  });
});

describe('PreferencesService.reset', () => {
  it("deletes the user's layout and leaves the others", async () => {
    repo.rows.set(USER, LAYOUT);
    repo.rows.set(OTHER, LAYOUT);

    await service.reset(USER);

    expect(repo.rows.has(USER)).toBe(false);
    expect(await service.get(USER)).toEqual({ widgets: null });
    expect(repo.rows.get(OTHER)).toEqual(LAYOUT);
  });
});
