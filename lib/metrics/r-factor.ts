// Automation-realization factor R(category): of the time logged on repetitive
// work in a category, what fraction is *realistically* recoverable by
// automation (not 100% — tooling, exceptions, and oversight remain).
//
// Three defensible tiers, NOT a flat 0.6 (a flat factor cannot survive
// scrutiny: a CRM field update and a client call do not automate alike):
//   0.70  rules-based   — deterministic, structured, high straight-through rate
//   0.30  semi/assisted — AI/templates cut effort, human still in the loop
//   0.00  human         — judgment / relationship / synchronous; not recoverable
//
// The 14 categories named in the plan keep their planned tier verbatim. The
// remaining categories present in the data are assigned by the same rubric and
// justified in the README. Any unmapped category defaults to 0.00 — we never
// claim recoverable time on work we have not classified.

export type RTier = "rules" | "semi" | "human";

export const R_BY_TIER: Record<RTier, number> = {
  rules: 0.7,
  semi: 0.3,
  human: 0.0,
};

// Sensitivity band per tier (R±) for the low/base/high headline range shown in
// the methodology drawer and README. Human stays pinned at 0 (nothing to vary).
export const R_SENSITIVITY: Record<RTier, { low: number; high: number }> = {
  rules: { low: 0.5, high: 0.85 },
  semi: { low: 0.15, high: 0.5 },
  human: { low: 0.0, high: 0.0 },
};

const TIER_BY_CATEGORY: Record<string, RTier> = {
  // 0.70 rules-based
  "Data Entry": "rules",
  "CRM Updates": "rules",
  "Invoice Processing": "rules",
  Reporting: "rules",
  Reconciliation: "rules",
  "Lead Entry": "rules",
  "GST Filing Prep": "rules",
  "Status Updates": "rules",
  "Ticket Updates": "rules",
  "Calendar Mgmt": "rules", // scheduling is deterministic, high STP
  Bookkeeping: "rules", // structured ledger entry
  // 0.30 semi / assisted
  "Email Triage": "semi",
  "Internal Comms": "semi",
  "Vendor Portals": "semi",
  "Client Communication": "semi", // templated, but tone/judgment remains
  "Document Drafting": "semi", // AI-assisted, human edits/owns
  Documentation: "semi",
  Notes: "semi",
  "Deck/Slide Building": "semi",
  "Vendor Mgmt": "semi", // portal/data parts assist-able
  "Pipeline Review": "semi", // hygiene automatable, the review is judgment
  // 0.00 human
  "Client Call": "human",
  "Internal Meeting": "human",
  Research: "human",
  Uncategorized: "human", // unknown work — never assume recoverable
};

/** Tier for a canonical category. Unmapped -> "human" (0.0, conservative). */
export function tierFor(category: string): RTier {
  return TIER_BY_CATEGORY[category] ?? "human";
}

/** Base realization factor for a canonical category. */
export function rFactor(category: string): number {
  return R_BY_TIER[tierFor(category)];
}

/** Low/base/high factor for sensitivity analysis. */
export function rFactorBand(category: string): {
  low: number;
  base: number;
  high: number;
} {
  const t = tierFor(category);
  return {
    low: R_SENSITIVITY[t].low,
    base: R_BY_TIER[t],
    high: R_SENSITIVITY[t].high,
  };
}

/** Snapshot of the full table for the methodology drawer / README. */
export function rTableSnapshot(): {
  category: string;
  tier: RTier;
  r: number;
}[] {
  return Object.keys(TIER_BY_CATEGORY)
    .map((category) => ({
      category,
      tier: tierFor(category),
      r: rFactor(category),
    }))
    .sort((a, b) => b.r - a.r || a.category.localeCompare(b.category));
}
