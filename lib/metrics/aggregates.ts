import type { NormalizedDataset } from "../types";
import {
  EMPTY_FILTER,
  type MetricsFilter,
  metricRows,
  minutesToHours,
} from "./filter";

export type TimeSinkDimension = "taskCategory" | "app" | "department";

export interface TimeSinkBucket {
  key: string;
  rows: number;
  totalHrs: number;
  repetitiveHrs: number;
  /** repetitive hrs / (repetitive + non-repetitive) hrs — unknown excluded
   *  from the denominator (reported separately, never guessed). */
  repetitiveShare: number;
  unknownRepetitiveHrs: number;
  distinctEmployees: number;
}

const dimValue = (
  a: { taskCategory: string; app: string; department: string },
  d: TimeSinkDimension,
): string =>
  d === "taskCategory"
    ? a.taskCategory
    : d === "app"
      ? a.app
      : a.department;

interface Acc {
  rows: number;
  min: number;
  repMin: number;
  knownMin: number;
  unkMin: number;
  emps: Set<string>;
}

/** Where the time goes, by category | app | department. Built on metric rows
 *  (known employee + valid duration) so it joins cleanly and totals reconcile
 *  with the headline. Sorted by total hours desc. */
export function timeSink(
  ds: NormalizedDataset,
  dimension: TimeSinkDimension,
  filter: MetricsFilter = EMPTY_FILTER,
): TimeSinkBucket[] {
  const agg = new Map<string, Acc>();

  for (const a of metricRows(ds, filter)) {
    const key = dimValue(a, dimension);
    const min = a.durationMinutes ?? 0;
    let g = agg.get(key);
    if (!g) {
      g = {
        rows: 0,
        min: 0,
        repMin: 0,
        knownMin: 0,
        unkMin: 0,
        emps: new Set<string>(),
      };
      agg.set(key, g);
    }
    g.rows += 1;
    g.min += min;
    g.emps.add(a.employeeId);
    if (a.isRepetitive === "true") {
      g.repMin += min;
      g.knownMin += min;
    } else if (a.isRepetitive === "false") {
      g.knownMin += min;
    } else {
      g.unkMin += min;
    }
  }

  return [...agg.entries()]
    .map(([key, g]) => ({
      key,
      rows: g.rows,
      totalHrs: minutesToHours(g.min),
      repetitiveHrs: minutesToHours(g.repMin),
      repetitiveShare: g.knownMin > 0 ? g.repMin / g.knownMin : 0,
      unknownRepetitiveHrs: minutesToHours(g.unkMin),
      distinctEmployees: g.emps.size,
    }))
    .sort((a, b) => b.totalHrs - a.totalHrs);
}
