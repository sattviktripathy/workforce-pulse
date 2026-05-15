# Workforce Pulse

**Live:** <https://workforce-pulse-eight.vercel.app/>

A COO-facing tool that turns two dirty given files — 539 activity rows and 16
HRMS records — into auditable answers to "where are we losing time and money on
repetitive work that automation could take back?" Every number on the dashboard
clicks through to its formula and source rows; the AI assistant cites a tool
call, a row count, and the date window on every quantitative claim.

## What's in the box

1. **Dashboard** — two headline cards (hours/mo and INR/mo recoverable, with R±
   sensitivity bands), time-sink breakdown (task / app / dept toggle),
   automation-priority ranking with auditable component bars, per-employee
   drill-down with same-role peer comparison, week-over-week trend over real
   ISO weeks, anomaly card (E010 post-termination), and two cross-filters
   (dept + task) that recompute the whole view client-side.
2. **PDF export** — vector one-pager generated from the *live* filter state at
   click time (so a filtered view exports a filtered PDF).
3. **AI assistant** — Gemini grounded by function-calling over the same
   normalized aggregates the dashboard uses, so AI answers reconcile with
   dashboard cells. Multi-turn (`"break that down by department"` works),
   filter-aware (inherits the dashboard's active filter unless the user says
   "company-wide"), refuses out-of-scope questions.
4. **Methodology drawer** — formulas, R-table, excluded buckets, and the data
   window are one click away from the headline numbers.

## Data profile (verified row-by-row)

`activity_logs.csv` — 539 data rows, Oct 6 → Oct 24 2025 (**19 days, ~3 ISO
weeks W41–W43**, *not* the brief's ~4). All 539 timestamps parse across three
formats (ISO-space 377, slash DD/MM/YYYY 94, ISO-T 68). `app_used` ~50
spellings collapse to ~16 canonical; `task_category` ~62 → ~22.

`employees.json` — root key is `.employees` (**not** `.data.employees` as the
brief claims), 16 records across 3 shapes (CamelCase flat, snake flat, nested
`meta`) with 4 compensation units (salary_LPA, annual_ctc_inr, hourly_rate_inr,
meta.compensation.annual).

## Normalization & join (exact counts, never vibes)

| Rule | Count this file |
| --- | --- |
| Exact full-row duplicates dropped | **2** |
| `duration_minutes` invalid (3 blank · 1 negative · 3 outliers >480) | **7** |
| `is_repetitive` unknown (`-`, empty) | **2** |
| `app_used` → Unknown (empty/`NA`/`-`) | **4** |
| `task_category` → Uncategorized | **2** |
| Timestamps unparseable | **0** |
| HRMS-vs-CSV department mismatch | **0** |
| HRMS records → canonical (E007 conflict resolved) | 16 → **15** |
| HRMS with zero activity (E099) | **1** |
| Activity without HRMS metadata (E013) | **42 rows** |
| Unknown employee `?` quarantined | **2 rows** |
| `working_hours` null → 9.0 default (flagged) | **6** |
| Compensation imputations needed | **0** |

**E007 has two conflicting records.** I picked **record B** (snake_case,
`annual_ctc_inr` 24L, Senior AE) on the rule that the newer
HRMS_export_v2 shape with an explicit annual figure is more trustworthy than
the salary_LPA legacy shape. Both values are surfaced in the DQ panel.

**Duration outliers are flagged, not clamped.** Clamping to 480 would
fabricate work that didn't happen; dropping preserves auditability.

**Quarantine, don't fudge.** `?` rows and E013 (no HRMS) are excluded from
rupee math because no comp exists. Their hours are *reported separately* so
the recoverable-cost number is conservative and the missing hours are still
visible.

## Headline formulas

```
recoverable_hrs/mo  = Σ valid+repetitive rows  minutes × R(category)
                     ÷ 19 days × 30
recoverable_INR/mo  = Σ HRMS-joined employees  recoverable_hrs_emp × hourly_INR_emp
hourly_INR_emp      = annual_INR / (work_h/day × 260 work-days/yr)
```

**R-factor is per-category, not flat.** 0.70 rules-based (Data Entry, CRM
Updates, Invoice Processing, Reporting, Reconciliation, Lead Entry, GST Prep,
Status/Ticket Updates), 0.30 semi-assisted (Email Triage, Internal Comms,
Vendor Portals), 0.00 human-centric (Client Call, Internal Meeting, Research).
A flat 0.6 over-counts client work and under-counts repetitive entry; the
R-table is sensitivity-tested (R±0.10) and visible in the methodology drawer.

**Why "/month" off a 19-day window?** I scale the observed daily rate by 30.
The brief said ~4 weeks; the file is 3. The window dates are shown next to
every monthly number, both on the dashboard and in the PDF.

## Brief-vs-file discrepancies — handled honestly

The brief flagged ambiguity as intentional. Defensive handlers exist for every
brief-claimed case even when this specific file has zero occurrences; counts
above are reported, not hidden.

- HRMS path: brief says `.data.employees`, file uses `.employees`. Loader
  falls back: `raw.data.employees ?? raw.employees`.
- Missing department record: brief says one is missing — none in this file.
  Handler (HRMS → majority activity dept → "Unknown") exists.
- Missing compensation: brief says "some missing" — zero in this file.
  Imputation path (role → dept → org median hourly, flagged) exists.
- Window: brief ~4 weeks vs file ~3. WoW uses real ISO weeks; monthly figures
  scale and show the window.

## Automation-priority ranking

```
priority = 0.35·z(repetitive_hrs)   ← biggest hours sink
         + 0.25·z(rupee_impact)     ← weighted by salary cost
         + 0.20·z(repetitive_share) ← signal it really is repetitive
         + 0.20·z(distinct_employees) ← reach > one-person problems
```

Weights tuned for COO judgement: "how many hours, how much money, how strong
the signal, how broad the reach." Component bars are visible per row.

## Anomaly logic

**Primary:** E010 has `status: terminated` and `terminated_on: 2025-10-22`,
yet rows **87, 187, 215** in the CSV are dated 2025-10-24 under E010 — a
deprovisioning gap. Click-through to the source rows.

**Secondary:** rows where `duration_minutes > 480` (3 such rows at 999 min).

## Cuts (defended)

No auth, no database (per brief: in-memory), no role dashboards, no synthesized
rows or fields, no 7th feature. Six things done well > seven half-done.

## Stack & ops

Next.js 16 (App Router) · TypeScript · Tailwind v4 · Recharts ·
`@react-pdf/renderer` · Google Gemini `gemini-2.5-flash-lite` (free tier,
1000+ req/day; PLAN's `gemini-2.0-flash` was retired during build). Deployed
on Vercel; data files committed under `/data` and bundled into the
`/api/chat` serverless function via `outputFileTracingIncludes` so the
runtime `fs.readFile` works on the cold path.

## Run locally

```bash
npm install
echo "GEMINI_API_KEY=your_aistudio_key" > .env.local
npm test          # 60/60 — proves normalization + AI tools
npm run dev       # http://localhost:3000
```
