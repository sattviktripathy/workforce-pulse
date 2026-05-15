// Shared types for the normalized, joined dataset.
// Everything downstream (metrics, dashboard, AI, export) reads these.

export type RepetitiveValue = "true" | "false" | "unknown";

export type DurationStatus =
  | "valid"
  | "missing" // blank / non-numeric
  | "nonpositive" // <= 0 (includes negatives and zeros)
  | "outlier"; // > MAX_DURATION_MIN

/** One activity row after normalization. Raw values are kept so every
 *  aggregated number can be traced back to its source row in the UI. */
export interface NormalizedActivity {
  rowIndex: number; // 0-based index into the source CSV data rows
  employeeId: string; // canonical id, or "?" for unknown
  isUnknownEmployee: boolean; // employeeId === "?"
  departmentRaw: string; // department as logged in the CSV
  department: string; // canonical department label
  // timestamp, interpreted as IST (Asia/Kolkata, +05:30)
  timestampIso: string | null; // ISO-8601 with +05:30, null if unparseable
  istCivil: string | null; // "YYYY-MM-DD HH:mm" wall-clock in IST
  dateKey: string | null; // "YYYY-MM-DD" IST calendar date
  isoWeek: string | null; // ISO week bucket, e.g. "2025-W42"
  app: string; // canonical app name ("Unknown" if missing)
  appRaw: string;
  taskCategory: string; // canonical category ("Uncategorized" if missing)
  taskCategoryRaw: string;
  durationMinutes: number | null; // valid minutes, else null
  durationRaw: string;
  durationStatus: DurationStatus;
  isRepetitive: RepetitiveValue;
  isRepetitiveRaw: string;
  /** true when this row counts toward time/rupee aggregates:
   *  known employee + valid duration. */
  countsForMetrics: boolean;
}

export type CompensationKind =
  | "salary_LPA"
  | "annual_ctc_inr"
  | "hourly_rate_inr"
  | "meta.compensation.annual"
  | "imputed"
  | "missing";

export interface NormalizedEmployee {
  employeeId: string;
  name: string | null;
  department: string; // canonical
  departmentSource: "hrms" | "activity-fallback" | "unknown";
  role: string | null;
  roleCanonical: string | null;
  tenureMonths: number | null;
  status: string; // "active" | "terminated" | ...
  terminatedOn: string | null; // ISO date
  schemaShape: "camel_flat" | "snake_flat" | "nested_meta";
  workingHours: {
    start: string | null;
    end: string | null;
    hoursPerDay: number; // resolved (default applied if needed)
    defaulted: boolean; // true => null in source, DEFAULT_WORK_HOURS used
  };
  compensation: {
    kind: CompensationKind;
    annualInr: number | null;
    hourlyInr: number; // canonical hourly rate used for rupee math
    imputed: boolean;
  };
}

/** An E007-style duplicate: the record we kept plus the one we dropped. */
export interface EmployeeConflict {
  employeeId: string;
  kept: NormalizedEmployee;
  dropped: NormalizedEmployee;
  reason: string;
  conflictingFields: string[];
}

export interface DataQualityReport {
  totalRawRows: number;
  duplicateRowsRemoved: number;
  rowsAfterDedup: number;
  duration: {
    valid: number;
    missing: number;
    nonpositive: number;
    outlier: number;
  };
  booleanUnknown: number;
  timestampUnparseable: number;
  unknownEmployeeRows: number; // "?" rows, quarantined from joined metrics
  appUnknownRows: number;
  categoryUncategorizedRows: number;
  hrmsRecords: number;
  canonicalEmployees: number;
  employeeConflicts: EmployeeConflict[];
  // employees that appear in activity logs but have no HRMS metadata
  noMetadataEmployees: { employeeId: string; activityRows: number }[];
  // HRMS employees that never appear in activity logs
  noActivityEmployees: string[];
  workingHoursDefaulted: number; // employees with null source working_hours
  compensationImputed: number;
  departmentMissingInHrms: number;
  departmentMismatch: number; // CSV dept != HRMS dept for joined rows
  dateRange: { start: string | null; end: string | null; days: number };
}

export interface NormalizedDataset {
  activity: NormalizedActivity[]; // every row, flags intact (auditable)
  employees: Map<string, NormalizedEmployee>; // canonical id -> employee
  dq: DataQualityReport;
}
