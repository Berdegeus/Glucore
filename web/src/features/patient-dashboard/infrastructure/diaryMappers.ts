import type { CarbEntry, InsulinEntry, Reading } from '../domain/diary';
import type { CarbDto, InsulinDto, ReadingDto } from './diarySchemas';

// Each mapper copies field by field, so no DTO object leaks inward (ARQ-06).

export const toReading = (dto: ReadingDto): Reading => ({
  value: dto.value,
  timestampMs: dto.timestampMs,
  trend: dto.trend,
  rate: dto.rate,
  alarmCode: dto.alarmCode,
});

export const toCarbEntry = (dto: CarbDto): CarbEntry => ({
  id: dto.id,
  grams: dto.grams,
  description: dto.description,
  timeMs: dto.timeMs,
});

export const toInsulinEntry = (dto: InsulinDto): InsulinEntry => ({
  id: dto.id,
  units: dto.units,
  type: dto.type,
  timeMs: dto.timeMs,
  dayOfWeek: dto.dayOfWeek,
});
