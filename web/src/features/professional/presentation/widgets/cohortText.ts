import { formatNumber } from '../../../../shared/presentation/format';

/** "1 paciente", "3 pacientes": the count and the noun that agrees with it. */
export const patientCountText = (count: number): string => `${formatNumber(count, 0)} ${count === 1 ? 'paciente' : 'pacientes'}`;
