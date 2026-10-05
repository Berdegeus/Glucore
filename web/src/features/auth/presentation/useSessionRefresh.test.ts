import { act, fireEvent, screen } from '@testing-library/react';
import { createElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppError } from '../../../shared/domain/appError';
import type { Role } from '../../../shared/domain/role';
import { makeAuthServices, sessionOf } from '../../../test/authServices';
import type { RefreshSession } from '../application/refreshSession';
import { renderWithAuth } from '../../../test/renderWithAuth';
import { useAuth } from './authProvider';
import { useSessionRefresh } from './useSessionRefresh';

const T0 = new Date('2026-05-03T12:00:00.000Z');
const SECOND = 1000;
const MINUTE = 60 * SECOND;

function Probe() {
  useSessionRefresh();
  const { logout } = useAuth();
  return createElement('button', { onClick: logout }, 'sair');
}

/** Mounts the hook with a person of `role` whose token ends `msLeft` after T0. */
async function mount(role: Role, msLeft: number, refreshImpl?: RefreshSession) {
  const session = sessionOf(role, 'Ana', new Date(T0.getTime() + msLeft));
  const made = makeAuthServices({ restoreSession: vi.fn().mockResolvedValue(session) });
  const renewed = sessionOf(role, 'Ana', new Date(T0.getTime() + 40 * MINUTE));
  const refresh = vi.fn<RefreshSession>(refreshImpl ?? (async () => renewed));
  made.services.refreshSession = refresh;
  const view = renderWithAuth(createElement(Probe), { services: made.services });
  await elapse(0);
  return { ...made, ...view, session, refresh };
}

const elapse = (ms: number) => act(async () => void (await vi.advanceTimersByTimeAsync(ms)));
const activity = (type: 'pointerDown' | 'pointerMove' | 'keyDown' = 'pointerDown') => act(() => void fireEvent[type](window));

describe('useSessionRefresh (ACC-10)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(T0);
  });
  afterEach(() => vi.useRealTimers());

  it('renews at 4:59 before the end, with activity, and not at 5:00', async () => {
    const { refresh, session } = await mount('HEALTH_PROFESSIONAL', 10 * MINUTE);
    await elapse(MINUTE);
    await activity();
    await elapse(4 * MINUTE);
    expect(refresh).not.toHaveBeenCalled();

    await elapse(SECOND);
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(refresh).toHaveBeenCalledWith({ session, hadRecentActivity: true });
  });

  it.each(['pointerDown', 'pointerMove', 'keyDown'] as const)('counts %s as activity', async (type) => {
    const { refresh } = await mount('ADMINISTRATOR', 10 * MINUTE);
    await elapse(MINUTE);
    await activity(type);
    await elapse(4 * MINUTE + SECOND);
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('does not renew without activity in the last 5 minutes, up to the end of the token', async () => {
    const { refresh } = await mount('HEALTH_PROFESSIONAL', 10 * MINUTE);
    await elapse(10 * MINUTE);
    expect(refresh).not.toHaveBeenCalled();
  });

  it('renews at once on activity after the window opened while idle', async () => {
    const { refresh } = await mount('HEALTH_PROFESSIONAL', 10 * MINUTE);
    await elapse(7 * MINUTE);
    expect(refresh).not.toHaveBeenCalled();

    await activity('keyDown');
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('never schedules for a patient', async () => {
    const { refresh } = await mount('PATIENT', MINUTE);
    expect(vi.getTimerCount()).toBe(0);
    await activity();
    await elapse(2 * MINUTE);
    await activity();
    expect(refresh).not.toHaveBeenCalled();
  });

  it('schedules the next renewal from the new expiry', async () => {
    const { refresh } = await mount('HEALTH_PROFESSIONAL', 10 * MINUTE);
    await elapse(MINUTE);
    await activity();
    await elapse(4 * MINUTE + SECOND);
    expect(refresh).toHaveBeenCalledTimes(1);

    // The renewed token ends at T0 + 40 min, so its window opens at 35:01.
    await elapse(29 * MINUTE);
    await activity();
    await elapse(MINUTE - SECOND);
    expect(refresh).toHaveBeenCalledTimes(1);
    await elapse(SECOND);
    expect(refresh).toHaveBeenCalledTimes(2);
  });

  it('survives a failed renewal and tries again on activity after 30 seconds', async () => {
    const { refresh } = await mount('HEALTH_PROFESSIONAL', 10 * MINUTE, async () => {
      throw new AppError('unavailable');
    });
    await elapse(MINUTE);
    await activity();
    await elapse(4 * MINUTE + SECOND);
    expect(refresh).toHaveBeenCalledTimes(1);

    await elapse(10 * SECOND);
    await activity();
    expect(refresh).toHaveBeenCalledTimes(1);
    await elapse(21 * SECOND);
    await activity();
    expect(refresh).toHaveBeenCalledTimes(2);
  });

  it('stops listening and scheduling when it unmounts', async () => {
    const { refresh, unmount } = await mount('HEALTH_PROFESSIONAL', 10 * MINUTE);
    await elapse(MINUTE);
    await activity();
    unmount();
    await elapse(10 * MINUTE);
    await activity();
    expect(refresh).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('leaves no token behind when the person signs out while a renewal is in flight', async () => {
    let finish: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => (finish = resolve));
    const { tokenStore, logout } = await mount('HEALTH_PROFESSIONAL', 10 * MINUTE, async () => {
      await gate;
      tokenStore.save('token-from-the-late-renewal');
      return sessionOf('HEALTH_PROFESSIONAL', 'Ana', new Date(T0.getTime() + 40 * MINUTE));
    });
    await elapse(MINUTE);
    await activity();
    await elapse(4 * MINUTE + SECOND);

    act(() => screen.getByRole('button', { name: 'sair' }).click());
    expect(tokenStore.read()).toBeNull();
    await act(async () => finish());

    expect(tokenStore.read()).toBeNull();
    expect(logout).toHaveBeenCalledTimes(2);
  });
});
