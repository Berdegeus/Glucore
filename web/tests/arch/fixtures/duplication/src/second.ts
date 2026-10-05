export interface Reading {
  value: number;
  recordedAt: string;
}

export function summarize(readings: Reading[]): { min: number; max: number; mean: number } {
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  let total = 0;
  for (const reading of readings) {
    if (reading.value < min) min = reading.value;
    if (reading.value > max) max = reading.value;
    total += reading.value;
  }
  const mean = readings.length === 0 ? 0 : total / readings.length;
  return { min, max, mean };
}

export function inRange(readings: Reading[], low: number, high: number): number {
  const inside = readings.filter((reading) => reading.value >= low && reading.value <= high);
  return readings.length === 0 ? 0 : (inside.length / readings.length) * 100;
}
