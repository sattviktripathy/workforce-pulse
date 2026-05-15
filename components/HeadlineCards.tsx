"use client";

import type { HeadlineResult } from "../lib/metrics";
import { hrs, inr, inrCompact, num1 } from "./format";

function BandTrack({
  low,
  base,
  high,
  color,
}: {
  low: number;
  base: number;
  high: number;
  color: string;
}) {
  const span = high - low || 1;
  const pos = ((base - low) / span) * 100;
  return (
    <div className="mt-4">
      <div className="relative h-1.5 rounded-full bg-line-soft">
        <div
          className="absolute inset-y-0 rounded-full opacity-30"
          style={{ left: 0, right: 0, background: color }}
        />
        <div
          className="absolute -top-1 h-3.5 w-3.5 -translate-x-1/2 rounded-full border-2 border-canvas"
          style={{ left: `${pos}%`, background: color }}
        />
      </div>
      <div className="tnum mt-1.5 flex justify-between text-[11px] text-ink-faint">
        <span>{num1(low)} low</span>
        <span>sensitivity (R±)</span>
        <span>{num1(high)} high</span>
      </div>
    </div>
  );
}

export default function HeadlineCards({
  h,
  onMethodology,
}: {
  h: HeadlineResult;
  onMethodology: () => void;
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {/* Hours */}
      <div className="panel relative overflow-hidden p-6">
        <div className="kicker">Recoverable capacity / month</div>
        <div className="mt-3 flex items-baseline gap-2">
          <span
            className="tnum text-6xl font-semibold"
            style={{ color: "var(--color-time)" }}
          >
            {num1(h.recoverableHrsMonth)}
          </span>
          <span className="text-xl text-ink-dim">hours</span>
        </div>
        <p className="mt-2 text-[13px] text-ink-dim">
          Repetitive work that automation can realistically take back, across{" "}
          {h.repetitiveRowCount} qualifying activities.
        </p>
        <BandTrack
          low={h.recoverableHrsMonthLow}
          base={h.recoverableHrsMonth}
          high={h.recoverableHrsMonthHigh}
          color="var(--color-time)"
        />
        <div className="hairline mt-4 pt-3 text-[11px] text-ink-faint">
          {h.windowStart} → {h.windowEnd} · observed {h.windowDays}d rate ×{" "}
          {h.monthDays}.{" "}
          {h.excludedRecoverableHrsMonth > 0 && (
            <>
              {hrs(h.excludedRecoverableHrsMonth)}/mo from{" "}
              {h.excludedEmployeeIds.join(", ")} (no HRMS comp) counted here,
              excluded from ₹.
            </>
          )}
        </div>
      </div>

      {/* Rupees */}
      <div className="panel relative overflow-hidden p-6">
        <div className="flex items-start justify-between">
          <div className="kicker">Recoverable cost / month</div>
          <button
            onClick={onMethodology}
            className="rounded-md border border-line bg-panel-2 px-2.5 py-1 text-[11px] text-ink-dim hover:text-ink"
          >
            How this is computed →
          </button>
        </div>
        <div className="mt-3 flex items-baseline gap-2">
          <span
            className="tnum text-6xl font-semibold"
            style={{ color: "var(--color-money)" }}
          >
            {inrCompact(h.recoverableInrMonth)}
          </span>
        </div>
        <p className="tnum mt-2 text-[13px] text-ink-dim">
          {inr(h.recoverableInrMonth)} · HRMS-joined employees only
        </p>
        <BandTrack
          low={h.recoverableInrMonthLow}
          base={h.recoverableInrMonth}
          high={h.recoverableInrMonthHigh}
          color="var(--color-money)"
        />
        <div className="hairline mt-4 pt-3 text-[11px] text-ink-faint">
          Conservative: rows without compensation contribute hours, not rupees.
          {h.quarantinedRepetitiveHrsWindow > 0 && (
            <>
              {" "}
              {num1(h.quarantinedRepetitiveHrsWindow)}h of unknown-employee
              activity quarantined.
            </>
          )}
        </div>
      </div>
    </div>
  );
}
