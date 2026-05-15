import { canonKey, isMissingToken } from "./text";

export const UNKNOWN_DEPT = "Unknown";

// Canonical 6 departments. "CS" is mapped defensively (brief lists it; the
// provided files use "Customer Support").
const DEPT_MAP: Record<string, string> = {
  operations: "Operations",
  ops: "Operations",
  finance: "Finance",
  fin: "Finance",
  sales: "Sales",
  "customer support": "Customer Support",
  cs: "Customer Support",
  support: "Customer Support",
  hr: "HR",
  "human resources": "HR",
  marketing: "Marketing",
  mktg: "Marketing",
};

export function normalizeDepartment(raw: string | null | undefined): string {
  if (raw == null || isMissingToken(String(raw))) return UNKNOWN_DEPT;
  const key = canonKey(String(raw));
  return DEPT_MAP[key] ?? String(raw).trim().replace(/\s+/g, " ");
}
