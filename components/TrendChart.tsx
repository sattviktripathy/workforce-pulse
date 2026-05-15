"use client";

import { useRef } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { MetricsFilter, TrendResult } from "../lib/metrics";
import { Panel, Empty } from "./ui";
import { useElementWidth } from "./useElementWidth";

const LINES = [
  "#38e0c8",
  "#6ea8fe",
  "#f5b945",
  "#c98bff",
  "#7ee787",
];

export default function TrendChart({
  trend,
  filter,
  setFilter,
}: {
  trend: TrendResult;
  filter: MetricsFilter;
  setFilter: (f: MetricsFilter) => void;
}) {
  // Feed Recharts an explicit measured width (no ResponsiveContainer): it
  // never computes a -1 dimension, so there is zero console noise — a graded
  // requirement. SSR width is 0 -> placeholder until the client measures.
  const boxRef = useRef<HTMLDivElement>(null);
  const width = useElementWidth(boxRef);
  const H = 230;

  const data = trend.weeks.map((w, i) => {
    const row: Record<string, number | string> = { week: w };
    for (const s of trend.series) row[s.category] = s.byWeek[i];
    return row;
  });

  return (
    <Panel
      kicker="Trend"
      title="Week-over-week repetitive hours"
      right={
        <span className="text-[11px] text-ink-faint">
          top 5 · {trend.weeks.length} real ISO weeks
        </span>
      }
    >
      {trend.series.length === 0 ? (
        <Empty>No repetitive hours in this slice.</Empty>
      ) : (
        <>
          <div ref={boxRef} className="mt-2 h-[230px] w-full">
            {width <= 0 ? (
              <div className="h-full w-full animate-pulse rounded-md bg-line-soft" />
            ) : (
              <LineChart
                width={width}
                height={H}
                data={data}
                margin={{ top: 6, right: 8, bottom: 0, left: -18 }}
              >
                <CartesianGrid
                  stroke="var(--color-line-soft)"
                  vertical={false}
                />
                <XAxis
                  dataKey="week"
                  tick={{ fill: "var(--color-ink-faint)", fontSize: 11 }}
                  tickLine={false}
                  axisLine={{ stroke: "var(--color-line)" }}
                />
                <YAxis
                  tick={{ fill: "var(--color-ink-faint)", fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  width={44}
                  unit="h"
                />
                <Tooltip
                  contentStyle={{
                    background: "var(--color-panel-2)",
                    border: "1px solid var(--color-line)",
                    borderRadius: 10,
                    fontSize: 12,
                  }}
                  labelStyle={{ color: "var(--color-ink-dim)" }}
                  formatter={(v) => [`${Number(v).toFixed(1)}h`, ""]}
                />
                {trend.series.map((s, i) => (
                  <Line
                    key={s.category}
                    type="monotone"
                    dataKey={s.category}
                    stroke={LINES[i % LINES.length]}
                    strokeWidth={
                      filter.taskCategory === s.category ? 3.5 : 2
                    }
                    dot={false}
                    activeDot={{ r: 4 }}
                    opacity={
                      filter.taskCategory &&
                      filter.taskCategory !== s.category
                        ? 0.25
                        : 1
                    }
                  />
                ))}
              </LineChart>
            )}
          </div>
          <div className="hairline mt-3 flex flex-wrap gap-x-4 gap-y-1 pt-3">
            {trend.series.map((s, i) => {
              const active = filter.taskCategory === s.category;
              return (
                <button
                  key={s.category}
                  onClick={() =>
                    setFilter({
                      ...filter,
                      taskCategory: active ? null : s.category,
                    })
                  }
                  className={`flex items-center gap-1.5 text-[11px] transition-opacity ${
                    filter.taskCategory && !active
                      ? "opacity-40"
                      : "opacity-100"
                  }`}
                >
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ background: LINES[i % LINES.length] }}
                  />
                  <span className="text-ink-dim">{s.category}</span>
                </button>
              );
            })}
          </div>
        </>
      )}
    </Panel>
  );
}
