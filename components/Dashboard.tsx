"use client";

import { useMemo, useState } from "react";
import type { DatasetSnapshot } from "../lib/snapshot";
import { fromSnapshot } from "../lib/snapshot";
import { computeDashboard, type MetricsFilter } from "../lib/metrics";
import FilterBar from "./FilterBar";
import HeadlineCards from "./HeadlineCards";
import MethodologyDrawer from "./MethodologyDrawer";
import TimeSinkPanel from "./TimeSinkPanel";
import AutomationPanel from "./AutomationPanel";
import TrendChart from "./TrendChart";
import AnomalyPanel from "./AnomalyPanel";
import EmployeePanel from "./EmployeePanel";
import ExportButton from "./ExportButton";
import Chat from "./Chat";

export default function Dashboard({
  snapshot,
}: {
  snapshot: DatasetSnapshot;
}) {
  // Rebuild the dataset once; recompute every metric from it whenever the
  // cross-filter changes. One pure engine, one source of truth, instant.
  const ds = useMemo(() => fromSnapshot(snapshot), [snapshot]);
  const [filter, setFilter] = useState<MetricsFilter>({});
  const [drawer, setDrawer] = useState(false);
  const m = useMemo(
    () => computeDashboard(ds, filter),
    [ds, filter],
  );

  const dq = ds.dq;

  return (
    <div className="mx-auto max-w-[1280px] px-5 py-7">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="kicker">Workforce Pulse</div>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">
            Where the company loses time &amp; money
          </h1>
          <p className="mt-1 text-[13px] text-ink-dim">
            {dq.rowsAfterDedup} cleaned activities ·{" "}
            {dq.canonicalEmployees} employees ·{" "}
            {dq.dateRange.start} → {dq.dateRange.end}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setDrawer(true)}
            className="rounded-lg border border-line bg-panel px-3 py-2 text-[12px] text-ink-dim hover:text-ink"
          >
            Methodology &amp; data quality →
          </button>
          <ExportButton metrics={m} />
        </div>
      </header>

      <div className="mt-4 flex min-h-8 items-center">
        <FilterBar filter={filter} setFilter={setFilter} />
      </div>

      <main className="mt-4 space-y-4">
        <HeadlineCards h={m.headline} onMethodology={() => setDrawer(true)} />

        <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
          <TimeSinkPanel
            byCategory={m.timeSinkByCategory}
            byApp={m.timeSinkByApp}
            byDepartment={m.timeSinkByDepartment}
            filter={filter}
            setFilter={setFilter}
          />
          <AnomalyPanel anomalies={m.anomalies} />
        </div>

        <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
          <AutomationPanel
            rows={m.automation}
            filter={filter}
            setFilter={setFilter}
          />
          <TrendChart
            trend={m.trend}
            filter={filter}
            setFilter={setFilter}
          />
        </div>

        <EmployeePanel ds={ds} filter={filter} />
      </main>

      <footer className="mt-8 text-center text-[11px] text-ink-faint">
        Data span is {dq.dateRange.days} days (~3 ISO weeks), not the
        brief&apos;s ~4 — monthly figures scale the observed daily rate and the
        window is always shown. Numbers, not vibes.
      </footer>

      <MethodologyDrawer
        open={drawer}
        onClose={() => setDrawer(false)}
        h={m.headline}
      />

      <Chat filter={filter} />
    </div>
  );
}
