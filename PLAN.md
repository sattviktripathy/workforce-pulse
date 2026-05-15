# Workforce Pulse — Implementation Plan

## Context

Take-home ("Cord4 task"). Greenfield: empty dir, no git, no code. Two dirty given files:
`activity_logs (4).csv` (539 data rows), `employees.json` (16 HRMS records). Ship ONE
deployed web app: ingest+clean+join → COO dashboard → grounded multi-turn AI assistant →
live-state PDF export → methodology README. Grading weighted: **data correctness 25%**,
product judgment 20%, AI grounding 20%, design 15%, shipping 10%, methodology 10%. The
differentiator = numbers that survive scrutiny + a defensible, honest join.

User decisions locked: LLM = **Google Gemini** (free tier `gemini-2.0-flash`, AI Studio
key, no card); deploy = **Vercel**; API key **step by step** (scaffold env var now, get
free key at AI phase).

## Exact data profile (verified row-by-row — drives every rule)

**activity_logs.csv** — 539 rows; timestamps Oct 6 → Oct 24 2025 (all 539 parse, 0 fail):
- IDs: E001–E015 + literal `?` (**2 rows**, lines 60/471). **E013 = 42 rows** but absent
  from HRMS. E099 = **0** activity rows.
- timestamp formats: ISO-space 377, slash DD/MM/YYYY 94, ISO-T 68; mixed precision
  (some minute-only). Span = **19 days ≈ 3 ISO weeks** (brief says ~4 — discrepancy, see below).
- `app_used`: ~50 spellings + whitespace padding (raw `" Gmail "`); missing = `''`×2,
  `NA`×1, `-`×1 → 4 → Unknown.
- `task_category`: ~62 variants; missing = `NA`×1, `-`×1 → 2 → Uncategorized.
- `duration_minutes`: 3 blank, **1 negative (-3)**, **0 zeros**, **3 outliers (999)** → 7 invalid.
- `is_repetitive`: exactly **11 spellings** — yes/TRUE/true/1 (true), no/false/Yes? …
  precisely: `yes,TRUE,true,1` → true; `no,false,Yes→true,No→false,FALSE,0` mapped by
  case-insensitive set; `-`×2 → unknown.
- exact full-row duplicates: **2 groups, 2 extra rows** → dedup drops 2.
- CSV-vs-HRMS department mismatch: **0** (every logged dept matches HRMS).

**employees.json** — root key `.employees` (NOT `.data.employees` as brief claims), 16 records:
- 3 shapes: CamelCase flat (E001-3,7A,8,15), snake flat (E004-6,11,12,14,7B,99), nested
  `meta` (E009,E010).
- comp units: salary_LPA ×6, annual_ctc_inr ×5, hourly_rate_inr ×3, meta.compensation.annual
  ×2. **None missing/null** (brief says "some missing" → 0 here).
- department/Dept present on **all 16** (brief says one missing → 0 here).
- `workingHours/working_hours`: null ×6 (E001,E002,E008,E009,E012,E015), "9-18"/"10-19"/
  "9:30-18:30" strings, object ×2 (E004,E014).
- **E007 duplicated, conflicting**: A = Account Executive, salary_LPA 14.0, tenure 40,
  "10-19". B = Senior Account Executive, annual_ctc_inr 2,400,000, tenure 28, "9-18".
- E099 = HRMS-only (no activity). E013 = activity-only (no HRMS).
- E010 `status:terminated`, `terminated_on:2025-10-22`; has **3 activity rows after that date**.

## Brief vs file discrepancies — honest handling (graded: data sense + methodology)

"Ambiguity is intentional — make the call, defend in README." Build defensive handlers for
every brief-claimed case; **report actual counts (incl. zeros) honestly**, never claim a
phantom fix:
1. HRMS path: load `raw.data.employees ?? raw.employees` (file uses latter).
2. Missing-dept record: handler falls back (HRMS→majority activity dept→"Unknown"); README
   states "0 in provided file".
3. Missing comp: imputation path (role→dept→org median hourly, flagged); README "0 applied".
4. Duration zeros / empty+NA booleans: rules defined; README states actual occurrences (0).
5. Span: data = 19 days/~3 weeks, brief says ~4. WoW uses real ISO-week buckets (~3);
   "/month" = valid-data daily rate × 30, window dates + caveat shown in methodology drawer + README.
6. "CS" dept: canonical map includes CS↔Customer Support; file uses "Customer Support".

## Stack

Next.js 15 App Router + TypeScript + Tailwind + Recharts + `@react-pdf/renderer` + Gemini.
Normalization = pure TS lib (unit-testable, server-side, in-memory dataset).

```
/data/                  activity_logs.csv, employees.json   (given data, committed, NOT secret)
/lib/normalize/         parse, canon-maps, validators, join, dq-report
/lib/metrics/           headline, automation-score, anomalies, trends, aggregates
/lib/__tests__/         normalization correctness tests (proves the 25%)
/app/page.tsx           server: load+normalize once, pass dataset
/app/api/chat/route.ts  Gemini grounded function-calling, multi-turn
/components/             charts, filters, drilldown, methodology drawer, export, chat
README.md               methodology (<=2 pages)
.env.example            GEMINI_API_KEY=
```

## Normalization & join rules

- **app canon** (~50→~16): Outlook, Gmail, Excel, Slack, SAP, Salesforce(SFDC/Sales Force),
  Zoho, Chrome, Jira, Notion, PowerPoint(ppt), Word, Tally, WhatsApp, Zoom; trim ws;
  ``/`-`/`NA`→Unknown.
- **task_category canon** (~62→~22): casing/abbrev/hyphen merges (Cal Mgmt→Calendar Mgmt,
  Recon→Reconciliation, Invoice Proc→Invoice Processing, Lead-Entry→Lead Entry…); ambiguous
  merges documented (Deck/Slide Building merged; Documentation/Drafting/Notes kept distinct);
  `-`/`NA`→Uncategorized.
- **timestamp**: parse 3 formats (slash = DD/MM/YYYY), attach IST (Asia/Kolkata).
- **duration**: valid window `(0,480]` min. blank/non-numeric → drop+count; `<=0` →
  drop+count; `>480` → exclude (NOT clamp — clamping fabricates) + flag+count. Threshold +
  sensitivity in README/UI.
- **is_repetitive**: case-insensitive true{true,1,yes} / false{false,0,no} / unknown{-,'',na};
  repetitive-share denominator = known only; unknown reported separately.
- **dedup**: exact all-field dup → drop+count (2 here).
- **E007 conflict**: pick post-migration **snake_case record B** (newer HRMS_export_v2 shape,
  explicit annual_ctc_inr 24L, Senior AE); both values surfaced in DQ + README rationale.
- **E013** (42 activity rows, no HRMS): "activity-without-metadata" bucket — counts in
  volume/time-sink (CSV dept), **excluded from rupee** (no comp); its hours shown separately.
- **`?`** (2 rows): quarantined from joined/per-employee/rupee/ranking; count + minutes shown.
- **E099** (HRMS, 0 activity): "metadata-without-activity" bucket; excluded from time/rupee.
- **comp → canonical hourly INR**: annual = annual_ctc_inr | salary_LPA×1e5 |
  meta.compensation.annual; hourly = annual/(work_h_day×260 work-days/yr);
  `hourly_rate_inr` used directly. work_h_day from normalized working_hours (end−start),
  default 9.0 if null (6 flagged). Missing comp → impute (0 here).
- **working_hours**: parse "H-H"/"H:MM-H:MM"/object→{start,end,hours}; null→9.0+flag.
- **DQ report (shown in UI, numbers not vibes)**: rows dropped/fixed/flagged by reason;
  employees-with-no-metadata (E013, +`?`); metadata-with-no-activity (E099); E007 conflict
  (both values); imputed comps; default working-hours; every count click-through to source rows.

## Headline numbers (auditable, methodology drawer visible)

- **Recoverable hrs/month** = Σ valid+repetitive rows `minutes × R(category)`; R = automation-
  realization factor per canonical category — 0.7 rules-based (Data Entry, CRM Updates, Invoice
  Processing, Reporting, Reconciliation, Lead Entry, GST Prep, Status/Ticket Updates), 0.3 semi
  (Email Triage, Internal Comms, Vendor Portals), 0.0 human (Client Call, Internal Meeting,
  Research). NOT flat 0.6 — R table + sensitivity (R±) shown in drawer + README. Monthly =
  per-day recoverable (valid data) × 30; window Oct 6–24 + caveat shown.
- **INR/month recoverable** = Σ employees `recoverable_hrs_emp × canonical_hourly_emp`
  (HRMS join). `?`+E013 excluded (no comp); their excluded hours shown → conservative+auditable.

## Dashboard (all 6 sub-reqs)

- 2 headline numbers + click-to-expand methodology drawer (formulas, R table, excluded
  buckets, span caveat).
- Time-sink breakdown, toggle: task category | app | department.
- Automation-priority ranking: `0.35·z(repetitive_hrs)+0.20·z(repetitive_share)+
  0.20·z(distinct_employees)+0.25·z(rupee_impact)`; component bars (auditable); weights
  justified in README.
- Per-employee drill-down: profile, top repetitive tasks, vs same-role peers.
- Week-over-week trend: top-5 categories repetitive hours over the ~3 real ISO weeks.
- Anomaly callout (primary, strong, justified): **E010 — 3 activity rows logged after
  `terminated_on` 2025-10-22**; secondary: duration/repetitive-share z-outlier. Click-through
  to the offending rows.
- Cross-filters (≥2, end-to-end): (1) click department → filters whole dashboard +
  recomputes headline; (2) click task category → filters employee list. Active filters
  surfaced + clearable.

## AI layer (Gemini, grounded)

- `/app/api/chat/route.ts`; key via `GEMINI_API_KEY` env (`.env.local` + Vercel env, never
  repo). Grounding via **function-calling** over in-memory normalized aggregates (per-
  category/-employee/-dept/-week/headline/DQ) so every figure is real; system prompt forbids
  invented numbers, requires citing category/row-count/date-range, says "not in data" when
  absent. Multi-turn (history passed; "break that down by department" follow-up works).
  Loading state + visible errors; streaming optional. **Pause to collect free Gemini key here.**

## Export

`@react-pdf/renderer` (vector, forwardable, not screenshot/static): one page = headline
numbers + top-5 automation opportunities + date range + active-filter note, generated from
**live filter state** at click time.

## Deployment

Vercel (Next.js native). Data committed under `/data`. Secrets only via Vercel env. Verify
phone incognito; 0 console errors in 60s.

## Execution = phase-gated

**STOP after each phase. Show what was built + verification output, wait for user approval
before starting the next phase.** No running ahead.

## Execution phases (TaskCreate at build start)

- **P0** scaffold: Next.js+TS+Tailwind, deps, `/data` files, `.env.example`.
- **P1** normalization + join + DQ report **+ unit tests** (the 25% — first, prove it).
- **P2** metrics: headline, automation score, anomalies, trends, aggregates.
- **P3** dashboard UI: breakdowns+toggle, drilldown, trend, anomaly, 2 cross-filters,
  methodology drawer (deliberate design — not a generic template look).
- **P4** export (react-pdf, live state).
- **P5** AI layer (Gemini grounded function-calling, multi-turn) — collect free key here.
- **P6** deploy Vercel + mobile-incognito verify.
- **P7** README (<=2 pages).

## Verification (assert exact counts for THIS file)

- `npm test`: rows=539; exact-dups removed=2; duration invalid=7 (3 blank +1 neg(-3)
  +3 outlier(999)); duration zeros=0; is_rep unknown=2; `?` quarantined=2 rows;
  E013 no-metadata=42 rows; app→Unknown=4; cat→Uncategorized=2; HRMS 16→15 canonical
  (E007 resolves to record B, conflict logged); E099 no-activity=1; null workingHours=6;
  comp imputed=0; dept-missing handled=0; dept-mismatch=0; ts unparseable=0.
- `npm run build` + lint clean.
- Manual: both cross-filters recompute everything; change a filter → re-export → PDF content
  differs; AI answers a brief example Q with cited numbers + a working follow-up; E010
  anomaly card click → shows the 3 post-termination rows.
- Live Vercel URL usable in phone incognito, 0 console errors.

## Cut deliberately (defended in README)

No auth/multi-user, no DB (in-memory per brief), no role dashboards, no synthesized
rows/fields, no 7th feature. Six things done well.
