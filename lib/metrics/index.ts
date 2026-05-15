// Metrics engine: pure, filter-aware functions over the normalized dataset.
// Every figure here is traceable to source rows (the dashboard, AI layer and
// PDF export all read these — no recomputation, one source of truth).

import type { NormalizedDataset } from "../types";
import { EMPTY_FILTER, type MetricsFilter } from "./filter";
import { computeHeadline, type HeadlineResult } from "./headline";
import { timeSink, type TimeSinkBucket } from "./aggregates";
import {
  automationRanking,
  type AutomationRow,
} from "./automation-score";
import { detectAnomalies, type Anomaly } from "./anomalies";
import { weekOverWeek, type TrendResult } from "./trends";

export * from "./filter";
export * from "./r-factor";
export * from "./headline";
export * from "./aggregates";
export * from "./automation-score";
export * from "./anomalies";
export * from "./trends";
export * from "./per-employee";

export interface DashboardMetrics {
  filter: MetricsFilter;
  headline: HeadlineResult;
  timeSinkByCategory: TimeSinkBucket[];
  timeSinkByApp: TimeSinkBucket[];
  timeSinkByDepartment: TimeSinkBucket[];
  automation: AutomationRow[];
  trend: TrendResult;
  anomalies: Anomaly[];
}

/** One call that recomputes the whole dashboard for a filter state.
 *  Used by the page (server), the export, and as the AI layer's grounding. */
export function computeDashboard(
  ds: NormalizedDataset,
  filter: MetricsFilter = EMPTY_FILTER,
): DashboardMetrics {
  return {
    filter,
    headline: computeHeadline(ds, filter),
    timeSinkByCategory: timeSink(ds, "taskCategory", filter),
    timeSinkByApp: timeSink(ds, "app", filter),
    timeSinkByDepartment: timeSink(ds, "department", filter),
    automation: automationRanking(ds, filter),
    trend: weekOverWeek(ds, 5, filter),
    anomalies: detectAnomalies(ds, filter),
  };
}
