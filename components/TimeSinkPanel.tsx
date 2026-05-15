"use client";

import { useState } from "react";
import type {
  MetricsFilter,
  TimeSinkBucket,
  TimeSinkDimension,
} from "../lib/metrics";
import { Panel, Segmented, MeterRow } from "./ui";
import { hrs, pct } from "./format";

/** Where time goes, by task / app / department. Department and task rows are
 *  click-to-filter — cross-filter #1 (department -> whole dashboard) and the
 *  task half of cross-filter #2. */
export default function TimeSinkPanel({
  byCategory,
  byApp,
  byDepartment,
  filter,
  setFilter,
}: {
  byCategory: TimeSinkBucket[];
  byApp: TimeSinkBucket[];
  byDepartment: TimeSinkBucket[];
  filter: MetricsFilter;
  setFilter: (f: MetricsFilter) => void;
}) {
  const [dim, setDim] = useState<TimeSinkDimension>("taskCategory");
  const data =
    dim === "taskCategory"
      ? byCategory
      : dim === "app"
        ? byApp
        : byDepartment;
  const max = Math.max(...data.map((d) => d.totalHrs), 1);

  const clickable = dim !== "app";
  const activeKey =
    dim === "department"
      ? filter.department
      : dim === "taskCategory"
        ? filter.taskCategory
        : null;

  const onRow = (key: string) => {
    if (dim === "department")
      setFilter({
        ...filter,
        department: filter.department === key ? null : key,
      });
    else if (dim === "taskCategory")
      setFilter({
        ...filter,
        taskCategory: filter.taskCategory === key ? null : key,
      });
  };

  return (
    <Panel
      kicker="Time sink"
      title="Where the hours go"
      right={
        <Segmented
          value={dim}
          onChange={setDim}
          options={[
            { value: "taskCategory", label: "Task" },
            { value: "app", label: "App" },
            { value: "department", label: "Dept" },
          ]}
        />
      }
    >
      <div className="mt-1 max-h-[340px] space-y-0.5 overflow-y-auto pr-1">
        {data.map((d) => (
          <MeterRow
            key={d.key}
            label={d.key}
            value={hrs(d.totalHrs)}
            sub={`· ${pct(d.repetitiveShare)} rep`}
            frac={d.totalHrs / max}
            color="var(--color-accent)"
            active={activeKey === d.key}
            onClick={clickable ? () => onRow(d.key) : undefined}
          />
        ))}
      </div>
      <p className="hairline mt-3 pt-3 text-[11px] text-ink-faint">
        {clickable
          ? "Click a row to filter the whole dashboard. “rep” = repetitive share (known booleans only)."
          : "Apps are not click-filtered. “rep” = repetitive share (known booleans only)."}
      </p>
    </Panel>
  );
}
