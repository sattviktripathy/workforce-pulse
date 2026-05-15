// Deterministic, grounded fallback answer for the AI chat.
//
// Smaller Gemini models sometimes end their turn after receiving a tool
// result without emitting any text. Rather than show the user an empty
// "(no reply)" bubble, the chat route falls back to this pure function: it
// formats the tool results the model already received into a short, cited
// answer. No LLM, no randomness — it can only restate numbers the grounding
// tools produced, so it can never hallucinate.

export interface ToolResult {
  name: string;
  args: unknown;
  data: unknown;
}

const asRec = (x: unknown): Record<string, unknown> =>
  x && typeof x === "object" ? (x as Record<string, unknown>) : {};
const asArr = (x: unknown): Record<string, unknown>[] =>
  Array.isArray(x) ? (x as Record<string, unknown>[]) : [];
const num = (x: unknown): number | null =>
  typeof x === "number" && Number.isFinite(x) ? x : null;
const str = (x: unknown): string | null =>
  typeof x === "string" && x.trim() ? x : null;

function n1(v: unknown): string {
  const x = num(v);
  return x == null
    ? "—"
    : new Intl.NumberFormat("en-IN", { maximumFractionDigits: 1 }).format(x);
}
function inr(v: unknown): string {
  const x = num(v);
  return x == null
    ? "—"
    : "INR " + new Intl.NumberFormat("en-IN").format(Math.round(x));
}
const scope = (d: Record<string, unknown>): string =>
  str(d.filter) ?? "company-wide";

function formatHeadline(d: Record<string, unknown>): string {
  const w = asRec(d.window);
  return `Recoverable through automation: ${n1(d.recoverableHrsMonth)} hours/month and ${inr(
    d.recoverableInrMonth,
  )}/month, from ${num(d.repetitiveRowCount) ?? "?"} qualifying repetitive rows over the ${
    num(w.days) ?? "?"
  }-day window (${str(w.start) ?? "?"} → ${str(w.end) ?? "?"}). Scope: ${scope(
    d,
  )}. [via get_headline]`;
}

function formatAutomation(d: Record<string, unknown>): string {
  const rows = asArr(d.rows);
  if (rows.length === 0)
    return `No automation candidates in scope (${scope(d)}). [via get_automation_ranking]`;
  const t = rows[0];
  return `Top automation priority: ${str(t.category) ?? "?"} — score ${n1(
    t.score,
  )}, ${n1(t.repetitiveHrsWindow)} repetitive hrs in-window, ${inr(
    t.rupeeImpactMonth,
  )}/month impact. ${rows.length} categories ranked. Scope: ${scope(
    d,
  )}. [via get_automation_ranking]`;
}

function formatPerEmployee(d: Record<string, unknown>): string {
  if (str(d.mode) === "drilldown") {
    const p = asRec(d.profile);
    return `${str(d.employeeId) ?? "?"}${
      p.name ? ` (${str(p.name)})` : ""
    }: ${n1(d.repetitiveHrs)} repetitive hrs, ${n1(
      d.recoverableHrsMonth,
    )} recoverable hrs/mo, ${
      d.recoverableInrMonth == null
        ? "no rupee figure (no HRMS comp)"
        : inr(d.recoverableInrMonth) + "/mo"
    }. Role: ${str(p.role) ?? "unknown"}, ${str(p.department) ?? "—"}. Scope: ${scope(
      d,
    )}. [via get_per_employee]`;
  }
  const rows = asArr(d.rows);
  if (rows.length === 0)
    return `No employees in scope (${scope(d)}). [via get_per_employee]`;
  const t = rows[0];
  return `Top by recoverable cost: ${str(t.employeeId) ?? "?"} (${
    str(t.department) ?? "—"
  }) — ${n1(t.repetitiveHrs)} repetitive hrs, ${
    t.recoverableInrMonth == null
      ? "no rupee figure"
      : inr(t.recoverableInrMonth) + "/mo"
  }. ${num(d.rowCount) ?? rows.length} employees in scope. Scope: ${scope(
    d,
  )}. [via get_per_employee]`;
}

function formatTimeSink(d: Record<string, unknown>): string {
  const rows = asArr(d.rows);
  const by = str(d.groupBy) ?? "category";
  if (rows.length === 0)
    return `No activity in scope (${scope(d)}). [via get_time_sink]`;
  const t = rows[0];
  const label = str(t.key) ?? str(t.employeeId) ?? "?";
  const shareNum = num(t.repetitiveShare);
  return `Largest ${by} time sink: ${label} at ${n1(
    t.totalHrs ?? t.repetitiveHrs,
  )} hours${
    shareNum != null ? ` (${n1(shareNum * 100)}% repetitive)` : ""
  }. ${rows.length} shown. Scope: ${scope(d)}. [via get_time_sink]`;
}

function formatTrend(d: Record<string, unknown>): string {
  const weeks = Array.isArray(d.weeks) ? (d.weeks as string[]) : [];
  if (str(d.mode) === "employee_repetitive_share") {
    const rows = asArr(d.rows);
    const top = rows.find((r) => num(r.delta) != null);
    const dv = top ? num(top.delta)! : null;
    return `Week-over-week repetitive-share change across ${weeks.length} ISO weeks (${weeks.join(
      ", ",
    )}). ${
      top && dv != null
        ? `Largest rise: ${str(top.employeeId) ?? "?"} (${
            dv >= 0 ? "+" : ""
          }${n1(dv * 100)} pts).`
        : "No comparable employees."
    } Scope: ${scope(d)}. [via get_trend]`;
  }
  const series = asArr(d.series);
  return `Week-over-week repetitive hours across ${weeks.length} ISO weeks (${weeks.join(
    ", ",
  )}) for the top ${series.length} categories${
    series[0] ? `, led by ${str(series[0].category) ?? "?"}` : ""
  }. Scope: ${scope(d)}. [via get_trend]`;
}

function formatAnomalies(d: Record<string, unknown>): string {
  const a = asArr(d.anomalies);
  if (a.length === 0)
    return `No anomalies in scope (${scope(d)}). [via get_anomalies]`;
  const primary = a.find((x) => str(x.severity) === "primary") ?? a[0];
  const rows = asArr(primary.rows);
  return `${a.length} anomal${
    a.length === 1 ? "y" : "ies"
  } detected. Primary: ${str(primary.title) ?? "?"}${
    rows.length
      ? ` (rows ${rows.map((r) => "#" + (num(r.rowIndex) ?? "?")).join(", ")})`
      : ""
  }. Scope: ${scope(d)}. [via get_anomalies]`;
}

function formatScope(d: Record<string, unknown>): string {
  const w = asRec(d.window);
  const tot = asRec(d.totals);
  const isoWeeks = Array.isArray(w.isoWeeks)
    ? (w.isoWeeks as string[]).length
    : "?";
  return `Data window ${str(w.start) ?? "?"} → ${str(w.end) ?? "?"} (${
    num(w.days) ?? "?"
  } days, ${isoWeeks} ISO weeks). ${
    num(tot.rowsAfterDedup) ?? "?"
  } cleaned rows, ${
    num(tot.canonicalEmployees) ?? "?"
  } canonical employees. Monthly figures scale the observed daily rate to 30 days. [via get_scope]`;
}

const FORMATTERS: Record<string, (d: Record<string, unknown>) => string> = {
  get_headline: formatHeadline,
  get_automation_ranking: formatAutomation,
  get_per_employee: formatPerEmployee,
  get_time_sink: formatTimeSink,
  get_trend: formatTrend,
  get_anomalies: formatAnomalies,
  get_scope: formatScope,
};

const PREFIX = "Grounded answer (computed directly from the dataset tools):";

/** Build a cited, deterministic answer from the tool results the model
 *  already received. Returns "" only when there is nothing to ground on. */
export function synthesizeFallback(
  question: string,
  toolResults: ToolResult[],
): string {
  if (!toolResults || toolResults.length === 0) return "";
  // The most recent usable tool result is what the model had in hand when it
  // should have answered — summarise that.
  for (let i = toolResults.length - 1; i >= 0; i--) {
    const tr = toolResults[i];
    const fmt = FORMATTERS[tr.name];
    if (!fmt) continue;
    const d = asRec(tr.data);
    if (d.error) continue;
    const body = fmt(d);
    if (body && body.trim()) return `${PREFIX}\n\n${body}`;
  }
  return "";
}
