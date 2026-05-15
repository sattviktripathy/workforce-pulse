import type {
  DataQualityReport,
  NormalizedActivity,
  NormalizedDataset,
  NormalizedEmployee,
} from "../types";
import { normalizeActivityRows } from "./activity";
import { toRecords } from "./csv";
import {
  imputeMissingComp,
  normalizeEmployees,
} from "./employees";
import { UNKNOWN_APP } from "./canon-apps";
import { UNCATEGORIZED } from "./canon-categories";

function majority(values: string[]): string | null {
  const c = new Map<string, number>();
  for (const v of values) c.set(v, (c.get(v) ?? 0) + 1);
  let best: string | null = null;
  let n = -1;
  for (const [k, v] of c) {
    if (v > n) {
      best = k;
      n = v;
    }
  }
  return best;
}

/** Build the clean, joined, in-memory dataset from the two raw file bodies. */
export function buildDataset(
  csvText: string,
  employeesJson: unknown,
): NormalizedDataset {
  const records = toRecords(csvText);
  const act = normalizeActivityRows(records);

  // HRMS records live at `.employees` in the provided file; the brief says
  // `.data.employees`. Support both, defensively.
  const root = employeesJson as Record<string, unknown>;
  const rawEmployees =
    ((root?.data as Record<string, unknown>)?.employees as unknown[]) ??
    (root?.employees as unknown[]) ??
    [];

  const emp = normalizeEmployees(rawEmployees as Record<string, unknown>[]);
  const employees = emp.employees;
  const compensationImputed = imputeMissingComp(employees);

  // Department fallback for HRMS records missing a department: use the
  // employee's majority logged department from the activity file.
  for (const e of employees.values()) {
    if (e.departmentSource !== "activity-fallback") continue;
    const depts = act.activity
      .filter((a) => a.employeeId === e.employeeId)
      .map((a) => a.department);
    const m = majority(depts);
    if (m) {
      e.department = m;
      e.departmentSource = "activity-fallback";
    }
  }

  // Join buckets.
  const activityIds = new Set(
    act.activity.filter((a) => !a.isUnknownEmployee).map((a) => a.employeeId),
  );
  const noMetadataEmployees = [...activityIds]
    .filter((id) => !employees.has(id))
    .map((id) => ({
      employeeId: id,
      activityRows: act.activity.filter((a) => a.employeeId === id).length,
    }))
    .sort((a, b) => b.activityRows - a.activityRows);

  const noActivityEmployees = [...employees.keys()]
    .filter((id) => !activityIds.has(id))
    .sort();

  // Counts.
  const durTally = { valid: 0, missing: 0, nonpositive: 0, outlier: 0 };
  let booleanUnknown = 0;
  let appUnknownRows = 0;
  let categoryUncategorizedRows = 0;
  let departmentMismatch = 0;
  const dates: string[] = [];

  for (const a of act.activity) {
    durTally[a.durationStatus]++;
    if (a.isRepetitive === "unknown") booleanUnknown++;
    if (a.app === UNKNOWN_APP) appUnknownRows++;
    if (a.taskCategory === UNCATEGORIZED) categoryUncategorizedRows++;
    if (a.dateKey) dates.push(a.dateKey);
    const e = employees.get(a.employeeId);
    if (e && !a.isUnknownEmployee && a.department !== e.department) {
      departmentMismatch++;
    }
  }

  dates.sort();
  const start = dates[0] ?? null;
  const end = dates[dates.length - 1] ?? null;
  const days =
    start && end
      ? Math.round(
          (Date.parse(end) - Date.parse(start)) / 86_400_000,
        ) + 1
      : 0;

  const workingHoursDefaulted = [...employees.values()].filter(
    (e) => e.workingHours.defaulted,
  ).length;

  const dq: DataQualityReport = {
    totalRawRows: act.totalRawRows,
    duplicateRowsRemoved: act.duplicateRowsRemoved,
    rowsAfterDedup: act.activity.length,
    duration: durTally,
    booleanUnknown,
    timestampUnparseable: act.timestampUnparseable,
    unknownEmployeeRows: act.activity.filter((a) => a.isUnknownEmployee)
      .length,
    appUnknownRows,
    categoryUncategorizedRows,
    hrmsRecords: emp.hrmsRecords,
    canonicalEmployees: employees.size,
    employeeConflicts: emp.conflicts,
    noMetadataEmployees,
    noActivityEmployees,
    workingHoursDefaulted,
    compensationImputed,
    departmentMissingInHrms: emp.departmentMissingInHrms,
    departmentMismatch,
    dateRange: { start, end, days },
  };

  return { activity: act.activity, employees, dq };
}

export type { NormalizedActivity, NormalizedEmployee };
