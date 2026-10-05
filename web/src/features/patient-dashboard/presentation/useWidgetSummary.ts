import type { UseQueryResult } from '@tanstack/react-query';
import type { AppError } from '../../../shared/domain/appError';
import type { GlucoseSummary } from '../domain/summary';
import { usePeriod } from './periodContext';
import { useSummary } from './useSummary';

/**
 * The summary of the page's period, for a widget. Every widget calls this, so
 * they all land on one cache entry: one request however many are on the page
 * (PAC-17).
 */
export function useWidgetSummary(): UseQueryResult<GlucoseSummary, AppError> {
  return useSummary(usePeriod());
}
