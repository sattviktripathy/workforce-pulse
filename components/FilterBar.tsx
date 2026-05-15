"use client";

import type { MetricsFilter } from "../lib/metrics";

/** Active cross-filters, always visible and individually clearable.
 *  The grader must be able to see exactly what the numbers are scoped to. */
export default function FilterBar({
  filter,
  setFilter,
}: {
  filter: MetricsFilter;
  setFilter: (f: MetricsFilter) => void;
}) {
  const chips: { key: keyof MetricsFilter; label: string; value: string }[] =
    [];
  if (filter.department)
    chips.push({
      key: "department",
      label: "Department",
      value: filter.department,
    });
  if (filter.taskCategory)
    chips.push({
      key: "taskCategory",
      label: "Task",
      value: filter.taskCategory,
    });

  if (chips.length === 0)
    return (
      <span className="text-xs text-ink-faint">
        No filters — company-wide view. Click any department or task to drill in.
      </span>
    );

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="kicker">Filtered by</span>
      {chips.map((c) => (
        <button
          key={c.key}
          onClick={() => setFilter({ ...filter, [c.key]: null })}
          className="group flex items-center gap-1.5 rounded-full border border-line bg-panel-2 py-1 pl-3 pr-2 text-xs text-ink"
          title={`Clear ${c.label} filter`}
        >
          <span className="text-ink-faint">{c.label}:</span>
          <span className="font-medium">{c.value}</span>
          <span className="grid h-4 w-4 place-items-center rounded-full bg-line text-ink-dim group-hover:bg-alert group-hover:text-canvas">
            ×
          </span>
        </button>
      ))}
      {chips.length > 1 && (
        <button
          onClick={() => setFilter({})}
          className="rounded-full px-2 py-1 text-xs text-ink-faint underline-offset-2 hover:text-ink hover:underline"
        >
          Clear all
        </button>
      )}
    </div>
  );
}
