import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { buildDataset } from "./normalize";
import { EMPTY_FILTER } from "./metrics";
import { TOOLS, dispatchTool } from "./ai/tools";
import { synthesizeFallback } from "./ai/fallback";

const dir = path.join(process.cwd(), "data");
const csv = readFileSync(path.join(dir, "activity_logs.csv"), "utf8");
const json = JSON.parse(
  readFileSync(path.join(dir, "employees.json"), "utf8"),
);
const ds = buildDataset(csv, json);

function run(name: string, args: Record<string, unknown> = {}) {
  return dispatchTool(name, args, ds, EMPTY_FILTER) as Record<string, unknown>;
}

describe("AI tools — registry", () => {
  it("exposes the 7 planned tools", () => {
    const names = TOOLS.map((t) => t.decl.name).sort();
    expect(names).toEqual(
      [
        "get_anomalies",
        "get_automation_ranking",
        "get_headline",
        "get_per_employee",
        "get_scope",
        "get_time_sink",
        "get_trend",
      ].sort(),
    );
  });

  it("dispatchTool returns an error envelope for unknown names", () => {
    const r = dispatchTool("nope", {}, ds, EMPTY_FILTER) as { error: string };
    expect(r.error).toMatch(/unknown tool/);
  });
});

describe("AI tools — get_scope", () => {
  const r = run("get_scope");

  it("reports the real 19-day window, not the brief's 4 weeks", () => {
    const w = r.window as Record<string, unknown>;
    expect(w.start).toBe("2025-10-06");
    expect(w.end).toBe("2025-10-24");
    expect(w.days).toBe(19);
    expect(w.monthDays).toBe(30);
    expect((w.isoWeeks as string[]).length).toBe(3);
  });

  it("surfaces the excluded buckets (?-rows, E013, E099, E010 post-termination)", () => {
    const e = r.excluded as Record<string, unknown>;
    expect(e.quarantinedUnknownEmployeeRows).toBe(2);
    expect(e.e013ActivityRows).toBe(42);
    expect(e.e010PostTerminationRows).toBe(3);
    expect(e.e010TerminatedOn).toBe("2025-10-22");
    expect(e.e099Ids).toContain("E099");
  });

  it("includes the R-factor table (auditable, not vibes)", () => {
    const t = r.rFactorTable as { category: string; r: number }[];
    expect(t.length).toBeGreaterThan(10);
    const dataEntry = t.find((x) => x.category === "Data Entry");
    expect(dataEntry?.r).toBe(0.7);
    const clientCall = t.find((x) => x.category === "Client Call");
    expect(clientCall?.r).toBe(0);
  });
});

describe("AI tools — get_headline", () => {
  const r = run("get_headline");

  it("matches the locked headline (78.4 hrs/mo, INR 42,345)", () => {
    expect(r.recoverableHrsMonth).toBeCloseTo(78.4, 0);
    expect(r.recoverableInrMonth).toBeCloseTo(42345, -2);
    const w = r.window as Record<string, unknown>;
    expect(w.days).toBe(19);
    expect(r.filter).toBe("company-wide (no filter)");
  });

  it("reports excluded recoverable hours separately (never silently dropped)", () => {
    const e = r.excluded as Record<string, unknown>;
    expect(e.employeeIds).toEqual(expect.arrayContaining(["E013"]));
    expect(typeof e.recoverableHrsMonthWithoutComp).toBe("number");
  });

  it("honors filter override via filter:{ department }", () => {
    const ops = dispatchTool(
      "get_headline",
      { filter: { department: "Operations" } },
      ds,
      EMPTY_FILTER,
    ) as Record<string, unknown>;
    expect(ops.filter).toMatch(/Operations/);
    expect(ops.recoverableHrsMonth as number).toBeLessThan(
      r.recoverableHrsMonth as number,
    );
  });

  it("filter:{} explicitly clears the active filter", () => {
    const cleared = dispatchTool(
      "get_headline",
      { filter: {} },
      ds,
      { department: "Operations", taskCategory: null },
    ) as Record<string, unknown>;
    expect(cleared.filter).toBe("company-wide (no filter)");
  });

  it("omitting filter inherits the active filter", () => {
    const inherited = dispatchTool(
      "get_headline",
      {},
      ds,
      { department: "Operations", taskCategory: null },
    ) as Record<string, unknown>;
    expect(inherited.filter).toMatch(/Operations/);
  });
});

describe("AI tools — get_time_sink", () => {
  it("supports group_by=category", () => {
    const r = run("get_time_sink", { group_by: "category" });
    const rows = r.rows as Record<string, unknown>[];
    expect(rows.length).toBeGreaterThan(0);
    expect(rows[0]).toHaveProperty("key");
    expect(rows[0]).toHaveProperty("totalHrs");
    expect(rows[0]).toHaveProperty("repetitiveShare");
  });

  it("supports group_by=app and group_by=department", () => {
    expect(
      (run("get_time_sink", { group_by: "app" }).rows as unknown[]).length,
    ).toBeGreaterThan(0);
    const byDept = run("get_time_sink", { group_by: "department" });
    const deptKeys = (byDept.rows as { key: string }[]).map((r) => r.key);
    expect(deptKeys).toEqual(
      expect.arrayContaining(["Finance", "Operations", "Sales"]),
    );
  });

  it("supports group_by=employee and returns one row per employee in scope", () => {
    const r = run("get_time_sink", { group_by: "employee" });
    const rows = r.rows as Record<string, unknown>[];
    expect(rows.length).toBeGreaterThan(0);
    expect(rows[0]).toHaveProperty("employeeId");
    expect(rows[0]).toHaveProperty("recoverableHrsMonth");
  });

  it("respects top_n", () => {
    const r = run("get_time_sink", { group_by: "category", top_n: 3 });
    expect((r.rows as unknown[]).length).toBeLessThanOrEqual(3);
  });
});

describe("AI tools — get_automation_ranking", () => {
  const r = run("get_automation_ranking");

  it("returns categories with score + components + weights", () => {
    const rows = r.rows as Record<string, unknown>[];
    expect(rows.length).toBeGreaterThan(0);
    const w = r.weights as Record<string, number>;
    expect(w.repetitiveHrs).toBe(0.35);
    expect(w.rupeeImpact).toBe(0.25);
    const top = rows[0];
    expect(top).toHaveProperty("category");
    expect(top).toHaveProperty("score");
    expect(top).toHaveProperty("components");
  });
});

describe("AI tools — get_per_employee", () => {
  it("list mode returns ranked employees with INR/month per person", () => {
    const r = run("get_per_employee");
    expect(r.mode).toBe("list");
    const rows = r.rows as Record<string, unknown>[];
    expect(rows.length).toBeGreaterThan(0);
    expect(rows[0]).toHaveProperty("employeeId");
    expect(rows[0]).toHaveProperty("recoverableInrMonth");
  });

  it("answers brief Q1: Finance × Email Triage per-employee with INR", () => {
    const r = dispatchTool(
      "get_per_employee",
      {
        filter: { department: "Finance", taskCategory: "Email Triage" },
      },
      ds,
      EMPTY_FILTER,
    ) as Record<string, unknown>;
    expect(r.filter).toMatch(/Finance/);
    expect(r.filter).toMatch(/Email Triage/);
    const rows = r.rows as Record<string, unknown>[];
    expect(rows.length).toBeGreaterThan(0);
    const top = rows[0];
    expect(top.department).toBe("Finance");
    expect(typeof top.recoverableInrMonth === "number" || top.recoverableInrMonth === null).toBe(true);
  });

  it("drilldown mode returns profile + top tasks + peers for a single id", () => {
    const r = run("get_per_employee", { employee_id: "E001" });
    expect(r.mode).toBe("drilldown");
    expect(r.employeeId).toBe("E001");
    expect(r).toHaveProperty("topRepetitiveTasks");
    expect(r).toHaveProperty("peers");
  });
});

describe("AI tools — get_trend", () => {
  it("default/category mode returns the 3 ISO weeks", () => {
    const r = run("get_trend");
    expect(r.mode).toBe("category");
    const weeks = r.weeks as string[];
    expect(weeks.length).toBe(3);
    expect(weeks[0]).toMatch(/^2025-W\d{2}$/);
  });

  it("employee_repetitive_share mode returns per-employee delta sorted desc (brief Q3)", () => {
    const r = run("get_trend", { mode: "employee_repetitive_share" });
    expect(r.mode).toBe("employee_repetitive_share");
    const rows = r.rows as { employeeId: string; delta: number | null }[];
    expect(rows.length).toBeGreaterThan(0);
    const numeric = rows.filter((x) => x.delta != null);
    for (let i = 1; i < numeric.length; i++) {
      expect(numeric[i - 1].delta!).toBeGreaterThanOrEqual(numeric[i].delta!);
    }
  });
});

describe("AI tools — get_anomalies", () => {
  it("flags E010 post-termination activity as primary (locked: 3 rows [87,187,215])", () => {
    const r = run("get_anomalies");
    const anomalies = r.anomalies as {
      id: string;
      severity: string;
      employeeId?: string;
      rows: { rowIndex: number }[];
    }[];
    const primary = anomalies.find((a) => a.severity === "primary");
    expect(primary?.employeeId).toBe("E010");
    expect(primary?.rows.map((x) => x.rowIndex)).toEqual([87, 187, 215]);
  });
});

describe("AI fallback — synthesizeFallback (never empty, always grounded)", () => {
  it("summarises get_automation_ranking with the top category + tool name", () => {
    const data = run("get_automation_ranking");
    const out = synthesizeFallback("highest ROI automation?", [
      { name: "get_automation_ranking", args: {}, data },
    ]);
    expect(out).not.toBe("");
    expect(out).toMatch(/get_automation_ranking/);
    const top = (data.rows as { category: string }[])[0];
    expect(out).toContain(top.category);
  });

  it("summarises get_headline with the recoverable hours and INR", () => {
    const data = run("get_headline");
    const out = synthesizeFallback("how much can we recover?", [
      { name: "get_headline", args: {}, data },
    ]);
    expect(out).not.toBe("");
    expect(out).toMatch(/get_headline/);
    expect(out).toMatch(/hours\/month/);
    expect(out).toMatch(/INR/);
  });

  it("summarises get_per_employee list with the top employee id", () => {
    const data = run("get_per_employee");
    const out = synthesizeFallback("who costs the most?", [
      { name: "get_per_employee", args: {}, data },
    ]);
    expect(out).not.toBe("");
    expect(out).toMatch(/get_per_employee/);
    const top = (data.rows as { employeeId: string }[])[0];
    expect(out).toContain(top.employeeId);
  });

  it("uses the most recent usable tool result and cites it", () => {
    const h = run("get_headline");
    const a = run("get_automation_ranking");
    const out = synthesizeFallback("q", [
      { name: "get_headline", args: {}, data: h },
      { name: "get_automation_ranking", args: {}, data: a },
    ]);
    expect(out).toMatch(/get_automation_ranking/);
  });

  it("skips error envelopes and grounds on the last good result", () => {
    const good = run("get_headline");
    const out = synthesizeFallback("q", [
      { name: "get_headline", args: {}, data: good },
      { name: "get_time_sink", args: {}, data: { error: "tool failed" } },
    ]);
    expect(out).toMatch(/get_headline/);
    expect(out).not.toBe("");
  });

  it("returns empty string only when there is nothing to ground on", () => {
    expect(synthesizeFallback("q", [])).toBe("");
  });
});
