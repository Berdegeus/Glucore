/** A cell of already-prepared chart data. `null` is a gap, drawn as such. */
export type ChartValue = string | number | null;

/** One point or category of a chart: values by key. The adapters never see domain types. */
export type ChartRow = Readonly<Record<string, ChartValue>>;

/** A series the chart draws from `ChartRow[key]`; color and marker follow its position. */
export interface SeriesSpec {
  key: string;
  label: string;
}

export type ValueFormatter = (value: number) => string;
