import type { NormalizedDataset } from "../types";
import {
  EMPTY_FILTER,
  type MetricsFilter,
  minutesToHours,
  passesFilter,
  repetitiveRows,
} from "./filter";
import { rFactor, rFactorBand } from "./r-factor";

const MONTH_DAYS = 30; // "/month" = observed daily rate * 30 (see caveat)

export interface CategoryRecoverable {
  category: string;
  repetitiveHrsWindow: number;
  r: number;
  recoverableHrsWindow: number;
  recoverableHrsMonth: number;
}

export interface EmployeeRecoverable {
  employeeId: string;
  name: string | null;
  recoverableHrsMonth: number;
  hourlyInr: number;
  recoverableInrMonth: number;
  compImputed: boolean;
}

export interface HeadlineResult {
  /** Headline #1 — recoverable hours per month (base R). */
  recoverableHrsMonth: number;
  /** Sensitivity band from R±, same scaling. */
  recoverableHrsMonthLow: number;
  recoverableHrsMonthHigh: number;
  /** Headline #2 — recoverable rupees per month (HRMS-joined employees). */
  recoverableInrMonth: number;
  recoverableInrMonthLow: number;
  recoverableInrMonthHigh: number;

  // Auditable context for the methodology drawer:
  windowStart: string | null;
  windowEnd: string | null;
  windowDays: number;
  monthDays: number;
  recoverableHrsWindow: number;
  repetitiveRowCount: number;

  /** Recoverable hrs that exist but carry no rupee value because the employee
   *  has no HRMS comp (E013 / any activity-without-metadata id). Surfaced so
   *  the rupee figure is visibly conservative, not silently dropped. */
  excludedRecoverableHrsMonth: number;
  excludedEmployeeIds: string[];
  /** Repetitive minutes on quarantined "?" rows, reported, never monetised. */
  quarantinedRepetitiveHrsWindow: number;

  byCategory: CategoryRecoverable[];
  byEmployee: EmployeeRecoverable[];
}

/** The two headline numbers + every input needed to defend them.
 *  Pure: same dataset + filter -> same result. */
export function computeHeadline(
  ds: NormalizedDataset,
  filter: MetricsFilter = EMPTY_FILTER,
): HeadlineResult {
  const windowDays = Math.max(ds.dq.dateRange.days, 1);
  const monthScale = MONTH_DAYS / windowDays;

  const rows = repetitiveRows(ds, filter);

  // ---- recoverable HOURS (org level; includes E013, excludes "?") ----
  const catAgg = new Map<
    string,
    { repMin: number; recMin: number; recLow: number; recHigh: number }
  >();
  for (const a of rows) {
    const min = a.durationMinutes ?? 0;
    const band = rFactorBand(a.taskCategory);
    const c =
      catAgg.get(a.taskCategory) ??
      { repMin: 0, recMin: 0, recLow: 0, recHigh: 0 };
    c.repMin += min;
    c.recMin += min * band.base;
    c.recLow += min * band.low;
    c.recHigh += min * band.high;
    catAgg.set(a.taskCategory, c);
  }

  let recMinWindow = 0;
  let recMinLow = 0;
  let recMinHigh = 0;
  const byCategory: CategoryRecoverable[] = [];
  for (const [category, c] of catAgg) {
    recMinWindow += c.recMin;
    recMinLow += c.recLow;
    recMinHigh += c.recHigh;
    byCategory.push({
      category,
      repetitiveHrsWindow: minutesToHours(c.repMin),
      r: rFactor(category),
      recoverableHrsWindow: minutesToHours(c.recMin),
      recoverableHrsMonth: minutesToHours(c.recMin) * monthScale,
    });
  }
  byCategory.sort(
    (a, b) => b.recoverableHrsMonth - a.recoverableHrsMonth,
  );

  const recoverableHrsWindow = minutesToHours(recMinWindow);
  const recoverableHrsMonth = recoverableHrsWindow * monthScale;

  // ---- recoverable RUPEES (only HRMS-joined employees with comp) ----
  const empMin = new Map<string, { base: number; low: number; high: number }>();
  let excludedRecMin = 0;
  const excludedIds = new Set<string>();
  for (const a of rows) {
    const min = a.durationMinutes ?? 0;
    const band = rFactorBand(a.taskCategory);
    if (ds.employees.has(a.employeeId)) {
      const e =
        empMin.get(a.employeeId) ?? { base: 0, low: 0, high: 0 };
      e.base += min * band.base;
      e.low += min * band.low;
      e.high += min * band.high;
      empMin.set(a.employeeId, e);
    } else {
      // Known activity id with no HRMS comp (E013): counts in hours, not rupees.
      excludedRecMin += min * band.base;
      excludedIds.add(a.employeeId);
    }
  }

  let inrMonth = 0;
  let inrLow = 0;
  let inrHigh = 0;
  const byEmployee: EmployeeRecoverable[] = [];
  for (const [id, m] of empMin) {
    const emp = ds.employees.get(id)!;
    const rate = emp.compensation.hourlyInr;
    const hrsMonth = minutesToHours(m.base) * monthScale;
    const inr = hrsMonth * rate;
    inrMonth += inr;
    inrLow += minutesToHours(m.low) * monthScale * rate;
    inrHigh += minutesToHours(m.high) * monthScale * rate;
    byEmployee.push({
      employeeId: id,
      name: emp.name,
      recoverableHrsMonth: hrsMonth,
      hourlyInr: rate,
      recoverableInrMonth: inr,
      compImputed: emp.compensation.imputed,
    });
  }
  byEmployee.sort(
    (a, b) => b.recoverableInrMonth - a.recoverableInrMonth,
  );

  // Quarantined "?" repetitive minutes (valid duration, unknown employee):
  // never counted above (countsForMetrics is false) — reported for honesty.
  let qMin = 0;
  for (const a of ds.activity) {
    if (
      a.isUnknownEmployee &&
      a.durationStatus === "valid" &&
      a.isRepetitive === "true" &&
      passesFilter(a, filter)
    ) {
      qMin += a.durationMinutes ?? 0;
    }
  }

  return {
    recoverableHrsMonth,
    recoverableHrsMonthLow: minutesToHours(recMinLow) * monthScale,
    recoverableHrsMonthHigh: minutesToHours(recMinHigh) * monthScale,
    recoverableInrMonth: inrMonth,
    recoverableInrMonthLow: inrLow,
    recoverableInrMonthHigh: inrHigh,
    windowStart: ds.dq.dateRange.start,
    windowEnd: ds.dq.dateRange.end,
    windowDays,
    monthDays: MONTH_DAYS,
    recoverableHrsWindow,
    repetitiveRowCount: rows.length,
    excludedRecoverableHrsMonth: minutesToHours(excludedRecMin) * monthScale,
    excludedEmployeeIds: [...excludedIds].sort(),
    quarantinedRepetitiveHrsWindow: minutesToHours(qMin),
    byCategory,
    byEmployee,
  };
}
