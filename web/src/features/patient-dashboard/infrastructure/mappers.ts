import type { GlucoseSummary } from '../domain/summary';
import type { SummaryDto } from './schemas';

/** Turns the validated DTO into the domain summary, copying so no DTO object leaks inward (ARQ-06). */
export function toSummary(dto: SummaryDto): GlucoseSummary {
  return {
    from: dto.from,
    to: dto.to,
    tz: dto.tz,
    lastReadingAt: dto.lastReadingAt,
    totals: { ...dto.totals },
    timeInRangePercent: dto.timeInRangePercent,
    gmiPercent: dto.gmiPercent,
    coefficientOfVariationPercent: dto.coefficientOfVariationPercent,
    sensorUsePercent: dto.sensorUsePercent,
    zoneDistribution: { ...dto.zoneDistribution },
    byDay: dto.byDay.map((bucket) => ({ ...bucket })),
    agp: dto.agp.map((point) => ({ ...point })),
    heatmap: dto.heatmap.map((cell) => ({ ...cell })),
    insulinByType: dto.insulinByType.map((row) => ({ ...row })),
    alertsByType: dto.alertsByType.map((row) => ({ ...row })),
    excursions: dto.excursions.map((excursion) => ({ ...excursion })),
  };
}
