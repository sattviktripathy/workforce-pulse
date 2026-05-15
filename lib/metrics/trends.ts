import type { NormalizedDataset } from "../types";
import {
  EMPTY_FILTER,
  type MetricsFilter,
  minutesToHours,
  repetitiveRows,
} from "./filter";

export interface TrendSeries {
  category: string;
  byWeek: number[]; // repetitive hrs, aligned to `weeks`
  totalHrs: number;
}

export interface TrendResult {
  weeks: string[]; // ISO week buckets, ascending
  series: TrendSeries[]; // top-N categories by total repetitive hrs
}

/** Week-over-week repetitive hours for the top-N categories, over the real
 *  ISO-week buckets present in the data (~3 weeks here, not the brief's ~4 —
 *  the span discrepancy is documented). Filter-aware. */
export function weekOverWeek(
  ds: NormalizedDataset,
  topN = 5,
  filter: MetricsFilter = EMPTY_FILTER,
): TrendResult {
  const rows = repetitiveRows(ds, filter).filter(
    (a) => a.isoWeek != null,
  );

  const weeks = [...new Set(rows.map((a) => a.isoWeek!))].sort();
  const weekIdx = new Map(weeks.map((w, i) => [w, i]));

  const byCat = new Map<string, number[]>();
  const totals = new Map<string, number>();
  for (const a of rows) {
    const min = a.durationMinutes ?? 0;
    let arr = byCat.get(a.taskCategory);
    if (!arr) {
      arr = new Array(weeks.length).fill(0);
      byCat.set(a.taskCategory, arr);
    }
    arr[weekIdx.get(a.isoWeek!)!] += min;
    totals.set(a.taskCategory, (totals.get(a.taskCategory) ?? 0) + min);
  }

  const series = [...byCat.entries()]
    .map(([category, mins]) => ({
      category,
      byWeek: mins.map(minutesToHours),
      totalHrs: minutesToHours(totals.get(category) ?? 0),
    }))
    .sort((a, b) => b.totalHrs - a.totalHrs)
    .slice(0, topN);

  return { weeks, series };
}
