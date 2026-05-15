"use client";

import { useState } from "react";
import type { Anomaly } from "../lib/metrics";
import { Panel, Empty } from "./ui";

export default function AnomalyPanel({
  anomalies,
}: {
  anomalies: Anomaly[];
}) {
  const [open, setOpen] = useState<string | null>(
    anomalies.find((a) => a.severity === "primary")?.id ?? null,
  );

  return (
    <Panel kicker="Integrity" title="Anomalies">
      {anomalies.length === 0 ? (
        <Empty>No anomalies in this slice.</Empty>
      ) : (
        <div className="space-y-2">
          {anomalies.map((a) => {
            const isOpen = open === a.id;
            const primary = a.severity === "primary";
            return (
              <div
                key={a.id}
                className="overflow-hidden rounded-lg border border-line"
                style={
                  primary
                    ? { borderColor: "color-mix(in oklab, var(--color-alert) 45%, var(--color-line))" }
                    : undefined
                }
              >
                <button
                  onClick={() => setOpen(isOpen ? null : a.id)}
                  className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left hover:bg-panel-2"
                >
                  <span className="flex items-center gap-2">
                    <span
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{
                        background: primary
                          ? "var(--color-alert)"
                          : "var(--color-ink-faint)",
                      }}
                    />
                    <span className="text-[13px] font-medium text-ink">
                      {a.title}
                    </span>
                  </span>
                  <span className="flex items-center gap-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wider ${
                        primary
                          ? "bg-alert/15 text-alert"
                          : "bg-line text-ink-faint"
                      }`}
                    >
                      {a.severity}
                    </span>
                    <span className="text-ink-faint">
                      {isOpen ? "−" : "+"}
                    </span>
                  </span>
                </button>
                {isOpen && (
                  <div className="fp-fade border-t border-line-soft px-3 py-3">
                    <p className="text-[12px] leading-relaxed text-ink-dim">
                      {a.detail}
                    </p>
                    <div className="mt-3 overflow-hidden rounded-md border border-line">
                      <table className="tnum w-full text-left text-[11px]">
                        <thead className="bg-panel-2 text-ink-faint">
                          <tr>
                            <th className="px-2 py-1.5 font-medium">Row</th>
                            <th className="px-2 py-1.5 font-medium">Emp</th>
                            <th className="px-2 py-1.5 font-medium">
                              When (IST)
                            </th>
                            <th className="px-2 py-1.5 font-medium">Task</th>
                            <th className="px-2 py-1.5 text-right font-medium">
                              Dur
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {a.rows.map((r) => (
                            <tr
                              key={r.rowIndex}
                              className="border-t border-line-soft"
                            >
                              <td className="px-2 py-1.5 text-ink-faint">
                                #{r.rowIndex}
                              </td>
                              <td className="px-2 py-1.5">
                                {r.employeeId}
                              </td>
                              <td className="px-2 py-1.5 text-ink-dim">
                                {r.istCivil ?? r.dateKey ?? "—"}
                              </td>
                              <td className="px-2 py-1.5 text-ink-dim">
                                {r.taskCategory}
                              </td>
                              <td className="px-2 py-1.5 text-right">
                                {r.durationRaw || "—"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </Panel>
  );
}
