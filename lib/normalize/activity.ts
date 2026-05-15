import type { NormalizedActivity } from "../types";
import { normalizeApp, UNKNOWN_APP } from "./canon-apps";
import {
  normalizeCategory,
  UNCATEGORIZED,
} from "./canon-categories";
import { normalizeDepartment } from "./canon-departments";
import { normalizeRepetitive } from "./booleans";
import { normalizeDuration } from "./duration";
import { parseTimestamp } from "./timestamps";

const COLS = [
  "employee_id",
  "department",
  "timestamp",
  "app_used",
  "task_category",
  "duration_minutes",
  "is_repetitive",
] as const;

export interface ActivityNormalizationResult {
  activity: NormalizedActivity[];
  totalRawRows: number;
  duplicateRowsRemoved: number;
  timestampUnparseable: number;
}

export function normalizeActivityRows(
  records: Record<string, string>[],
): ActivityNormalizationResult {
  const totalRawRows = records.length;
  const seen = new Set<string>();
  const activity: NormalizedActivity[] = [];
  let duplicateRowsRemoved = 0;
  let timestampUnparseable = 0;

  records.forEach((rec, rowIndex) => {
    // Exact full-row duplicate (all 7 raw columns identical) -> drop.
    const dupKey = COLS.map((c) => rec[c] ?? "").join("");
    if (seen.has(dupKey)) {
      duplicateRowsRemoved++;
      return;
    }
    seen.add(dupKey);

    const employeeIdRaw = (rec.employee_id ?? "").trim();
    const employeeId = employeeIdRaw === "" ? "?" : employeeIdRaw;
    const isUnknownEmployee = employeeId === "?";

    const ts = parseTimestamp(rec.timestamp ?? "");
    if (!ts) timestampUnparseable++;

    const dur = normalizeDuration(rec.duration_minutes ?? "");

    activity.push({
      rowIndex,
      employeeId,
      isUnknownEmployee,
      departmentRaw: (rec.department ?? "").trim(),
      department: normalizeDepartment(rec.department),
      timestampIso: ts?.timestampIso ?? null,
      istCivil: ts?.istCivil ?? null,
      dateKey: ts?.dateKey ?? null,
      isoWeek: ts?.isoWeek ?? null,
      app: normalizeApp(rec.app_used ?? ""),
      appRaw: rec.app_used ?? "",
      taskCategory: normalizeCategory(rec.task_category ?? ""),
      taskCategoryRaw: rec.task_category ?? "",
      durationMinutes: dur.minutes,
      durationRaw: rec.duration_minutes ?? "",
      durationStatus: dur.status,
      isRepetitive: normalizeRepetitive(rec.is_repetitive ?? ""),
      isRepetitiveRaw: rec.is_repetitive ?? "",
      countsForMetrics: !isUnknownEmployee && dur.status === "valid",
    });
  });

  return {
    activity,
    totalRawRows,
    duplicateRowsRemoved,
    timestampUnparseable,
  };
}

export { UNKNOWN_APP, UNCATEGORIZED };
