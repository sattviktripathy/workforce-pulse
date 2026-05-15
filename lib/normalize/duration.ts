import type { DurationStatus } from "../types";
import { MAX_DURATION_MIN } from "./constants";

export interface DurationResult {
  minutes: number | null;
  status: DurationStatus;
}

/** Validation policy (documented in README):
 *  - blank / non-numeric  -> missing     (excluded from time/rupee)
 *  - <= 0 (neg or zero)   -> nonpositive (excluded; a logged task can't be <=0)
 *  - > 480 min            -> outlier     (excluded, NOT clamped — clamping
 *                                         fabricates a value)
 *  - otherwise            -> valid
 *  Excluded rows are kept in the dataset with their flag so the count is
 *  auditable; they just don't contribute to aggregates. */
export function normalizeDuration(raw: string): DurationResult {
  const t = raw.trim();
  if (t === "") return { minutes: null, status: "missing" };
  const n = Number(t);
  if (!Number.isFinite(n)) return { minutes: null, status: "missing" };
  if (n <= 0) return { minutes: null, status: "nonpositive" };
  if (n > MAX_DURATION_MIN) return { minutes: null, status: "outlier" };
  return { minutes: n, status: "valid" };
}
