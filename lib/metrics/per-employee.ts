import type { NormalizedDataset, NormalizedEmployee } from "../types";
import {
  EMPTY_FILTER,
  type MetricsFilter,
  minutesToHours,
  passesFilter,
} from "./filter";
import { rFactor } from "./r-factor";

const MONTH_DAYS = 30;

export interface EmployeeTaskRow {
  category: string;
  repetitiveHrs: number;
  recoverableHrsMonth: number;
}

export interface PeerComparison {
  roleCanonical: string | null;
  peerCount: number;
  peerAvgRepetitiveHrs: number;
  selfRepetitiveHrs: number;
  deltaHrs: number; // self - peer avg
}

export interface EmployeeDrilldown {
  employeeId: string;
  hasMetadata: boolean;
  isUnknown: boolean;
  profile: NormalizedEmployee | null;
  activityRows: number;
  totalHrs: number;
  repetitiveHrs: number;
  recoverableHrsMonth: number;
  recoverableInrMonth: number | null; // null when no HRMS comp
  topRepetitiveTasks: EmployeeTaskRow[];
  peers: PeerComparison;
}

function repetitiveHrsByEmp(
  ds: NormalizedDataset,
  filter: MetricsFilter,
): Map<string, number> {
  const m = new Map<string, number>();
  for (const a of ds.activity) {
    if (
      a.countsForMetrics &&
      a.isRepetitive === "true" &&
      passesFilter(a, filter)
    ) {
      m.set(
        a.employeeId,
        (m.get(a.employeeId) ?? 0) + (a.durationMinutes ?? 0),
      );
    }
  }
  return m;
}

/** Per-employee drill-down: profile, totals, top repetitive tasks, and a
 *  same-role peer comparison. Works for HRMS-joined ids, the
 *  activity-without-metadata id (E013), and the quarantined "?" bucket. */
export function employeeDrilldown(
  ds: NormalizedDataset,
  employeeId: string,
  filter: MetricsFilter = EMPTY_FILTER,
  topN = 5,
): EmployeeDrilldown {
  const profile = ds.employees.get(employeeId) ?? null;
  const isUnknown = employeeId === "?";
  const windowDays = Math.max(ds.dq.dateRange.days, 1);
  const monthScale = MONTH_DAYS / windowDays;

  const rows = ds.activity.filter(
    (a) =>
      a.employeeId === employeeId &&
      a.countsForMetrics &&
      passesFilter(a, filter),
  );

  let totalMin = 0;
  let repMin = 0;
  let recMin = 0;
  const byCat = new Map<string, { rep: number; rec: number }>();
  for (const a of rows) {
    const min = a.durationMinutes ?? 0;
    totalMin += min;
    if (a.isRepetitive === "true") {
      repMin += min;
      const rec = min * rFactor(a.taskCategory);
      recMin += rec;
      const g = byCat.get(a.taskCategory) ?? { rep: 0, rec: 0 };
      g.rep += min;
      g.rec += rec;
      byCat.set(a.taskCategory, g);
    }
  }

  const recoverableHrsMonth = minutesToHours(recMin) * monthScale;
  const recoverableInrMonth = profile
    ? recoverableHrsMonth * profile.compensation.hourlyInr
    : null;

  const topRepetitiveTasks: EmployeeTaskRow[] = [...byCat.entries()]
    .map(([category, g]) => ({
      category,
      repetitiveHrs: minutesToHours(g.rep),
      recoverableHrsMonth: minutesToHours(g.rec) * monthScale,
    }))
    .sort((a, b) => b.repetitiveHrs - a.repetitiveHrs)
    .slice(0, topN);

  // Same-role peers (by canonical role), self excluded.
  const repByEmp = repetitiveHrsByEmp(ds, filter);
  const roleCanonical = profile?.roleCanonical ?? null;
  const peerIds = roleCanonical
    ? [...ds.employees.values()]
        .filter(
          (e) =>
            e.roleCanonical === roleCanonical &&
            e.employeeId !== employeeId,
        )
        .map((e) => e.employeeId)
    : [];
  const peerHrs = peerIds.map((id) =>
    minutesToHours(repByEmp.get(id) ?? 0),
  );
  const peerAvg =
    peerHrs.length > 0
      ? peerHrs.reduce((s, v) => s + v, 0) / peerHrs.length
      : 0;
  const selfRepetitiveHrs = minutesToHours(repMin);

  return {
    employeeId,
    hasMetadata: profile != null,
    isUnknown,
    profile,
    activityRows: rows.length,
    totalHrs: minutesToHours(totalMin),
    repetitiveHrs: selfRepetitiveHrs,
    recoverableHrsMonth,
    recoverableInrMonth,
    topRepetitiveTasks,
    peers: {
      roleCanonical,
      peerCount: peerIds.length,
      peerAvgRepetitiveHrs: peerAvg,
      selfRepetitiveHrs,
      deltaHrs: selfRepetitiveHrs - peerAvg,
    },
  };
}

export interface EmployeeRankRow {
  employeeId: string;
  name: string | null;
  department: string;
  role: string | null;
  hasMetadata: boolean;
  activityRows: number;
  totalHrs: number;
  repetitiveHrs: number;
  recoverableHrsMonth: number;
  recoverableInrMonth: number | null;
}

/** One row per employee present in the filtered metric rows. Drives the
 *  employee list; the task-category cross-filter narrows it (cross-filter #2).
 *  E013 (activity-without-metadata) appears with null rupees, not hidden. */
export function employeeRanking(
  ds: NormalizedDataset,
  filter: MetricsFilter = EMPTY_FILTER,
): EmployeeRankRow[] {
  const windowDays = Math.max(ds.dq.dateRange.days, 1);
  const monthScale = MONTH_DAYS / windowDays;

  const agg = new Map<
    string,
    { rows: number; min: number; repMin: number; recMin: number }
  >();
  for (const a of ds.activity) {
    if (!a.countsForMetrics || !passesFilter(a, filter)) continue;
    let g = agg.get(a.employeeId);
    if (!g) {
      g = { rows: 0, min: 0, repMin: 0, recMin: 0 };
      agg.set(a.employeeId, g);
    }
    const min = a.durationMinutes ?? 0;
    g.rows += 1;
    g.min += min;
    if (a.isRepetitive === "true") {
      g.repMin += min;
      g.recMin += min * rFactor(a.taskCategory);
    }
  }

  return [...agg.entries()]
    .map(([employeeId, g]) => {
      const e = ds.employees.get(employeeId) ?? null;
      const recHrsMonth = minutesToHours(g.recMin) * monthScale;
      return {
        employeeId,
        name: e?.name ?? null,
        department: e?.department ?? "—",
        role: e?.role ?? null,
        hasMetadata: e != null,
        activityRows: g.rows,
        totalHrs: minutesToHours(g.min),
        repetitiveHrs: minutesToHours(g.repMin),
        recoverableHrsMonth: recHrsMonth,
        recoverableInrMonth: e
          ? recHrsMonth * e.compensation.hourlyInr
          : null,
      };
    })
    .sort((a, b) => b.recoverableHrsMonth - a.recoverableHrsMonth);
}
