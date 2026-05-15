"use client";

import { useState } from "react";
import type { DashboardMetrics } from "../lib/metrics";

function slug(m: DashboardMetrics): string {
  const p: string[] = [];
  if (m.filter.department) p.push(m.filter.department);
  if (m.filter.taskCategory) p.push(m.filter.taskCategory);
  const scope = p.length
    ? p.join("-").replace(/[^a-zA-Z0-9]+/g, "-")
    : "company-wide";
  return `workforce-pulse_${scope}_${new Date()
    .toISOString()
    .slice(0, 10)}.pdf`;
}

/** Exports the dashboard exactly as filtered right now. The PDF is built from
 *  the live `metrics` prop at click time, so changing a filter and
 *  re-exporting produces a different document. The heavy PDF renderer is
 *  loaded only on click (dynamic import) — it stays out of the page bundle. */
export default function ExportButton({
  metrics,
}: {
  metrics: DashboardMetrics;
}) {
  const [state, setState] = useState<"idle" | "working" | "error">("idle");

  async function onExport() {
    setState("working");
    try {
      const { generateReportBlob } = await import(
        "./pdf/ReportDocument"
      );
      const blob = await generateReportBlob({
        metrics,
        generatedAt: new Date().toISOString(),
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = slug(metrics);
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setState("idle");
    } catch (e) {
      console.error("PDF export failed", e);
      setState("error");
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={onExport}
        disabled={state === "working"}
        className="rounded-lg border border-line bg-panel px-3 py-2 text-[12px] text-ink-dim transition-colors hover:text-ink disabled:opacity-60"
      >
        {state === "working"
          ? "Generating PDF…"
          : "Export brief (PDF) →"}
      </button>
      {state === "error" && (
        <span className="text-[11px] text-alert">
          Export failed — try again.
        </span>
      )}
    </div>
  );
}
