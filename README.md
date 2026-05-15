# Workforce Pulse

**Live app:** <https://workforce-pulse-eight.vercel.app/>
**Repo:** <https://github.com/sattviktripathy/workforce-pulse>

## The question this answers

A 200-person company logged a month of how its employees spend their time. The
COO asked one thing: *where are we losing the most time and money on repetitive
work, and what should we automate first?*

We were handed two raw, messy files — an activity log and an HRMS (HR system)
export. This app cleans them, joins them, and answers that question with
numbers a leader can actually trust: **every figure on screen can be traced
back to the exact rows it came from.**

## What it does

- **A dashboard** with the two headline numbers (recoverable hours/month and
  recoverable rupees/month), a breakdown of where time goes, a ranked list of
  what to automate first, a per-person drill-down, a week-by-week trend, an
  anomaly alert, and filters that re-slice everything live.
- **A one-click PDF** that exports exactly the view you're looking at, filters
  included, so a leader can forward it unedited.
- **An AI assistant** you ask in plain English. It answers *only* from the
  cleaned data and shows which calculation it used — it will not invent
  numbers.
- **A methodology panel** inside the app showing every formula and every
  data-cleaning decision.

## How to use it (every number is one tap away)

Works with a mouse or touch — mobile incognito included. Nothing is filtered
until you drill in; the bar under the header always says what you're looking at
(or "company-wide").

- **The two big cards** are the headline numbers. Click *How this is computed →*
  (or *Methodology & data quality →* top-right) to open a panel with every
  formula, the full automation-factor table, and the data-cleaning ledger
  (rows dropped/fixed/flagged, the conflicting employee with *both* values
  shown). The thin bar under each number shows how much it moves if our
  assumptions shift.
- **Export brief (PDF) →** (top-right) downloads a one-page summary of exactly
  what's on screen. Filter to Finance and you get a Finance PDF.
- **Filters.** Department and task category combine. Clear one with the `×` on
  its chip, or *Clear all*. Everything — headlines, ranking, trend, people,
  the AI and the PDF — follows the active filter:
  - **Where the hours go**: switch between *Task / App / Dept*; click a Task or
    Dept row to filter the whole dashboard to it (click again to clear). Apps
    are read-only.
  - **Automation ranking**: click a row to filter to that task. The four bars
    per row show *why* it ranks where it does.
  - **Trend**: click a legend item to isolate and filter that task.
- **Anomalies**: click one to expand the exact offending rows. The terminated
  employee's post-exit activity is shown open by default.
- **Employees**: the list follows the filter; a *no HRMS* tag means activity
  with no HR record (counted in hours, never in money). Click a person for
  their profile, top repetitive tasks, and how they compare to peers in the
  same role.
- **Ask the data** (button, bottom-right): a grounded AI assistant. It uses
  whatever filter the dashboard is on (say "company-wide" to override) and
  handles follow-ups — *"and break that down by department"* works. Every
  number it gives cites the calculation and row count. `Enter` sends,
  `Shift+Enter` for a new line.

## The two files we were given

**The activity log (`activity_logs.csv`) — 539 rows.** One row is one logged
activity: who, which app, what task, how long, whether it was repetitive, and
when. It was dirty exactly as promised — the same app spelled ~50 ways, ~62
spellings of task names, three different timestamp formats, durations that were
blank / negative / impossibly large, the repetitive flag written eleven
different ways, and some exact-duplicate rows.

**The HRMS export (`employees.json`) — 16 records.** Each person's role, pay
and tenure. It was migrated mid-year, so records come in three different
shapes, pay is given in three different units (annual rupees, hourly rupees, or
"lakhs per annum"), and some fields are inconsistent or missing.

## How we cleaned and joined them

The principle: **clean everything to one standard form, count every single
change, and never silently lose a row.** The app shows this same table live.

| What we checked | Count in this file |
| --- | --- |
| Exact duplicate rows removed | **2** |
| Bad durations (3 blank · 1 negative · 3 impossibly large) | **7** |
| "Is it repetitive?" unreadable (`-`, empty) | **2** |
| App name unrecognisable → "Unknown" | **4** |
| Task name missing → "Uncategorized" | **2** |
| Timestamps that wouldn't parse | **0** |
| Activity department disagreeing with HRMS | **0** |
| HRMS records after resolving the duplicate | 16 → **15** |
| HRMS person with zero logged activity (E099) | **1** |
| Activity for a person missing from HRMS (E013) | **42 rows** |
| Activity with an unknown employee id ("?") | **2 rows** |
| Missing working-hours → default 9.0 (flagged) | **6** |
| Pay figures we had to estimate | **0** |

The judgement calls, in plain terms:

- **One employee (E007) appears twice, with conflicting records.** One says
  "Account Executive, 14 LPA"; the other says "Senior Account Executive,
  ₹24,00,000". We kept the second: it comes from the newer post-migration
  format and gives an exact annual figure rather than a rounded legacy value.
  **Both versions are still shown in the app**, so the choice is visible, not
  hidden.
- **One employee (E013) is in the activity log but not in HRMS.** We can count
  their hours but can't price them (no salary). Their time is reported but
  deliberately left out of the money number — that keeps the cost figure
  conservative instead of inflated by a guess.
- **One employee (E099) is in HRMS but did no logged work.** Noted, but there's
  nothing to add to the totals.
- **Two rows have an unknown employee ("?").** They can't be attributed to
  anyone, so they're quarantined: their hours are reported separately, never
  counted per-person or in money.
- **Impossibly long activities (three rows at 999 minutes) are flagged, not
  "corrected".** Capping them at 8 hours would invent work that never
  happened. We exclude them from the maths but surface them as an anomaly —
  honest and auditable.
- **One employee (E010) was terminated mid-month but still has activity
  afterwards** — surfaced as the main anomaly (below).

## The two headline numbers, explained

**Recoverable hours/month** — of all the valid, repetitive activity, how much
time automation could realistically give back, scaled to a month.

We do *not* multiply every repetitive minute by a flat 0.6 (the brief
explicitly calls that indefensible). Instead, each task type has a realistic
"how much of this can software actually take over" factor, **R**:

- **0.70 — rules-based** (data entry, CRM updates, invoice processing,
  reconciliation, reporting, lead entry, GST prep, status/ticket updates):
  highly automatable.
- **0.30 — semi-assisted** (email triage, internal comms, vendor portals):
  software helps, a human stays in the loop.
- **0.00 — human** (client calls, meetings, research): automation realistically
  recovers none of this.

```
recoverable hrs/mo = Σ (valid & repetitive rows) minutes × R(task type)
                     ÷ 19 days observed × 30
```

The data only spans **19 days (~3 weeks), not the ~4 the brief assumed.**
Rather than pretend otherwise, we take the real daily rate and scale it to a
30-day month, and show the actual date window next to every monthly number. A
sensitivity band (what the number becomes if every R shifts by ±0.10) shows
the uncertainty honestly.

**Recoverable rupees/month** — for each person we *can* price, their
recoverable hours × their real hourly cost from HRMS:

```
hourly cost = annual pay ÷ (working hours per day × 260 working days/year)
recoverable INR/mo = Σ (HRMS-priced employees) recoverable hrs/mo × hourly cost
```

Only people with HRMS pay data add rupees; the "?" rows and E013 add hours but
not money, on purpose.

## How "what to automate first" is ranked

A task isn't worth automating just because it's big. We combine four signals.
Each is converted to a **z-score** — a fair "how far above or below average is
this task" measure that lets different units be compared — then weighted:

```
priority = 0.35 · z(repetitive hours)     ← the prize: how much time
         + 0.25 · z(rupee impact)         ← how much money it represents
         + 0.20 · z(repetitive share)     ← how clearly it's actually repetitive
         + 0.20 · z(distinct employees)   ← how many people it touches
```

A task ten people do is a better automation target than a one-person quirk,
which is why reach is in the formula. Every row in the app shows these four
contributions as bars, so the ranking is auditable, not a black box.

## How anomaly detection works

- **Main:** an employee marked terminated on 2025-10-22 (E010) has activity
  logged on 2025-10-24 — rows **87, 187, 215**. A real red flag (access not
  revoked on exit); the app links straight to those rows.
- **Secondary:** single activities over 8 hours (three rows at 999 minutes) —
  almost certainly bad data; shown, but excluded from the maths.

## Where the brief and the real files disagreed

The brief warned the data was ambiguous on purpose. We built a handler for
every case it named and report the real count **even when it's zero** — we
never claim to have fixed a problem that wasn't there.

- Brief says employees live under `data.employees`; the file uses `employees`.
  We read both.
- Brief says one HRMS record is missing its department; none were. The fallback
  exists anyway.
- Brief says some pay data is missing; none was. The estimation path (from
  role, then department, then company median, all flagged) exists anyway.
- Brief says ~4 weeks; the file is ~3. We use the real weeks and state the
  window everywhere.

## What we deliberately did not build, and why

The brief is explicit that a focused submission beats a bloated one. So: no
login, no database (the brief says in-memory is fine), no per-role dashboards,
no invented rows or fields, and no seventh feature. Six things done well.

## What we'd build next with two more days

- **A real confidence range on the rupee number.** Today R is a defensible
  estimate with a ±0.10 band; we'd calibrate it per task against a few real
  automation case studies and show a proper confidence interval.
- **Click-through from the AI.** It already cites the calculation and row
  count; we'd make each cited number a link that opens the exact filtered view
  or source rows.
- **Statistical week-over-week.** With more weeks of data, flag which trends
  are real vs noise instead of just plotting them.
- **Saved views + a scheduled emailed PDF**, so the COO gets the brief every
  Monday without opening the app.

## Tech & operations

Next.js 16 (App Router), TypeScript, Tailwind, Recharts and
`@react-pdf/renderer`, with Google Gemini (`gemini-2.5-flash-lite`) for the
assistant on a billing-enabled paid tier so live request limits are reliable.
The AI is grounded by *function calling*: it can only read the same cleaned
aggregates the dashboard uses, every one a pure function covered by the
60-test suite — so its answers match the dashboard cell-for-cell and it
can't hallucinate figures. Deployed on Vercel; the data files are committed
under `/data` and bundled into the API route so they load reliably in
production.

## Run it locally

```bash
npm install
echo "GEMINI_API_KEY=your_aistudio_key" > .env.local
npm test          # 60/60 — proves the cleaning and the AI tools
npm run dev       # http://localhost:3000
```
