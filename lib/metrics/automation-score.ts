import type { NormalizedDataset } from "../types";
import {
  EMPTY_FILTER,
  type MetricsFilter,
  minutesToHours,
  repetitiveRows,
  metricRows,
  zScores,
} from "./filter";
import { rFactor } from "./r-factor";

const MONTH_DAYS = 30;

// Weights: repetitive volume dominates (it is the automation prize), rupee
// impact next (ties effort to money), then breadth and intensity. Justified
// in the README; component bars expose every term so the rank is auditable.
export const SCORE_WEIGHTS = {
  repetitiveHrs: 0.35,
  repetitiveShare: 0.2,
  distinctEmployees: 0.2,
  rupeeImpact: 0.25,
} as const;

export interface AutomationRow {
  category: string;
  repetitiveHrsWindow: number;
  repetitiveShare: number;
  distinctEmployees: number;
  rupeeImpactMonth: number;
  r: number;
  components: {
    repetitiveHrs: number; // weighted z contributions
    repetitiveShare: number;
    distinctEmployees: number;
    rupeeImpact: number;
  };
  score: number;
}

/** Automation-priority ranking by task category.
 *  score = 0.35 z(rep_hrs) + 0.20 z(rep_share) + 0.20 z(distinct_emp)
 *        + 0.25 z(rupee_impact).  Sorted desc. */
export function automationRanking(
  ds: NormalizedDataset,
  filter: MetricsFilter = EMPTY_FILTER,
): AutomationRow[] {
  const windowDays = Math.max(ds.dq.dateRange.days, 1);
  const monthScale = MONTH_DAYS / windowDays;

  const agg = new Map<
    string,
    { repMin: number; knownMin: number; emps: Set<string>; recInr: number }
  >();

  // repetitive-share denominator needs non-repetitive known rows too.
  for (const a of metricRows(ds, filter)) {
    if (a.isRepetitive === "unknown") continue;
    let g = agg.get(a.taskCategory);
    if (!g) {
      g = { repMin: 0, knownMin: 0, emps: new Set(), recInr: 0 };
      agg.set(a.taskCategory, g);
    }
    g.knownMin += a.durationMinutes ?? 0;
  }
  for (const a of repetitiveRows(ds, filter)) {
    const g = agg.get(a.taskCategory)!;
    const min = a.durationMinutes ?? 0;
    g.repMin += min;
    g.emps.add(a.employeeId);
    const emp = ds.employees.get(a.employeeId);
    if (emp) {
      g.recInr +=
        minutesToHours(min * rFactor(a.taskCategory)) *
        monthScale *
        emp.compensation.hourlyInr;
    }
  }

  const cats = [...agg.keys()];
  const repHrs = cats.map((c) =>
    minutesToHours(agg.get(c)!.repMin),
  );
  const share = cats.map((c) => {
    const g = agg.get(c)!;
    return g.knownMin > 0 ? g.repMin / g.knownMin : 0;
  });
  const distinct = cats.map((c) => agg.get(c)!.emps.size);
  const rupee = cats.map((c) => agg.get(c)!.recInr);

  const zRep = zScores(repHrs);
  const zShare = zScores(share);
  const zDist = zScores(distinct);
  const zRupee = zScores(rupee);

  return cats
    .map((category, i) => {
      const components = {
        repetitiveHrs: SCORE_WEIGHTS.repetitiveHrs * zRep[i],
        repetitiveShare: SCORE_WEIGHTS.repetitiveShare * zShare[i],
        distinctEmployees: SCORE_WEIGHTS.distinctEmployees * zDist[i],
        rupeeImpact: SCORE_WEIGHTS.rupeeImpact * zRupee[i],
      };
      return {
        category,
        repetitiveHrsWindow: repHrs[i],
        repetitiveShare: share[i],
        distinctEmployees: distinct[i],
        rupeeImpactMonth: rupee[i],
        r: rFactor(category),
        components,
        score:
          components.repetitiveHrs +
          components.repetitiveShare +
          components.distinctEmployees +
          components.rupeeImpact,
      };
    })
    .sort((a, b) => b.score - a.score);
}
