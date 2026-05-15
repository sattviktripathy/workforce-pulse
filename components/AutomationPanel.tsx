"use client";

import type { AutomationRow, MetricsFilter } from "../lib/metrics";
import { Panel } from "./ui";
import { hrs, inrCompact } from "./format";

const COMP = [
  { key: "repetitiveHrs", label: "Rep hrs" },
  { key: "rupeeImpact", label: "₹ impact" },
  { key: "repetitiveShare", label: "Rep share" },
  { key: "distinctEmployees", label: "Reach" },
] as const;

/** Signed contribution bar: weighted z-component, centred at 0. */
function Contribution({ value }: { value: number }) {
  const w = Math.min(Math.abs(value) / 1.2, 1) * 50; // half-width %
  const pos = value >= 0;
  return (
    <span className="relative block h-2 rounded-full bg-line-soft">
      <span className="absolute inset-y-0 left-1/2 w-px bg-line" />
      <span
        className="absolute inset-y-0 rounded-full"
        style={{
          width: `${w}%`,
          [pos ? "left" : "right"]: "50%",
          background: pos
            ? "var(--color-time)"
            : "var(--color-ink-faint)",
        }}
      />
    </span>
  );
}

export default function AutomationPanel({
  rows,
  filter,
  setFilter,
}: {
  rows: AutomationRow[];
  filter: MetricsFilter;
  setFilter: (f: MetricsFilter) => void;
}) {
  const top = rows.slice(0, 8);

  return (
    <Panel
      kicker="Automate first"
      title="Automation-priority ranking"
      right={
        <span className="text-[11px] text-ink-faint">
          0.35·hrs + 0.25·₹ + 0.20·share + 0.20·reach
        </span>
      }
    >
      <div className="mt-1 space-y-1">
        {top.map((r, i) => {
          const active = filter.taskCategory === r.category;
          return (
            <button
              key={r.category}
              onClick={() =>
                setFilter({
                  ...filter,
                  taskCategory: active ? null : r.category,
                })
              }
              className={`grid w-full grid-cols-[20px_150px_1fr_auto] items-center gap-3 rounded-md px-2 py-2 text-left transition-colors hover:bg-panel-2 ${
                active ? "bg-panel-2 ring-1 ring-line" : ""
              }`}
            >
              <span className="tnum text-[12px] text-ink-faint">
                {i + 1}
              </span>
              <span className="truncate text-[13px] font-medium text-ink">
                {r.category}
              </span>
              <span className="grid grid-cols-4 gap-2">
                {COMP.map((c) => (
                  <span key={c.key} title={`${c.label}`}>
                    <Contribution value={r.components[c.key]} />
                  </span>
                ))}
              </span>
              <span className="tnum w-32 text-right text-[12px] text-ink-dim">
                {hrs(r.repetitiveHrsWindow)} ·{" "}
                {inrCompact(r.rupeeImpactMonth)}
              </span>
            </button>
          );
        })}
      </div>
      <div className="hairline mt-3 flex items-center justify-between pt-3 text-[11px] text-ink-faint">
        <span>
          Bars = weighted z-contribution (right = raises priority). Click to
          filter.
        </span>
        <span className="flex gap-3">
          {COMP.map((c) => (
            <span key={c.key}>{c.label}</span>
          ))}
        </span>
      </div>
    </Panel>
  );
}
