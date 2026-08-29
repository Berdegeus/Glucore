/**
 * Who is acting and from where. Every audit entry a diary service writes
 * carries it, so the three services share one declaration instead of each
 * repeating the shape (design.md "Camadas do backend": mesmo formato nas três).
 */

export interface RequestContext {
  userId: string;
  ipAddress: string | null;
  userAgent: string | null;
}
