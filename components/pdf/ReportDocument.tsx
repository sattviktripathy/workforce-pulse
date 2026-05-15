// Executive one-pager, generated on the client from the LIVE filter state at
// click time (not a screenshot — real vector text, forwardable, selectable).
// @react-pdf/renderer is heavy and browser-targeted, so this whole module is
// dynamically imported by ExportButton only when the user exports.

import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  pdf,
} from "@react-pdf/renderer";
import type { DashboardMetrics, MetricsFilter } from "../../lib/metrics";

// Built-in Helvetica only — no font registration, no network asset, robust on
// Vercel. Standard Helvetica has no ₹ glyph, so rupees are written "INR".
const C = {
  ink: "#0c0e12",
  dim: "#444b57",
  faint: "#8a92a0",
  line: "#d7dbe2",
  time: "#0b8f7e",
  money: "#9a6b00",
  panel: "#f5f6f8",
};

const s = StyleSheet.create({
  page: {
    paddingTop: 42,
    paddingHorizontal: 44,
    paddingBottom: 40,
    fontFamily: "Helvetica",
    fontSize: 9,
    color: C.ink,
  },
  kicker: {
    fontSize: 8,
    letterSpacing: 2,
    color: C.faint,
    fontFamily: "Helvetica-Bold",
  },
  h1: { fontSize: 20, fontFamily: "Helvetica-Bold", marginTop: 6 },
  sub: { fontSize: 9, color: C.dim, marginTop: 4 },
  banner: {
    marginTop: 14,
    padding: 8,
    backgroundColor: C.panel,
    borderRadius: 4,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  bannerText: { fontSize: 8.5, color: C.dim },
  row: { flexDirection: "row", marginTop: 16, gap: 14 },
  card: {
    flex: 1,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 6,
    padding: 14,
  },
  cardKicker: { fontSize: 7.5, letterSpacing: 1.5, color: C.faint },
  big: { fontSize: 30, fontFamily: "Helvetica-Bold", marginTop: 6 },
  cardSub: { fontSize: 8, color: C.dim, marginTop: 5 },
  band: { fontSize: 7.5, color: C.faint, marginTop: 7 },
  sectionTitle: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    marginTop: 22,
    marginBottom: 8,
  },
  th: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: C.line,
    paddingBottom: 5,
  },
  td: {
    flexDirection: "row",
    paddingVertical: 5,
    borderBottomWidth: 0.5,
    borderBottomColor: C.line,
  },
  cRank: { width: 22, color: C.faint },
  cName: { flex: 1, fontFamily: "Helvetica-Bold" },
  cNum: { width: 70, textAlign: "right" },
  cNumHead: { width: 70, textAlign: "right", color: C.faint, fontSize: 8 },
  cNameHead: { flex: 1, color: C.faint, fontSize: 8 },
  cRankHead: { width: 22, color: C.faint, fontSize: 8 },
  foot: {
    position: "absolute",
    bottom: 26,
    left: 44,
    right: 44,
    fontSize: 7.5,
    color: C.faint,
    borderTopWidth: 1,
    borderTopColor: C.line,
    paddingTop: 8,
    lineHeight: 1.5,
  },
});

const inr = (v: number) =>
  "INR " + new Intl.NumberFormat("en-IN").format(Math.round(v));
const n1 = (v: number) =>
  new Intl.NumberFormat("en-IN", { maximumFractionDigits: 1 }).format(v);

function filterLabel(f: MetricsFilter): string {
  const parts: string[] = [];
  if (f.department) parts.push(`Dept = ${f.department}`);
  if (f.taskCategory) parts.push(`Task = ${f.taskCategory}`);
  return parts.length ? parts.join("  ·  ") : "Company-wide (no filter)";
}

export interface ReportData {
  metrics: DashboardMetrics;
  generatedAt: string; // ISO
}

function ReportDoc({ data }: { data: ReportData }) {
  const { metrics, generatedAt } = data;
  const h = metrics.headline;
  const top5 = metrics.automation.slice(0, 5);

  return (
    <Document
      title="Workforce Pulse — Automation Opportunity Brief"
      author="Workforce Pulse"
    >
      <Page size="A4" style={s.page}>
        <Text style={s.kicker}>WORKFORCE PULSE</Text>
        <Text style={s.h1}>Automation Opportunity Brief</Text>
        <Text style={s.sub}>
          Where the company loses time &amp; money — and what to automate
          first.
        </Text>

        <View style={s.banner}>
          <Text style={s.bannerText}>Scope: {filterLabel(metrics.filter)}</Text>
          <Text style={s.bannerText}>
            Window {h.windowStart} to {h.windowEnd} ({h.windowDays}d)
          </Text>
        </View>

        <View style={s.row}>
          <View style={s.card}>
            <Text style={s.cardKicker}>RECOVERABLE CAPACITY / MONTH</Text>
            <Text style={[s.big, { color: C.time }]}>
              {n1(h.recoverableHrsMonth)} h
            </Text>
            <Text style={s.cardSub}>
              Across {h.repetitiveRowCount} qualifying repetitive activities.
            </Text>
            <Text style={s.band}>
              Sensitivity (R±): {n1(h.recoverableHrsMonthLow)} –{" "}
              {n1(h.recoverableHrsMonthHigh)} h
            </Text>
          </View>
          <View style={s.card}>
            <Text style={s.cardKicker}>RECOVERABLE COST / MONTH</Text>
            <Text style={[s.big, { color: C.money }]}>
              {inr(h.recoverableInrMonth)}
            </Text>
            <Text style={s.cardSub}>
              HRMS-joined employees only; uncompensated rows excluded.
            </Text>
            <Text style={s.band}>
              Sensitivity (R±): {inr(h.recoverableInrMonthLow)} –{" "}
              {inr(h.recoverableInrMonthHigh)}
            </Text>
          </View>
        </View>

        <Text style={s.sectionTitle}>Top 5 automation opportunities</Text>
        <View style={s.th}>
          <Text style={s.cRankHead}>#</Text>
          <Text style={s.cNameHead}>Task category</Text>
          <Text style={s.cNumHead}>Rep hrs</Text>
          <Text style={s.cNumHead}>Rep share</Text>
          <Text style={s.cNumHead}>INR / mo</Text>
        </View>
        {top5.length === 0 ? (
          <Text style={{ marginTop: 8, color: C.faint }}>
            No repetitive activity in this slice.
          </Text>
        ) : (
          top5.map((r, i) => (
            <View style={s.td} key={r.category}>
              <Text style={s.cRank}>{i + 1}</Text>
              <Text style={s.cName}>{r.category}</Text>
              <Text style={s.cNum}>{n1(r.repetitiveHrsWindow)} h</Text>
              <Text style={s.cNum}>
                {n1(r.repetitiveShare * 100)}%
              </Text>
              <Text style={s.cNum}>{inr(r.rupeeImpactMonth)}</Text>
            </View>
          ))
        )}

        <Text style={s.sectionTitle}>How to read this</Text>
        <Text style={{ fontSize: 8.5, color: C.dim, lineHeight: 1.6 }}>
          Recoverable hours = sum over valid &amp; repetitive activities of
          minutes x R(category), scaled from the observed {h.windowDays}-day
          window to a 30-day month. R is a tiered automation-realization factor
          (0.70 rules-based, 0.30 semi/assisted, 0.00 human) — not a flat
          guess. Rupees apply each employee&apos;s canonical hourly rate from
          HRMS. The data spans ~3 ISO weeks, not the brief&apos;s ~4; the
          window is stated rather than assumed. Priority score weights
          repetitive volume, rupee impact, breadth and intensity (z-scored).
        </Text>

        <Text style={s.foot} fixed>
          Generated {new Date(generatedAt).toLocaleString("en-IN")} from live
          dashboard state · Scope: {filterLabel(metrics.filter)} ·
          {h.excludedEmployeeIds.length > 0
            ? ` ${n1(h.excludedRecoverableHrsMonth)} h/mo from ${h.excludedEmployeeIds.join(
                ", ",
              )} counted in hours, excluded from cost.`
            : " All activity employees carry compensation."}
        </Text>
      </Page>
    </Document>
  );
}

/** Build the PDF Blob from live metrics. Called from a click handler. */
export async function generateReportBlob(
  data: ReportData,
): Promise<Blob> {
  return pdf(<ReportDoc data={data} />).toBlob();
}
