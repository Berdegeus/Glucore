import { describe, expect, it, vi } from 'vitest';
import { SessionEventBus } from './sessionEventBus';

describe('SessionEventBus (ACC-09)', () => {
  it('notifies a subscriber once however many times expiry is emitted', () => {
    const bus = new SessionEventBus();
    const listener = vi.fn();
    bus.subscribe(listener);

    bus.emitExpired();
    bus.emitExpired();
    bus.emitExpired();

    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('notifies every subscriber of the same expiry', () => {
    const bus = new SessionEventBus();
    const first = vi.fn();
    const second = vi.fn();
    bus.subscribe(first);
    bus.subscribe(second);

    bus.emitExpired();
    bus.emitExpired();

    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);
  });

  it('notifies again after reset', () => {
    const bus = new SessionEventBus();
    const listener = vi.fn();
    bus.subscribe(listener);

    bus.emitExpired();
    bus.reset();
    bus.emitExpired();
    bus.emitExpired();

    expect(listener).toHaveBeenCalledTimes(2);
  });

  it('stops notifying a listener once it unsubscribes', () => {
    const bus = new SessionEventBus();
    const kept = vi.fn();
    const removed = vi.fn();
    bus.subscribe(kept);
    const unsubscribe = bus.subscribe(removed);

    unsubscribe();
    bus.emitExpired();

    expect(removed).not.toHaveBeenCalled();
    expect(kept).toHaveBeenCalledTimes(1);
  });
});
