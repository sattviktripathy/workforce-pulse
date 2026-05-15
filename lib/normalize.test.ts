import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { buildDataset } from "./normalize";
import { normalizeApp } from "./normalize/canon-apps";
import { normalizeCategory } from "./normalize/canon-categories";
import { normalizeRepetitive } from "./normalize/booleans";
import { normalizeDuration } from "./normalize/duration";
import { parseTimestamp } from "./normalize/timestamps";
import { normalizeWorkingHours } from "./normalize/working-hours";

const dir = path.join(process.cwd(), "data");
const csv = readFileSync(path.join(dir, "activity_logs.csv"), "utf8");
const json = JSON.parse(
  readFileSync(path.join(dir, "employees.json"), "utf8"),
);
const ds = buildDataset(csv, json);
const dq = ds.dq;

describe("unit normalizers", () => {
  it("canonicalizes app spellings (casing/ws/abbrev)", () => {
    expect(normalizeApp(" Gmail ")).toBe("Gmail");
    expect(normalizeApp("GMAIL")).toBe("Gmail");
    expect(normalizeApp("MS Excel")).toBe("Excel");
    expect(normalizeApp("Microsoft Excel")).toBe("Excel");
    expect(normalizeApp("SFDC")).toBe("Salesforce");
    expect(normalizeApp("Sales Force")).toBe("Salesforce");
    expect(normalizeApp("Google Chrome")).toBe("Chrome");
    expect(normalizeApp("ppt")).toBe("PowerPoint");
    expect(normalizeApp("")).toBe("Unknown");
    expect(normalizeApp("NA")).toBe("Unknown");
    expect(normalizeApp("-")).toBe("Unknown");
  });

  it("canonicalizes task categories", () => {
    expect(normalizeCategory("Cal Mgmt")).toBe("Calendar Mgmt");
    expect(normalizeCategory("calendar management")).toBe("Calendar Mgmt");
    expect(normalizeCategory("data-entry")).toBe("Data Entry");
    expect(normalizeCategory("DATA ENTRY")).toBe("Data Entry");
    expect(normalizeCategory("REPORTING")).toBe("Reporting");
    expect(normalizeCategory("Lead-Entry")).toBe("Lead Entry");
    expect(normalizeCategory("Recon")).toBe("Reconciliation");
    expect(normalizeCategory("Internal Communication")).toBe(
      "Internal Comms",
    );
    expect(normalizeCategory("-")).toBe("Uncategorized");
  });

  it("normalizes the 11 boolean spellings", () => {
    for (const t of ["TRUE", "true", "1", "yes", "Yes"])
      expect(normalizeRepetitive(t)).toBe("true");
    for (const f of ["FALSE", "false", "0", "no", "No"])
      expect(normalizeRepetitive(f)).toBe("false");
    expect(normalizeRepetitive("-")).toBe("unknown");
    expect(normalizeRepetitive("")).toBe("unknown");
  });

  it("validates durations (missing/nonpositive/outlier/valid)", () => {
    expect(normalizeDuration("").status).toBe("missing");
    expect(normalizeDuration("-3").status).toBe("nonpositive");
    expect(normalizeDuration("0").status).toBe("nonpositive");
    expect(normalizeDuration("999").status).toBe("outlier");
    expect(normalizeDuration("18")).toEqual({ minutes: 18, status: "valid" });
  });

  it("parses all 3 timestamp formats as IST", () => {
    expect(parseTimestamp("2025-10-08 13:46:09")?.timestampIso).toBe(
      "2025-10-08T13:46:09+05:30",
    );
    expect(parseTimestamp("2025-10-17T13:21:23")?.dateKey).toBe(
      "2025-10-17",
    );
    // slash form is DD/MM/YYYY
    const s = parseTimestamp("21/10/2025 14:44");
    expect(s?.dateKey).toBe("2025-10-21");
    expect(s?.istCivil).toBe("2025-10-21 14:44");
    expect(parseTimestamp("garbage")).toBeNull();
  });

  it("normalizes working_hours shapes", () => {
    expect(normalizeWorkingHours("9-18").hoursPerDay).toBe(9);
    expect(normalizeWorkingHours("9:30-18:30").hoursPerDay).toBe(9);
    expect(normalizeWorkingHours("10-19").hoursPerDay).toBe(9);
    expect(
      normalizeWorkingHours({ start: "09:00", end: "18:00" }).hoursPerDay,
    ).toBe(9);
    const d = normalizeWorkingHours(null);
    expect(d.defaulted).toBe(true);
    expect(d.hoursPerDay).toBe(9);
  });
});

describe("data quality report (exact counts for provided files)", () => {
  it("row + dedup counts", () => {
    expect(dq.totalRawRows).toBe(539);
    expect(dq.duplicateRowsRemoved).toBe(2);
    expect(dq.rowsAfterDedup).toBe(537);
  });

  it("duration validation buckets", () => {
    expect(dq.duration.missing).toBe(3);
    expect(dq.duration.nonpositive).toBe(1);
    expect(dq.duration.outlier).toBe(3);
    expect(dq.duration.valid).toBe(530);
  });

  it("booleans / apps / categories / timestamps", () => {
    expect(dq.booleanUnknown).toBe(2);
    expect(dq.appUnknownRows).toBe(4);
    expect(dq.categoryUncategorizedRows).toBe(2);
    expect(dq.timestampUnparseable).toBe(0);
  });

  it("unknown-employee rows are quarantined and counted", () => {
    expect(dq.unknownEmployeeRows).toBe(2);
  });

  it("HRMS reconciled; E007 duplicate resolved to record B", () => {
    expect(dq.hrmsRecords).toBe(16);
    expect(dq.canonicalEmployees).toBe(15);
    expect(dq.employeeConflicts).toHaveLength(1);
    const c = dq.employeeConflicts[0];
    expect(c.employeeId).toBe("E007");
    expect(c.kept.role).toBe("Senior Account Executive");
    expect(c.kept.compensation.annualInr).toBe(2_400_000);
    expect(c.dropped.role).toBe("Account Executive");
    expect(c.conflictingFields).toEqual(
      expect.arrayContaining([
        "role",
        "tenureMonths",
        "compensation",
        "workingHours",
      ]),
    );
  });

  it("missing employee (E013) -> activity without metadata", () => {
    expect(dq.noMetadataEmployees).toHaveLength(1);
    expect(dq.noMetadataEmployees[0]).toEqual({
      employeeId: "E013",
      activityRows: 42,
    });
  });

  it("extra employee (E099) -> metadata without activity", () => {
    expect(dq.noActivityEmployees).toEqual(["E099"]);
  });

  it("working_hours defaulted + comp imputed + dept handling", () => {
    expect(dq.workingHoursDefaulted).toBe(6);
    expect(dq.compensationImputed).toBe(0);
    expect(dq.departmentMissingInHrms).toBe(0);
    expect(dq.departmentMismatch).toBe(0);
  });

  it("date range (data spans 19 days, not the brief's 4 weeks)", () => {
    expect(dq.dateRange.start).toBe("2025-10-06");
    expect(dq.dateRange.end).toBe("2025-10-24");
    expect(dq.dateRange.days).toBe(19);
  });

  it("canonical compensation rates per unit", () => {
    const e005 = ds.employees.get("E005")!; // hourly_rate_inr 695
    expect(e005.compensation.kind).toBe("hourly_rate_inr");
    expect(e005.compensation.hourlyInr).toBe(695);
    const e001 = ds.employees.get("E001")!; // salary_LPA 20.9 -> 20.9L
    expect(e001.compensation.annualInr).toBe(2_090_000);
    const e009 = ds.employees.get("E009")!; // meta.compensation.annual
    expect(e009.compensation.kind).toBe("meta.compensation.annual");
    expect(e009.compensation.annualInr).toBe(590_000);
  });
});
