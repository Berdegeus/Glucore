import { AlertType } from '@prisma/client';
import type { AlertEvent } from '@prisma/client';

/** An alert as the app reads it. */
export interface AlertDto {
  type: string;
  timestampMs: number;
}

/**
 * Adapter between the app's alert names and the database enum.
 *
 * The two vocabularies do not line up, and the mapping is deliberately lossy in
 * one direction: FAST_DROP and FAST_RISE have no app-side name, so a stored
 * value of either reads back as `syncFailure`. That is the behaviour the app
 * has today and the characterization suite pins it; giving those two names of
 * their own is a product decision, not a refactor.
 *
 * An unrecognised name also lands on SYNC_FAILURE rather than failing the
 * request: an alert batch arrives from a device that may be running an older
 * build, and losing the whole sync over one unknown name is worse than
 * recording it imprecisely.
 */
export function toDbAlertType(type: string): AlertType {
  switch (type) {
    case 'glucoseLow':
    case 'HYPO_RISK':
      return AlertType.HYPO_RISK;
    case 'glucoseHigh':
    case 'HYPER_RISK':
      return AlertType.HYPER_RISK;
    case 'sensorReconnected':
    case 'SENSOR_RECONNECTED':
      return AlertType.SENSOR_RECONNECTED;
    case 'syncFailure':
    case 'SYNC_FAILURE':
      return AlertType.SYNC_FAILURE;
    case 'FAST_DROP':
      return AlertType.FAST_DROP;
    case 'FAST_RISE':
      return AlertType.FAST_RISE;
    default:
      return AlertType.SYNC_FAILURE;
  }
}

export function toAppAlertType(type: AlertType): string {
  switch (type) {
    case AlertType.HYPO_RISK:
      return 'glucoseLow';
    case AlertType.HYPER_RISK:
      return 'glucoseHigh';
    case AlertType.SENSOR_RECONNECTED:
      return 'sensorReconnected';
    case AlertType.FAST_DROP:
    case AlertType.FAST_RISE:
    case AlertType.SYNC_FAILURE:
      return 'syncFailure';
  }
}

export function toAlertDto(row: AlertEvent): AlertDto {
  return { type: toAppAlertType(row.alertType), timestampMs: row.triggeredAt.getTime() };
}
