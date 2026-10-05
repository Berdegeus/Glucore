import { DaysFilter } from '../../../shared/presentation/ui/daysFilter';
import { ADMIN_PERIOD_DAYS, DEFAULT_ADMIN_DAYS } from '../application/adminUseCases';

/** The accessible name of the chips' group. */
export const ADMIN_PERIOD_LABEL = 'Período';

interface AdminPeriodFilterProps {
  /** The period in force, in days; 30 until the administrator picks another. */
  value?: number;
  onChange: (days: number) => void;
}

/** The administrator's period: chips of 7, 30 and 90 days, at the touch size of every period control (ADM-07, RSP-04). */
export function AdminPeriodFilter({ value = DEFAULT_ADMIN_DAYS, onChange }: AdminPeriodFilterProps) {
  return <DaysFilter options={ADMIN_PERIOD_DAYS} value={value} onChange={onChange} label={ADMIN_PERIOD_LABEL} />;
}
