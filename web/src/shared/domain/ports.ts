// Ports shared by every feature (ARQ-05). Use cases depend on these
// interfaces; `shared/infrastructure` implements them and the composition
// root wires the two together.

/** Holds the access token for the current tab (ACC-12). */
export interface TokenStore {
  read(): string | null;
  save(token: string): void;
  clear(): void;
  /** False when the browser refused `sessionStorage` and the token lives in memory only. */
  readonly persistent: boolean;
}

export type Unsubscribe = () => void;

/** Publishes the end of a session, at most once until `reset()` (ACC-09). */
export interface SessionEvents {
  emitExpired(): void;
  subscribe(listener: () => void): Unsubscribe;
  /** Re-arms the bus after a new login. */
  reset(): void;
}

export interface Clock {
  now(): Date;
}

/** The IANA zone the dashboard groups days by, e.g. `America/Sao_Paulo` (API-01, RSP-09). */
export interface TimeZoneProvider {
  timeZone(): string;
}
