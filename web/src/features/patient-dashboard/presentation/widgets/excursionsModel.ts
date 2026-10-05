import { formatDateTime, formatMgdl, formatNumber } from '../../../../shared/presentation/format';
import type { Excursion } from '../../domain/summary';

export const EXCURSIONS_COLUMNS = ['Tipo', 'Início', 'Duração', 'Mínimo', 'Máximo'] as const;

export const KIND_LABELS: Readonly<Record<Excursion['kind'], string>> = {
  HYPO: 'Hipoglicemia',
  HYPER: 'Hiperglicemia',
};

/** The cells of one episode, formatted for display; the start is on the clock of `timeZone` (RSP-09). */
export function excursionCells(excursion: Excursion, timeZone: string): string[] {
  return [
    KIND_LABELS[excursion.kind],
    formatDateTime(excursion.startedAt, timeZone),
    `${formatNumber(excursion.durationMin, 0)} min`,
    formatMgdl(excursion.minGlucose),
    formatMgdl(excursion.maxGlucose),
  ];
}
