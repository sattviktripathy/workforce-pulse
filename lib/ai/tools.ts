// Function-calling tools for the Gemini chat layer.
// Pure functions over the normalized dataset; no Gemini imports needed in the
// handlers. Every tool's output is JSON-serializable and reuses lib/metrics so
// the AI's numbers reconcile with the dashboard cell-for-cell.

import { SchemaType, type FunctionDeclaration } from "@google/generative-ai";
import type { NormalizedActivity, NormalizedDataset } from "../types";
import { EMPTY_FILTER, type MetricsFilter } from "../metrics/filter";
import { computeHeadline } from "../metrics/headline";
import { timeSink, type TimeSinkDimension } from "../metrics/aggregates";
import { automationRanking } from "../metrics/automation-score";
import { detectAnomalies } from "../metrics/anomalies";
import { weekOverWeek } from "../metrics/trends";
import {
  employeeDrilldown,
  employeeRanking,
} from "../metrics/per-employee";
import { rTableSnapshot } from "../metrics/r-factor";

const MONTH_DAYS = 30;

// ---- shared filter schema ----------------------------------------------

const FILTER_SCHEMA = {
  type: SchemaType.OBJECT,
  description:
    "Override the dashboard's active filter. Omit to inherit the current filter; pass an empty object for company-wide.",
  properties: {
    department: {
      type: SchemaType.STRING,
      description:
        "Canonical department: Operations, Finance, Sales, Customer Support, HR, Marketing.",
    },
    taskCategory: {
      type: SchemaType.STRING,
      description:
        "Canonical task category, e.g. 'Email Triage', 'Data Entry', 'CRM Updates', 'Client Call'.",
    },
  },
} as const;

function resolveFilter(
  args: Record<string, unknown> | undefined,
  active: MetricsFilter,
): MetricsFilter {
  if (
    args &&
    Object.prototype.hasOwnProperty.call(args, "filter") &&
    args.filter
  ) {
    const f = args.filter as MetricsFilter;
    return { department: f.department ?? null, taskCategory: f.taskCategory ?? null };
  }
  if (
    args &&
    Object.prototype.hasOwnProperty.call(args, "filter") &&
    !args.filter
  ) {
    return EMPTY_FILTER;
  }
  return active;
}

function describeFilter(f: MetricsFilter): string {
  const parts: string[] = [];
  if (f.department) parts.push(`department=${f.department}`);
  if (f.taskCategory) parts.push(`taskCategory=${f.taskCategory}`);
  return parts.length === 0 ? "company-wide (no filter)" : parts.join(", ");
}

function topN<T>(arr: T[], n: number | undefined, fallback = 10): T[] {
  const k = n && n > 0 ? Math.floor(n) : fallback;
  return arr.slice(0, k);
}

// ---- tool definitions --------------------------------------------------

export interface ToolDef {
  decl: FunctionDeclaration;
  handler: (
    args: Record<string, unknown>,
    ds: NormalizedDataset,
    activeFilter: MetricsFilter,
  ) => unknown;
}

const getScope: ToolDef = {
  decl: {
    name: "get_scope",
    description:
      "Return the dataset window, totals, excluded buckets and the R-factor table. Call this once when you need to ground a methodology question or cite the data window.",
    parameters: { type: SchemaType.OBJECT, properties: {} },
  },
  handler: (_args, ds) => {
    const isoWeeks = [
      ...new Set(
        ds.activity
          .map((a) => a.isoWeek)
          .filter((w): w is string => w != null),
      ),
    ].sort();
    const quarantined = ds.activity.filter((a) => a.isUnknownEmployee).length;
    const e013Rows = ds.activity.filter((a) => a.employeeId === "E013").length;
    const e099Ids = ds.dq.noActivityEmployees;
    const e010Term = [...ds.employees.values()].find(
      (e) => e.status === "terminated" && e.terminatedOn,
    );
    const postTermRows = e010Term
      ? ds.activity.filter(
          (a) =>
            a.employeeId === e010Term.employeeId &&
            a.dateKey != null &&
            a.dateKey > (e010Term.terminatedOn ?? ""),
        ).length
      : 0;
    return {
      window: {
        start: ds.dq.dateRange.start,
        end: ds.dq.dateRange.end,
        days: ds.dq.dateRange.days,
        monthDays: MONTH_DAYS,
        isoWeeks,
      },
      totals: {
        totalRawRows: ds.dq.totalRawRows,
        rowsAfterDedup: ds.dq.rowsAfterDedup,
        canonicalEmployees: ds.dq.canonicalEmployees,
        hrmsRecords: ds.dq.hrmsRecords,
        validRows: ds.dq.duration.valid,
      },
      excluded: {
        quarantinedUnknownEmployeeRows: quarantined,
        e013ActivityRows: e013Rows,
        e099Ids,
        e010PostTerminationRows: postTermRows,
        e010TerminatedOn: e010Term?.terminatedOn ?? null,
      },
      rFactorTable: rTableSnapshot(),
      monthlyScaleCaveat: `Monthly figures = (window total) × (${MONTH_DAYS} / ${ds.dq.dateRange.days})`,
    };
  },
};

const getHeadline: ToolDef = {
  decl: {
    name: "get_headline",
    description:
      "Return the two headline numbers (recoverable hrs/month and INR/month) plus their sensitivity bands, the date window, excluded buckets, and top categories/employees within scope. Honors the filter.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: { filter: FILTER_SCHEMA },
    },
  },
  handler: (args, ds, active) => {
    const filter = resolveFilter(args, active);
    const h = computeHeadline(ds, filter);
    return {
      filter: describeFilter(filter),
      recoverableHrsMonth: h.recoverableHrsMonth,
      recoverableHrsMonthBand: {
        low: h.recoverableHrsMonthLow,
        high: h.recoverableHrsMonthHigh,
      },
      recoverableInrMonth: h.recoverableInrMonth,
      recoverableInrMonthBand: {
        low: h.recoverableInrMonthLow,
        high: h.recoverableInrMonthHigh,
      },
      window: {
        start: h.windowStart,
        end: h.windowEnd,
        days: h.windowDays,
        monthDays: h.monthDays,
      },
      recoverableHrsWindow: h.recoverableHrsWindow,
      repetitiveRowCount: h.repetitiveRowCount,
      excluded: {
        recoverableHrsMonthWithoutComp: h.excludedRecoverableHrsMonth,
        employeeIds: h.excludedEmployeeIds,
        quarantinedRepetitiveHrsWindow: h.quarantinedRepetitiveHrsWindow,
      },
      topCategories: h.byCategory.slice(0, 5),
      topEmployees: h.byEmployee.slice(0, 5),
    };
  },
};

const getTimeSink: ToolDef = {
  decl: {
    name: "get_time_sink",
    description:
      "Top buckets of time spent. Group by 'category' (task), 'app', 'department', or 'employee'. Honors the filter. Returns up to top_n buckets (default 10) with hours, repetitive share, distinct employees.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        group_by: {
          type: SchemaType.STRING,
          description:
            "One of: 'category', 'app', 'department', 'employee'. Required.",
        },
        top_n: {
          type: SchemaType.NUMBER,
          description: "Max rows to return. Default 10.",
        },
        filter: FILTER_SCHEMA,
      },
      required: ["group_by"],
    },
  },
  handler: (args, ds, active) => {
    const filter = resolveFilter(args, active);
    const group_by = String(args.group_by ?? "category");
    const n = (args.top_n as number | undefined) ?? 10;

    if (group_by === "employee") {
      const rows = topN(employeeRanking(ds, filter), n, 10);
      return {
        filter: describeFilter(filter),
        groupBy: "employee",
        rowCount: rows.length,
        rows,
      };
    }
    const dim: TimeSinkDimension =
      group_by === "app"
        ? "app"
        : group_by === "department"
          ? "department"
          : "taskCategory";
    const rows = topN(timeSink(ds, dim, filter), n, 10);
    return {
      filter: describeFilter(filter),
      groupBy: group_by,
      rowCount: rows.length,
      rows,
    };
  },
};

const getAutomationRanking: ToolDef = {
  decl: {
    name: "get_automation_ranking",
    description:
      "Automation-priority ranking of task categories. Score = 0.35·z(repetitive_hrs) + 0.20·z(repetitive_share) + 0.20·z(distinct_employees) + 0.25·z(rupee_impact). Each row carries the weighted z components so the rank is auditable. Honors the filter.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        top_n: {
          type: SchemaType.NUMBER,
          description: "Max categories to return. Default 10.",
        },
        filter: FILTER_SCHEMA,
      },
    },
  },
  handler: (args, ds, active) => {
    const filter = resolveFilter(args, active);
    const rows = topN(
      automationRanking(ds, filter),
      args.top_n as number | undefined,
      10,
    );
    return {
      filter: describeFilter(filter),
      weights: {
        repetitiveHrs: 0.35,
        repetitiveShare: 0.2,
        distinctEmployees: 0.2,
        rupeeImpact: 0.25,
      },
      rowCount: rows.length,
      rows,
    };
  },
};

const getPerEmployee: ToolDef = {
  decl: {
    name: "get_per_employee",
    description:
      "Per-employee figures within the current filter scope. Pass employee_id for a single-employee drilldown (profile, top repetitive tasks, peer comparison). Omit employee_id to get a ranked list of every employee in scope with hours, recoverable hours/month and recoverable INR/month per person. Used for 'who in dept X spends the most time on task Y, and how much does it cost?' questions.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        employee_id: {
          type: SchemaType.STRING,
          description:
            "Canonical id (E001..E015, or E013 for activity-without-HRMS). Omit for ranked list.",
        },
        top_n: {
          type: SchemaType.NUMBER,
          description: "Max rows when returning the list. Default 20.",
        },
        filter: FILTER_SCHEMA,
      },
    },
  },
  handler: (args, ds, active) => {
    const filter = resolveFilter(args, active);
    const employee_id = args.employee_id as string | undefined;
    if (employee_id) {
      const d = employeeDrilldown(ds, employee_id, filter);
      return {
        filter: describeFilter(filter),
        mode: "drilldown",
        ...d,
      };
    }
    const rows = topN(
      employeeRanking(ds, filter),
      args.top_n as number | undefined,
      20,
    );
    return {
      filter: describeFilter(filter),
      mode: "list",
      rowCount: rows.length,
      rows,
    };
  },
};

const getTrend: ToolDef = {
  decl: {
    name: "get_trend",
    description:
      "Week-over-week trend across the ~3 ISO weeks in the data. mode='category' returns repetitive hours per top-5 task category by week. mode='employee_repetitive_share' returns each employee's repetitive-task share for every week plus the delta (last week − first week), sorted by delta descending — use this for 'whose repetitive share went up week-over-week' questions.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        mode: {
          type: SchemaType.STRING,
          description: "'category' (default) or 'employee_repetitive_share'.",
        },
        filter: FILTER_SCHEMA,
      },
    },
  },
  handler: (args, ds, active) => {
    const filter = resolveFilter(args, active);
    const mode = (args.mode as string) ?? "category";

    if (mode === "employee_repetitive_share") {
      return employeeRepetitiveShareTrend(ds, filter);
    }
    const t = weekOverWeek(ds, 5, filter);
    return {
      filter: describeFilter(filter),
      mode: "category",
      weeks: t.weeks,
      series: t.series,
    };
  },
};

const getAnomalies: ToolDef = {
  decl: {
    name: "get_anomalies",
    description:
      "Detected anomalies, strongest first. Primary = activity logged after an employee's termination date (E010 in this data). Secondary = implausible single-row durations (>8h, excluded from math, not clamped) and per-employee repetitive-share outliers (z>2). Each anomaly carries the exact source row indices for audit. Honors the filter.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: { filter: FILTER_SCHEMA },
    },
  },
  handler: (args, ds, active) => {
    const filter = resolveFilter(args, active);
    return {
      filter: describeFilter(filter),
      anomalies: detectAnomalies(ds, filter),
    };
  },
};

// ---- per-employee WoW repetitive-share aggregator ---------------------

function employeeRepetitiveShareTrend(
  ds: NormalizedDataset,
  filter: MetricsFilter,
) {
  const weeks = [
    ...new Set(
      ds.activity
        .map((a) => a.isoWeek)
        .filter((w): w is string => w != null),
    ),
  ].sort();
  if (weeks.length === 0) {
    return {
      filter: describeFilter(filter),
      mode: "employee_repetitive_share",
      weeks: [],
      rows: [],
    };
  }
  const weekIdx = new Map(weeks.map((w, i) => [w, i]));

  // For each employee × week: known (rep + non-rep, valid rows) and rep.
  const agg = new Map<string, { known: number[]; rep: number[] }>();
  const ensure = (id: string) => {
    let g = agg.get(id);
    if (!g) {
      g = {
        known: new Array(weeks.length).fill(0),
        rep: new Array(weeks.length).fill(0),
      };
      agg.set(id, g);
    }
    return g;
  };

  for (const a of ds.activity) {
    if (
      !a.countsForMetrics ||
      a.isoWeek == null ||
      a.isRepetitive === "unknown"
    )
      continue;
    if (filter.department && a.department !== filter.department) continue;
    if (filter.taskCategory && a.taskCategory !== filter.taskCategory) continue;
    const i = weekIdx.get(a.isoWeek)!;
    const min = a.durationMinutes ?? 0;
    const g = ensure(a.employeeId);
    g.known[i] += min;
    if (a.isRepetitive === "true") g.rep[i] += min;
  }

  type Row = {
    employeeId: string;
    department: string;
    role: string | null;
    shareByWeek: (number | null)[];
    knownMinutesByWeek: number[];
    delta: number | null;
    firstWeek: string;
    lastWeek: string;
  };

  const rows: Row[] = [];
  for (const [employeeId, g] of agg) {
    const share = g.known.map((kn, i) => (kn > 0 ? g.rep[i] / kn : null));
    const totalKnown = g.known.reduce((s, v) => s + v, 0);
    if (totalKnown === 0) continue;
    const first = share[0];
    const last = share[share.length - 1];
    const delta = first != null && last != null ? last - first : null;
    const emp = ds.employees.get(employeeId);
    rows.push({
      employeeId,
      department: emp?.department ?? "—",
      role: emp?.role ?? null,
      shareByWeek: share,
      knownMinutesByWeek: g.known,
      delta,
      firstWeek: weeks[0],
      lastWeek: weeks[weeks.length - 1],
    });
  }

  rows.sort((a, b) => {
    if (a.delta == null && b.delta == null) return 0;
    if (a.delta == null) return 1;
    if (b.delta == null) return -1;
    return b.delta - a.delta;
  });

  return {
    filter: describeFilter(filter),
    mode: "employee_repetitive_share",
    weeks,
    rows,
  };
}

// ---- exported registry -------------------------------------------------

export const TOOLS: ToolDef[] = [
  getScope,
  getHeadline,
  getTimeSink,
  getAutomationRanking,
  getPerEmployee,
  getTrend,
  getAnomalies,
];

export const TOOL_DECLARATIONS: FunctionDeclaration[] = TOOLS.map(
  (t) => t.decl,
);

export function dispatchTool(
  name: string,
  args: Record<string, unknown>,
  ds: NormalizedDataset,
  activeFilter: MetricsFilter,
): unknown {
  const t = TOOLS.find((x) => x.decl.name === name);
  if (!t) {
    return { error: `unknown tool: ${name}` };
  }
  try {
    return t.handler(args ?? {}, ds, activeFilter);
  } catch (e) {
    return {
      error: `tool ${name} failed`,
      message: e instanceof Error ? e.message : String(e),
    };
  }
}

// Re-export to keep type-only access neat in tests.
export type { NormalizedActivity };
