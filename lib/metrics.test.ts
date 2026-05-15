import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { buildDataset } from "./normalize";
import {
  computeDashboard,
  computeHeadline,
  automationRanking,
  detectAnomalies,
  weekOverWeek,
  timeSink,
  employeeDrilldown,
  rFactor,
  tierFor,
  SCORE_WEIGHTS,
} from "./metrics";

const dir = path.join(process.cwd(), "data");
const csv = readFileSync(path.join(dir, "activity_logs.csv"), "utf8");
const json = JSON.parse(
  readFileSync(path.join(dir, "employees.json"), "utf8"),
);
const ds = buildDataset(csv, json);

describe("R-factor table", () => {
  it("keeps the plan's explicit tier assignments", () => {
    for (const c of [
      "Data Entry",
      "CRM Updates",
      "Invoice Processing",
      "Reporting",
      "Reconciliation",
      "Lead Entry",
      "GST Filing Prep",
      "Status Updates",
      "Ticket Updates",
    ])
      expect(rFactor(c)).toBe(0.7);
    for (const c of ["Email Triage", "Internal Comms", "Vendor Portals"])
      expect(rFactor(c)).toBe(0.3);
    for (const c of ["Client Call", "Internal Meeting", "Research"])
      expect(rFactor(c)).toBe(0.0);
  });

  it("defaults unmapped/unknown categories to 0.0 (never fabricate)", () => {
    expect(rFactor("Totally Novel Work")).toBe(0.0);
    expect(tierFor("Uncategorized")).toBe("human");
    expect(rFactor("Uncategorized")).toBe(0.0);
  });
});

describe("headline numbers (provided file)", () => {
  const h = computeHeadline(ds);

  it("scales over the real 19-day window, not the brief's 4 weeks", () => {
    expect(h.windowDays).toBe(19);
    expect(h.monthDays).toBe(30);
    expect(h.windowStart).toBe("2025-10-06");
    expect(h.windowEnd).toBe("2025-10-24");
  });

  it("recoverable hours match an independent recompute", () => {
    let recMin = 0;
    let repRows = 0;
    for (const a of ds.activity) {
      if (a.countsForMetrics && a.isRepetitive === "true") {
        recMin += (a.durationMinutes ?? 0) * rFactor(a.taskCategory);
        repRows++;
      }
    }
    const hrsWindow = recMin / 60;
    expect(h.repetitiveRowCount).toBe(repRows);
    expect(h.recoverableHrsWindow).toBeCloseTo(hrsWindow, 6);
    expect(h.recoverableHrsMonth).toBeCloseTo(
      (hrsWindow * 30) / 19,
      6,
    );
  });

  it("locks the computed headline (regression guard)", () => {
    expect(h.recoverableHrsMonth).toBeCloseTo(78.39, 1);
    expect(Math.round(h.recoverableInrMonth)).toBe(42345);
  });

  it("sensitivity band brackets the base figure", () => {
    expect(h.recoverableHrsMonthLow).toBeLessThan(h.recoverableHrsMonth);
    expect(h.recoverableHrsMonthHigh).toBeGreaterThan(
      h.recoverableHrsMonth,
    );
    expect(h.recoverableInrMonthLow).toBeLessThan(h.recoverableInrMonth);
    expect(h.recoverableInrMonthHigh).toBeGreaterThan(
      h.recoverableInrMonth,
    );
  });

  it("E013 (no HRMS) counts in hours, is excluded from rupees", () => {
    expect(h.excludedEmployeeIds).toEqual(["E013"]);
    expect(h.excludedRecoverableHrsMonth).toBeGreaterThan(0);
    // 15 canonical employees, E099 has no activity -> 14 monetised.
    expect(h.byEmployee).toHaveLength(14);
    expect(h.byEmployee.map((e) => e.employeeId)).not.toContain("E013");
    expect(h.byEmployee.map((e) => e.employeeId)).not.toContain("E099");
  });

  it('quarantines "?" repetitive minutes (reported, never monetised)', () => {
    expect(h.quarantinedRepetitiveHrsWindow).toBeGreaterThan(0);
    expect(h.byEmployee.map((e) => e.employeeId)).not.toContain("?");
  });

  it("byCategory recoverable reconciles to the headline total", () => {
    const sum = h.byCategory.reduce(
      (s, c) => s + c.recoverableHrsMonth,
      0,
    );
    expect(sum).toBeCloseTo(h.recoverableHrsMonth, 6);
  });
});

describe("time-sink aggregates", () => {
  it("covers every metric row exactly once, per dimension", () => {
    const metricRowCount = ds.activity.filter(
      (a) => a.countsForMetrics,
    ).length;
    expect(metricRowCount).toBe(528); // 530 valid - 2 "?" rows
    for (const dim of ["taskCategory", "app", "department"] as const) {
      const buckets = timeSink(ds, dim);
      expect(buckets.reduce((s, b) => s + b.rows, 0)).toBe(
        metricRowCount,
      );
    }
  });

  it("is sorted by total hours desc", () => {
    const b = timeSink(ds, "department");
    for (let i = 1; i < b.length; i++)
      expect(b[i - 1].totalHrs).toBeGreaterThanOrEqual(b[i].totalHrs);
  });
});

describe("automation-priority ranking", () => {
  const rank = automationRanking(ds);

  it("score equals the sum of its weighted components", () => {
    for (const r of rank) {
      const sum =
        r.components.repetitiveHrs +
        r.components.repetitiveShare +
        r.components.distinctEmployees +
        r.components.rupeeImpact;
      expect(r.score).toBeCloseTo(sum, 9);
    }
  });

  it("weights are the planned 0.35/0.20/0.20/0.25", () => {
    expect(SCORE_WEIGHTS).toEqual({
      repetitiveHrs: 0.35,
      repetitiveShare: 0.2,
      distinctEmployees: 0.2,
      rupeeImpact: 0.25,
    });
  });

  it("is ordered by score desc", () => {
    for (let i = 1; i < rank.length; i++)
      expect(rank[i - 1].score).toBeGreaterThanOrEqual(rank[i].score);
  });
});

describe("anomalies", () => {
  const an = detectAnomalies(ds);

  it("primary = E010 activity after termination, exactly 3 rows", () => {
    const e010 = an.find((a) => a.id === "post-termination:E010");
    expect(e010).toBeDefined();
    expect(e010!.severity).toBe("primary");
    expect(e010!.rows.map((r) => r.rowIndex)).toEqual([87, 187, 215]);
    const emp = ds.employees.get("E010")!;
    expect(emp.status).toBe("terminated");
    for (const r of e010!.rows)
      expect(r.dateKey! > emp.terminatedOn!).toBe(true);
  });

  it("secondary = the 3 implausible (>8h) duration rows", () => {
    const d = an.find((a) => a.id === "duration-outlier");
    expect(d!.severity).toBe("secondary");
    expect(d!.rows.map((r) => r.rowIndex)).toEqual([217, 350, 487]);
    for (const r of d!.rows) {
      const src = ds.activity.find((x) => x.rowIndex === r.rowIndex)!;
      expect(src.durationStatus).toBe("outlier");
    }
  });

  it("primary anomalies sort before secondary", () => {
    const firstSecondary = an.findIndex(
      (a) => a.severity === "secondary",
    );
    const lastPrimary = an
      .map((a) => a.severity)
      .lastIndexOf("primary");
    if (firstSecondary !== -1 && lastPrimary !== -1)
      expect(lastPrimary).toBeLessThan(firstSecondary);
  });
});

describe("week-over-week trend", () => {
  const t = weekOverWeek(ds);

  it("uses the 3 real ISO-week buckets", () => {
    expect(t.weeks).toEqual(["2025-W41", "2025-W42", "2025-W43"]);
  });

  it("returns the top-5 categories, each aligned to the weeks", () => {
    expect(t.series).toHaveLength(5);
    for (const s of t.series) {
      expect(s.byWeek).toHaveLength(3);
      expect(s.byWeek.reduce((a, b) => a + b, 0)).toBeCloseTo(
        s.totalHrs,
        6,
      );
    }
    for (let i = 1; i < t.series.length; i++)
      expect(t.series[i - 1].totalHrs).toBeGreaterThanOrEqual(
        t.series[i].totalHrs,
      );
  });
});

describe("per-employee drill-down", () => {
  it("E013: activity-only, no comp, no same-role peers", () => {
    const e = employeeDrilldown(ds, "E013");
    expect(e.hasMetadata).toBe(false);
    expect(e.recoverableInrMonth).toBeNull();
    expect(e.activityRows).toBeGreaterThan(0);
    expect(e.repetitiveHrs).toBeGreaterThan(0);
    expect(e.peers.peerCount).toBe(0);
  });

  it("a joined employee gets profile, tasks and a rupee figure", () => {
    const top = computeHeadline(ds).byEmployee[0].employeeId;
    const e = employeeDrilldown(ds, top);
    expect(e.hasMetadata).toBe(true);
    expect(e.profile).not.toBeNull();
    expect(e.recoverableInrMonth).toBeGreaterThan(0);
    expect(e.topRepetitiveTasks.length).toBeGreaterThan(0);
  });
});

describe("filter-aware + pure", () => {
  it("a department filter recomputes a strictly smaller headline", () => {
    const all = computeHeadline(ds);
    const sales = computeHeadline(ds, { department: "Sales" });
    expect(sales.recoverableHrsMonth).toBeGreaterThan(0);
    expect(sales.recoverableHrsMonth).toBeLessThan(
      all.recoverableHrsMonth,
    );
    expect(sales.recoverableInrMonth).toBeLessThan(
      all.recoverableInrMonth,
    );
  });

  it("same dataset + filter -> identical result (deterministic)", () => {
    const a = computeDashboard(ds, { department: "Finance" });
    const b = computeDashboard(ds, { department: "Finance" });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});
