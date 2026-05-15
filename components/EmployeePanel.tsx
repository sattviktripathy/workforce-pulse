"use client";

import { useMemo, useState } from "react";
import type { NormalizedDataset } from "../lib/types";
import {
  employeeDrilldown,
  employeeRanking,
  type MetricsFilter,
} from "../lib/metrics";
import { Panel, Empty } from "./ui";
import { hrs, inr, inrCompact, signed1 } from "./format";

export default function EmployeePanel({
  ds,
  filter,
}: {
  ds: NormalizedDataset;
  filter: MetricsFilter;
}) {
  const rows = useMemo(() => employeeRanking(ds, filter), [ds, filter]);
  const [sel, setSel] = useState<string | null>(null);
  const drill = useMemo(
    () => (sel ? employeeDrilldown(ds, sel, filter) : null),
    [ds, sel, filter],
  );

  return (
    <Panel
      kicker="People"
      title="Employees"
      right={
        <span className="text-[11px] text-ink-faint">
          {rows.length} in view
          {filter.taskCategory ? ` · ${filter.taskCategory}` : ""}
        </span>
      }
    >
      {rows.length === 0 ? (
        <Empty>No employees match this filter.</Empty>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[1.15fr_1fr]">
          {/* list */}
          <div className="max-h-[360px] overflow-y-auto pr-1">
            <table className="w-full text-left text-[12px]">
              <thead className="sticky top-0 bg-panel text-ink-faint">
                <tr className="border-b border-line">
                  <th className="py-2 pr-2 font-medium">Employee</th>
                  <th className="py-2 pr-2 font-medium">Dept</th>
                  <th className="tnum py-2 pr-2 text-right font-medium">
                    Rep
                  </th>
                  <th className="tnum py-2 text-right font-medium">
                    ₹/mo
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr
                    key={r.employeeId}
                    onClick={() =>
                      setSel(sel === r.employeeId ? null : r.employeeId)
                    }
                    className={`cursor-pointer border-b border-line-soft transition-colors hover:bg-panel-2 ${
                      sel === r.employeeId ? "bg-panel-2" : ""
                    }`}
                  >
                    <td className="py-2 pr-2">
                      <span className="font-medium text-ink">
                        {r.employeeId}
                      </span>
                      {!r.hasMetadata && (
                        <span
                          className="ml-1.5 rounded bg-line px-1 py-0.5 text-[9px] uppercase tracking-wide text-ink-faint"
                          title="Activity without HRMS metadata — excluded from ₹"
                        >
                          no HRMS
                        </span>
                      )}
                    </td>
                    <td className="py-2 pr-2 text-ink-dim">
                      {r.department}
                    </td>
                    <td className="tnum py-2 pr-2 text-right text-ink-dim">
                      {hrs(r.repetitiveHrs)}
                    </td>
                    <td className="tnum py-2 text-right text-ink">
                      {r.recoverableInrMonth == null
                        ? "—"
                        : inrCompact(r.recoverableInrMonth)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* drilldown */}
          <div className="rounded-lg border border-line bg-panel-2 p-4">
            {!drill ? (
              <div className="flex h-full min-h-48 items-center justify-center text-center text-[12px] text-ink-faint">
                Select an employee for profile, top repetitive tasks, and a
                same-role peer comparison.
              </div>
            ) : (
              <div className="fp-fade">
                <div className="flex items-baseline justify-between">
                  <h3 className="text-[15px] font-semibold text-ink">
                    {drill.employeeId}
                    {drill.profile?.name && (
                      <span className="ml-2 text-[12px] font-normal text-ink-faint">
                        {drill.profile.name}
                      </span>
                    )}
                  </h3>
                  {drill.profile?.status === "terminated" && (
                    <span className="rounded-full bg-alert/15 px-2 py-0.5 text-[10px] uppercase tracking-wider text-alert">
                      terminated
                    </span>
                  )}
                </div>
                <div className="mt-1 text-[12px] text-ink-dim">
                  {drill.profile?.role ?? "Role unknown"} ·{" "}
                  {drill.profile?.department ?? "—"}
                  {drill.profile &&
                    drill.profile.tenureMonths != null &&
                    ` · ${drill.profile.tenureMonths} mo tenure`}
                </div>

                <div className="tnum mt-3 grid grid-cols-3 gap-2 text-center">
                  <Kpi
                    k="Rep hrs"
                    v={hrs(drill.repetitiveHrs)}
                  />
                  <Kpi
                    k="Rec hrs/mo"
                    v={hrs(drill.recoverableHrsMonth)}
                  />
                  <Kpi
                    k="Rec ₹/mo"
                    v={
                      drill.recoverableInrMonth == null
                        ? "—"
                        : inr(drill.recoverableInrMonth)
                    }
                  />
                </div>

                <div className="mt-4">
                  <div className="kicker">Top repetitive tasks</div>
                  <div className="mt-2 space-y-1">
                    {drill.topRepetitiveTasks.length === 0 ? (
                      <p className="text-[12px] text-ink-faint">
                        No repetitive activity.
                      </p>
                    ) : (
                      drill.topRepetitiveTasks.map((t) => (
                        <div
                          key={t.category}
                          className="flex justify-between text-[12px]"
                        >
                          <span className="text-ink-dim">
                            {t.category}
                          </span>
                          <span className="tnum text-ink">
                            {hrs(t.repetitiveHrs)}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div className="hairline mt-4 pt-3">
                  <div className="kicker">vs same-role peers</div>
                  {drill.peers.peerCount === 0 ? (
                    <p className="mt-1 text-[12px] text-ink-faint">
                      {drill.hasMetadata
                        ? "No same-role peers in HRMS."
                        : "No HRMS metadata — peer set unavailable."}
                    </p>
                  ) : (
                    <p className="mt-1 text-[12px] text-ink-dim">
                      {drill.peers.peerCount} peer
                      {drill.peers.peerCount > 1 ? "s" : ""} avg{" "}
                      <span className="tnum text-ink">
                        {hrs(drill.peers.peerAvgRepetitiveHrs)}
                      </span>{" "}
                      repetitive ·{" "}
                      <span
                        className="tnum"
                        style={{
                          color:
                            drill.peers.deltaHrs > 0
                              ? "var(--color-money)"
                              : "var(--color-time)",
                        }}
                      >
                        {signed1(drill.peers.deltaHrs)}h
                      </span>{" "}
                      vs peers
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </Panel>
  );
}

function Kpi({ k, v }: { k: string; v: string }) {
  return (
    <div className="rounded-md border border-line bg-panel px-2 py-2">
      <div className="text-[9px] uppercase tracking-wider text-ink-faint">
        {k}
      </div>
      <div className="mt-0.5 text-[13px] text-ink">{v}</div>
    </div>
  );
}
