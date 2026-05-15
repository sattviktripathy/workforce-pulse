import type {
  CompensationKind,
  EmployeeConflict,
  NormalizedEmployee,
} from "../types";
import { WORK_DAYS_PER_YEAR } from "./constants";
import { normalizeDepartment, UNKNOWN_DEPT } from "./canon-departments";
import { canonKey } from "./text";
import { normalizeWorkingHours } from "./working-hours";

type RawEmployee = Record<string, unknown>;

function num(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "" && Number.isFinite(+v))
    return +v;
  return null;
}

function shapeOf(
  rec: RawEmployee,
): NormalizedEmployee["schemaShape"] {
  if (rec.meta && typeof rec.meta === "object") return "nested_meta";
  if ("EmployeeID" in rec) return "camel_flat";
  return "snake_flat";
}

interface RawComp {
  kind: CompensationKind;
  annualInr: number | null;
  hourlyInr: number | null;
}

function extractComp(rec: RawEmployee): RawComp {
  const meta = (rec.meta ?? {}) as RawEmployee;
  const lpa = num(rec.salary_LPA);
  const annualCtc = num(rec.annual_ctc_inr);
  const hourly = num(rec.hourly_rate_inr);
  const metaComp = (meta.compensation ?? {}) as RawEmployee;
  const metaAnnual = num(metaComp.annual);

  if (lpa != null)
    return {
      kind: "salary_LPA",
      annualInr: Math.round(lpa * 100_000), // LPA -> rupees, no float dust
      hourlyInr: null,
    };
  if (annualCtc != null)
    return { kind: "annual_ctc_inr", annualInr: annualCtc, hourlyInr: null };
  if (hourly != null)
    return { kind: "hourly_rate_inr", annualInr: null, hourlyInr: hourly };
  if (metaAnnual != null)
    return {
      kind: "meta.compensation.annual",
      annualInr: metaAnnual,
      hourlyInr: null,
    };
  return { kind: "missing", annualInr: null, hourlyInr: null };
}

function buildEmployee(rec: RawEmployee): NormalizedEmployee {
  const meta = (rec.meta ?? {}) as RawEmployee;
  const schemaShape = shapeOf(rec);

  const employeeId = String(
    rec.employee_id ?? rec.EmployeeID ?? "",
  ).trim();
  const name =
    (rec.name as string) ?? (rec.Name as string) ?? null;

  const deptRawVal = rec.department ?? rec.Dept;
  const hasDept =
    deptRawVal != null && String(deptRawVal).trim() !== "";
  const department = hasDept
    ? normalizeDepartment(String(deptRawVal))
    : UNKNOWN_DEPT;

  const role =
    (rec.role as string) ??
    (rec.Role as string) ??
    (meta.role as string) ??
    null;

  const tenureMonths =
    num(rec.tenure_months) ??
    num(rec.tenureMonths) ??
    num(meta.tenure_months);

  const status = String(
    rec.status ?? rec.Status ?? "unknown",
  ).toLowerCase();
  const terminatedOn = (rec.terminated_on as string) ?? null;

  const whRaw =
    rec.workingHours ?? rec.working_hours ?? meta.working_hours ?? null;
  const workingHours = normalizeWorkingHours(whRaw);

  const comp = extractComp(rec);
  let hourlyInr = comp.hourlyInr ?? 0;
  if (comp.hourlyInr == null && comp.annualInr != null) {
    hourlyInr =
      comp.annualInr / (workingHours.hoursPerDay * WORK_DAYS_PER_YEAR);
  }

  return {
    employeeId,
    name,
    department,
    departmentSource: hasDept ? "hrms" : "activity-fallback",
    role,
    roleCanonical: role ? canonKey(role) : null,
    tenureMonths,
    status,
    terminatedOn,
    schemaShape,
    workingHours,
    compensation: {
      kind: comp.kind,
      annualInr: comp.annualInr,
      hourlyInr,
      imputed: false,
    },
  };
}

/** Resolve duplicate employee_id (the E007 case). Rule: prefer the
 *  post-migration snake_case shape (HRMS_export_v2 is the newer schema and
 *  carries explicit annual_ctc_inr); tie-break on field completeness. The
 *  dropped record and the conflicting fields are reported, not silently lost. */
function shapeRank(s: NormalizedEmployee["schemaShape"]): number {
  return s === "snake_flat" ? 3 : s === "nested_meta" ? 2 : 1;
}

function completeness(e: NormalizedEmployee): number {
  let c = 0;
  if (e.compensation.kind !== "missing") c++;
  if (!e.workingHours.defaulted) c++;
  if (e.tenureMonths != null) c++;
  if (e.role) c++;
  if (e.department !== UNKNOWN_DEPT) c++;
  return c;
}

function conflictingFields(
  a: NormalizedEmployee,
  b: NormalizedEmployee,
): string[] {
  const f: string[] = [];
  if ((a.role ?? "") !== (b.role ?? "")) f.push("role");
  if (a.tenureMonths !== b.tenureMonths) f.push("tenureMonths");
  if (a.compensation.annualInr !== b.compensation.annualInr)
    f.push("compensation");
  if (
    a.workingHours.start !== b.workingHours.start ||
    a.workingHours.end !== b.workingHours.end ||
    a.workingHours.hoursPerDay !== b.workingHours.hoursPerDay
  )
    f.push("workingHours");
  if (a.status !== b.status) f.push("status");
  if (a.department !== b.department) f.push("department");
  return f;
}

export interface EmployeeNormalizationResult {
  employees: Map<string, NormalizedEmployee>;
  conflicts: EmployeeConflict[];
  hrmsRecords: number;
  departmentMissingInHrms: number;
}

export function normalizeEmployees(
  raw: RawEmployee[],
): EmployeeNormalizationResult {
  const built = raw.map(buildEmployee);
  const byId = new Map<string, NormalizedEmployee>();
  const conflicts: EmployeeConflict[] = [];

  for (const e of built) {
    const existing = byId.get(e.employeeId);
    if (!existing) {
      byId.set(e.employeeId, e);
      continue;
    }
    // Decide which to keep.
    const keepNew =
      shapeRank(e.schemaShape) !== shapeRank(existing.schemaShape)
        ? shapeRank(e.schemaShape) > shapeRank(existing.schemaShape)
        : completeness(e) > completeness(existing);
    const kept = keepNew ? e : existing;
    const dropped = keepNew ? existing : e;
    byId.set(e.employeeId, kept);
    conflicts.push({
      employeeId: e.employeeId,
      kept,
      dropped,
      reason:
        "Duplicate employee_id; kept the post-migration (snake_case) record, " +
        "tie-broken on field completeness.",
      conflictingFields: conflictingFields(kept, dropped),
    });
  }

  const departmentMissingInHrms = built.filter(
    (e) => e.departmentSource === "activity-fallback",
  ).length;

  return {
    employees: byId,
    conflicts,
    hrmsRecords: raw.length,
    departmentMissingInHrms,
  };
}

/** Impute hourly rate for employees with missing compensation:
 *  role median -> department median -> org median. (0 cases in the provided
 *  file, but the path exists and is reported honestly.) */
export function imputeMissingComp(
  employees: Map<string, NormalizedEmployee>,
): number {
  const known = [...employees.values()].filter(
    (e) => e.compensation.kind !== "missing",
  );
  const median = (xs: number[]): number | null => {
    if (xs.length === 0) return null;
    const s = [...xs].sort((a, b) => a - b);
    const m = Math.floor(s.length / 2);
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
  };
  const orgMed = median(known.map((e) => e.compensation.hourlyInr));
  let imputed = 0;

  for (const e of employees.values()) {
    if (e.compensation.kind !== "missing") continue;
    const roleMed = median(
      known
        .filter((k) => k.roleCanonical === e.roleCanonical)
        .map((k) => k.compensation.hourlyInr),
    );
    const deptMed = median(
      known
        .filter((k) => k.department === e.department)
        .map((k) => k.compensation.hourlyInr),
    );
    const rate = roleMed ?? deptMed ?? orgMed ?? 0;
    e.compensation = {
      kind: "imputed",
      annualInr: null,
      hourlyInr: rate,
      imputed: true,
    };
    imputed++;
  }
  return imputed;
}
