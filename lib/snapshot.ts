// Bridge between the server (filesystem load + normalize, once) and the
// client (interactive cross-filter recompute). The normalized dataset holds a
// Map, which is not RSC-serializable; we ship a plain-array snapshot and
// rebuild the dataset on the client. The metrics engine is pure and has no
// server-only imports, so the exact same code recomputes on either side.

import type {
  DataQualityReport,
  NormalizedActivity,
  NormalizedDataset,
  NormalizedEmployee,
} from "./types";

export interface DatasetSnapshot {
  activity: NormalizedActivity[];
  employees: NormalizedEmployee[];
  dq: DataQualityReport;
}

/** Server side: dataset -> plain, serializable snapshot. */
export function toSnapshot(ds: NormalizedDataset): DatasetSnapshot {
  return {
    activity: ds.activity,
    employees: [...ds.employees.values()],
    dq: ds.dq,
  };
}

/** Client side: snapshot -> dataset (Map rebuilt). */
export function fromSnapshot(snap: DatasetSnapshot): NormalizedDataset {
  const employees = new Map<string, NormalizedEmployee>();
  for (const e of snap.employees) employees.set(e.employeeId, e);
  return { activity: snap.activity, employees, dq: snap.dq };
}
