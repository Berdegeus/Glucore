import type { SessionEvents, Unsubscribe } from '../../domain/ports';

/**
 * Observer for the end of a session. Several requests can fail with
 * `401 TOKEN_INVALID` at once; subscribers hear about it a single time
 * until `reset()` re-arms the bus after the next login (ACC-09).
 */
export class SessionEventBus implements SessionEvents {
  private readonly listeners = new Set<() => void>();
  private expired = false;

  emitExpired(): void {
    if (this.expired) return;
    this.expired = true;
    for (const listener of [...this.listeners]) listener();
  }

  subscribe(listener: () => void): Unsubscribe {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  reset(): void {
    this.expired = false;
  }
}
