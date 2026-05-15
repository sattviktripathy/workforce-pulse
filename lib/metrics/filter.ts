import type { NormalizedActivity, NormalizedDataset } from "../types";

/** Dashboard cross-filter state. A null/absent field means "no constraint".
 *  The same filter object drives every metric so the headline, breakdowns,
 *  trend, ranking and export all recompute consistently. */
export interface MetricsFilter {
  department?: string | null;
  taskCategory?: string | null;
}

export const EMPTY_FILTER: MetricsFilter = {};

/** True if the row satisfies the active cross-filter. */
export function passesFilter(
  a: NormalizedActivity,
  f: MetricsFilter,
): boolean {
  if (f.department && a.department !== f.department) return false;
  if (f.taskCategory && a.taskCategory !== f.taskCategory) return false;
  return true;
}

/** Rows that count toward time/rupee math AND pass the filter:
 *  known employee + valid duration. Excludes the 2 "?" rows and the 7
 *  invalid-duration rows by construction (countsForMetrics). */
export function metricRows(
  ds: NormalizedDataset,
  f: MetricsFilter,
): NormalizedActivity[] {
  return ds.activity.filter((a) => a.countsForMetrics && passesFilter(a, f));
}

/** Repetitive subset of {@link metricRows}. Recoverable math runs on these. */
export function repetitiveRows(
  ds: NormalizedDataset,
  f: MetricsFilter,
): NormalizedActivity[] {
  return metricRows(ds, f).filter((a) => a.isRepetitive === "true");
}

export const minutesToHours = (min: number): number => min / 60;

/** Population z-score over a series; 0 when the series has no spread. */
export function zScores(values: number[]): number[] {
  const n = values.length;
  if (n === 0) return [];
  const mean = values.reduce((s, v) => s + v, 0) / n;
  const variance =
    values.reduce((s, v) => s + (v - mean) ** 2, 0) / n;
  const sd = Math.sqrt(variance);
  if (sd === 0) return values.map(() => 0);
  return values.map((v) => (v - mean) / sd);
}

export const round = (x: number, dp = 2): number => {
  const f = 10 ** dp;
  return Math.round(x * f) / f;
};
