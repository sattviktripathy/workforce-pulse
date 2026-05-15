# Workforce Pulse

**Live:** <https://workforce-pulse-eight.vercel.app/>

Turns two dirty given files — 539 activity rows, 16 HRMS records — into
auditable answers to *"where are we losing time and money on repetitive work
automation could take back?"* Every dashboard number clicks through to its
formula and source rows; the AI cites a tool call, row count and date window on
every quantitative claim.

## What's in the box

1. **Dashboard** — two headline cards (hrs/mo + INR/mo recoverable, R± bands),
   time-sink breakdown (task/app/dept toggle), automation-priority ranking with
   auditable component bars, per-employee drill-down vs same-role peers,
   week-over-week trend over real ISO weeks, anomaly card, two cross-filters
   (dept + task) recomputed client-side.
2. **PDF export** — vector one-pager from the *live* filter state at click time.
3. **AI assistant** — Gemini grounded by function-calling over the same
   aggregates the dashboard uses; multi-turn, filter-aware, refuses
   out-of-scope.
4. **Methodology drawer** — formulas, R-table, excluded buckets and data window,
   one click from the headlines.

## How to use it (every number is one tap away)

Works with mouse or touch — mobile incognito included. **Nothing is filtered
until you drill in;** the bar under the header always names the active scope
(or says "company-wide").

- **Headline cards** — the two numbers the COO asked for. *How this is
  computed →* (on the cost card) or *Methodology & data quality →*
  (top-right) opens the drawer: every formula, the full R-table, the
  automation weights, and the data-quality ledger — rows dropped / fixed /
  flagged, employees with no metadata, metadata with no activity, the E007
  conflict with **both** values shown. `Esc` or click-away closes it. The thin
  bar under each big number is the R ± 0.10 sensitivity band.
- **Export brief (PDF) →** (top-right) — downloads a one-page executive
  summary of *exactly what is on screen now*. Filter to Finance and you get a
  Finance PDF: headline numbers + top-5 opportunities + date window + scope,
  as selectable vector text a leader can forward unedited.
- **Cross-filters** — department and task category compose independently.
  Clear one with the `×` on its chip, or *Clear all*. Everything below is live
  end-to-end — headlines, ranking, trend, people, the AI **and** the PDF all
  follow the active filter:
  - **Time sink** (toggle *Task / App / Dept* top-right): tap a **Task** or
    **Dept** row → the whole dashboard recomputes to that slice; tap it again
    to clear. App rows are read-only (apps aren't a scoping dimension).
  - **Automation ranking**: tap a row → filter to that task category. The four
    bars per row are the weighted z-score contributions (right = raises
    priority) so the rank is auditable, not a black box.
  - **Trend**: tap a legend chip → isolate and filter that category (its line
    also thickens).
- **Anomalies** — tap one to expand the exact offending source rows (row #,
  employee, IST timestamp, task, duration). E010's post-termination activity
  is expanded by default.
- **Employees** — the list is scoped to the active filter; a *no HRMS* badge
  means activity with no HRMS record (counted in hours, never in rupees). Tap
  a person for their profile, top repetitive tasks, recoverable hrs/₹, and how
  they compare to same-role peers.
- **Ask the data** (button, bottom-right) — grounded AI assistant. It
  *inherits the dashboard's active filter* (say "company-wide" to override)
  and is multi-turn — *"and break that down by department"* works as a
  follow-up. Every figure cites a tool call + row count + window; the tool
  chips are shown under each reply. `Enter` sends, `Shift+Enter` for a
  newline, suggested questions are one tap, *Clear* resets the thread.

## Data profile (verified row-by-row)

`activity_logs.csv` — 539 rows, Oct 6 → Oct 24 2025 (**19 days, ~3 ISO weeks
W41–W43**, not the brief's ~4). All 539 timestamps parse (ISO-space 377, slash
DD/MM/YYYY 94, ISO-T 68). `app_used` ~50 spellings → ~16 canonical;
`task_category` ~62 → ~22.

`employees.json` — root key `.employees` (**not** `.data.employees` as the
brief claims), 16 records in 3 shapes (CamelCase flat, snake flat, nested
`meta`), 4 comp units (salary_LPA, annual_ctc_inr, hourly_rate_inr,
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

**E007 — two conflicting records.** Picked **record B** (snake_case,
`annual_ctc_inr` 24L, Senior AE): the newer HRMS_export_v2 shape with an
explicit annual figure outranks the legacy salary_LPA shape. Both values are
surfaced in the DQ panel. **Outliers flagged, not clamped** — clamping to 480
fabricates work that didn't happen; dropping stays auditable. **Quarantine,
don't fudge** — `?` rows and E013 (no HRMS) are excluded from rupee math (no
comp); their hours are reported separately so the cost number stays
conservative and the missing hours stay visible.

## Headline formulas

```
recoverable_hrs/mo  = Σ valid+repetitive rows  minutes × R(category)
                     ÷ 19 days × 30
recoverable_INR/mo  = Σ HRMS-joined employees  recoverable_hrs_emp × hourly_INR_emp
hourly_INR_emp      = annual_INR / (work_h/day × 260 work-days/yr)
```

**R is per-category, not a flat 0.6.** 0.70 rules-based (Data Entry, CRM
Updates, Invoice Processing, Reporting, Reconciliation, Lead Entry, GST Prep,
Status/Ticket Updates) · 0.30 semi-assisted (Email Triage, Internal Comms,
Vendor Portals) · 0.00 human (Client Call, Internal Meeting, Research). A flat
0.6 over-counts client work and under-counts repetitive entry; R is
sensitivity-tested (R±0.10) in the drawer. **"/month" off 19 days** = observed
daily rate × 30, with the window dates shown beside every monthly figure.

## Brief-vs-file discrepancies — handled honestly

Ambiguity is intentional per the brief; defensive handlers exist for every
claimed case even at zero occurrences, and counts are reported, not hidden.

- HRMS path: loader falls back `raw.data.employees ?? raw.employees`.
- Missing-dept record: brief says one; **0 here**. Handler = HRMS → majority
  activity dept → "Unknown".
- Missing compensation: brief says some; **0 here**. Impute path = role → dept
  → org median hourly (flagged).
- Window: brief ~4 wks vs file ~3. WoW uses real ISO weeks; monthly figures
  scale and show the window.

## Automation-priority ranking

```
priority = 0.35·z(repetitive_hrs)   ← biggest hours sink
         + 0.25·z(rupee_impact)     ← weighted by salary cost
         + 0.20·z(repetitive_share) ← signal it really is repetitive
         + 0.20·z(distinct_employees) ← reach > one-person problems
```

Weights tuned for COO judgement — hours (the prize), money, signal strength,
reach. Every component is shown as a signed bar per row.

## Anomaly logic

**Primary:** E010 is `status: terminated`, `terminated_on 2025-10-22`, yet CSV
rows **87, 187, 215** are dated 2025-10-24 under E010 — a deprovisioning gap,
with click-through to the source rows. **Secondary:** `duration_minutes > 480`
(3 rows at 999 min).

## Cuts (defended)

No auth, no DB (brief: in-memory), no role dashboards, no synthesized
rows/fields, no 7th feature. Six things done well > seven half-done.

## Stack & ops

Next.js 16 (App Router) · TypeScript · Tailwind v4 · Recharts ·
`@react-pdf/renderer` · Google Gemini `gemini-2.5-flash-lite` (AI Studio,
billing-enabled paid tier for reliable request limits). The grounding layer is
model-independent — every tool is a pure function over the normalized dataset,
covered by the 60-test suite, so AI answers reconcile with the dashboard
cell-for-cell. Deployed on Vercel; `/data` files are committed
and bundled into the `/api/chat` function via `outputFileTracingIncludes` so
the cold-path `fs.readFile` resolves.

## Run locally

```bash
npm install
echo "GEMINI_API_KEY=your_aistudio_key" > .env.local
npm test          # 60/60 — proves normalization + AI tools
npm run dev       # http://localhost:3000
```
