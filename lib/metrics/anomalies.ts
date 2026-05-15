import type { NormalizedActivity, NormalizedDataset } from "../types";
import {
  EMPTY_FILTER,
  type MetricsFilter,
  metricRows,
  passesFilter,
  zScores,
} from "./filter";

export type AnomalySeverity = "primary" | "secondary";

export interface AnomalyRowRef {
  rowIndex: number;
  employeeId: string;
  dateKey: string | null;
  istCivil: string | null;
  app: string;
  taskCategory: string;
  durationRaw: string;
}

export interface Anomaly {
  id: string;
  severity: AnomalySeverity;
  title: string;
  detail: string;
  employeeId?: string;
  rows: AnomalyRowRef[];
}

const ref = (a: NormalizedActivity): AnomalyRowRef => ({
  rowIndex: a.rowIndex,
  employeeId: a.employeeId,
  dateKey: a.dateKey,
  istCivil: a.istCivil,
  app: a.app,
  taskCategory: a.taskCategory,
  durationRaw: a.durationRaw,
});

/** Anomalies, strongest first. Primary is the post-termination activity
 *  (E010 in this data); secondaries are implausible-duration rows and
 *  per-employee repetitive-share outliers. Every anomaly carries the exact
 *  source rows for click-through. */
export function detectAnomalies(
  ds: NormalizedDataset,
  filter: MetricsFilter = EMPTY_FILTER,
): Anomaly[] {
  const out: Anomaly[] = [];

  // ---- primary: activity logged after an employee's termination date ----
  for (const e of ds.employees.values()) {
    if (e.status !== "terminated" || !e.terminatedOn) continue;
    const after = ds.activity.filter(
      (a) =>
        a.employeeId === e.employeeId &&
        a.dateKey != null &&
        a.dateKey > e.terminatedOn! &&
        passesFilter(a, filter),
    );
    if (after.length === 0) continue;
    out.push({
      id: `post-termination:${e.employeeId}`,
      severity: "primary",
      title: `Activity after termination — ${e.employeeId}`,
      detail:
        `${e.employeeId} (${e.name ?? "unknown"}) is marked terminated on ` +
        `${e.terminatedOn}, yet ${after.length} activity row(s) are logged ` +
        `after that date. Likely a deprovisioning gap or mislabelled record.`,
      employeeId: e.employeeId,
      rows: after.map(ref).sort((a, b) => a.rowIndex - b.rowIndex),
    });
  }

  // ---- secondary: implausible single-activity durations (>8h) ----
  const outlierRows = ds.activity.filter(
    (a) => a.durationStatus === "outlier" && passesFilter(a, filter),
  );
  if (outlierRows.length > 0) {
    out.push({
      id: "duration-outlier",
      severity: "secondary",
      title: `Implausible durations — ${outlierRows.length} row(s)`,
      detail:
        `Single logged activities exceed 8h; excluded from time/rupee math ` +
        `(not clamped — clamping fabricates a number).`,
      rows: outlierRows.map(ref).sort((a, b) => a.rowIndex - b.rowIndex),
    });
  }

  // ---- secondary: per-employee repetitive-share outlier ----
  const byEmp = new Map<string, { rep: number; known: number }>();
  for (const a of metricRows(ds, filter)) {
    if (a.isRepetitive === "unknown") continue;
    const g = byEmp.get(a.employeeId) ?? { rep: 0, known: 0 };
    g.known += 1;
    if (a.isRepetitive === "true") g.rep += 1;
    byEmp.set(a.employeeId, g);
  }
  const ids = [...byEmp.keys()].filter(
    (id) => byEmp.get(id)!.known >= 5, // ignore tiny samples
  );
  if (ids.length >= 3) {
    const shares = ids.map((id) => {
      const g = byEmp.get(id)!;
      return g.rep / g.known;
    });
    const z = zScores(shares);
    ids.forEach((id, i) => {
      if (z[i] <= 2) return;
      const rows = metricRows(ds, filter).filter(
        (a) => a.employeeId === id && a.isRepetitive === "true",
      );
      out.push({
        id: `rep-share-outlier:${id}`,
        severity: "secondary",
        title: `High repetitive share — ${id}`,
        detail:
          `${id} logs ${(shares[i] * 100).toFixed(0)}% repetitive work ` +
          `(z=${z[i].toFixed(1)} vs peers) — a strong automation candidate.`,
        employeeId: id,
        rows: rows.map(ref).sort((a, b) => a.rowIndex - b.rowIndex),
      });
    });
  }

  const rank: Record<AnomalySeverity, number> = {
    primary: 0,
    secondary: 1,
  };
  return out.sort((a, b) => rank[a.severity] - rank[b.severity]);
}
