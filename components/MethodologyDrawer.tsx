"use client";

import { useEffect } from "react";
import type { HeadlineResult } from "../lib/metrics";
import { rTableSnapshot, SCORE_WEIGHTS } from "../lib/metrics";
import { hrs, inr, num1 } from "./format";

const R_ROWS = rTableSnapshot();
const tierLabel: Record<string, string> = {
  rules: "Rules-based",
  semi: "Semi / assisted",
  human: "Human / judgment",
};

export default function MethodologyDrawer({
  open,
  onClose,
  h,
}: {
  open: boolean;
  onClose: () => void;
  h: HeadlineResult;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    if (open) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-[2px]"
        onClick={onClose}
      />
      <aside className="fp-fade relative h-full w-full max-w-xl overflow-y-auto border-l border-line bg-panel p-6">
        <div className="flex items-start justify-between">
          <div>
            <div className="kicker">Methodology</div>
            <h2 className="mt-1 text-lg font-semibold">
              Every number, defended
            </h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-md border border-line bg-panel-2 px-2 py-1 text-sm text-ink-dim hover:text-ink"
          >
            Close ✕
          </button>
        </div>

        <Section title="Recoverable hours / month">
          <Formula>
            Σ (valid &amp; repetitive rows) minutes × R(category) ÷ 60, then{" "}
            ÷ {h.windowDays} observed days × {h.monthDays}
          </Formula>
          <p className="mt-2 text-[13px] text-ink-dim">
            Window {h.windowStart} → {h.windowEnd}. The data spans{" "}
            <b>{h.windowDays} days (~3 ISO weeks)</b>, not the brief&apos;s
            ~4 weeks — we scale the observed daily rate to a 30-day month and
            state the window rather than assume it. Invalid durations
            (blank, ≤0, &gt;8h) are excluded, never clamped.
          </p>
          <div className="tnum mt-3 grid grid-cols-2 gap-2 text-[12px]">
            <Stat
              k="Window total"
              v={`${num1(h.recoverableHrsWindow)} h`}
            />
            <Stat
              k="Monthly"
              v={`${num1(h.recoverableHrsMonth)} h`}
            />
            <Stat
              k="Sensitivity"
              v={`${num1(h.recoverableHrsMonthLow)}–${num1(
                h.recoverableHrsMonthHigh,
              )} h`}
            />
            <Stat k="Qualifying rows" v={`${h.repetitiveRowCount}`} />
          </div>
        </Section>

        <Section title="Recoverable rupees / month">
          <Formula>
            Σ employees (recoverable hrs/mo × canonical hourly rate)
          </Formula>
          <p className="mt-2 text-[13px] text-ink-dim">
            Hourly = annual ÷ (working-hours/day × 260 work-days/yr), or the
            direct hourly rate where given. Only HRMS-joined employees carry
            rupees. {h.excludedEmployeeIds.length > 0 && (
              <>
                <b>{h.excludedEmployeeIds.join(", ")}</b> have activity but no
                HRMS record: {hrs(h.excludedRecoverableHrsMonth)}/mo counted in
                hours, deliberately excluded from rupees.
              </>
            )}{" "}
            {h.quarantinedRepetitiveHrsWindow > 0 && (
              <>
                Unknown-employee (&quot;?&quot;) rows are quarantined:{" "}
                {num1(h.quarantinedRepetitiveHrsWindow)}h reported, never
                monetised.
              </>
            )}
          </p>
          <div className="tnum mt-3 text-[13px]">
            <Stat k="Monthly" v={inr(h.recoverableInrMonth)} />
          </div>
        </Section>

        <Section title="R — automation-realization factor">
          <p className="text-[13px] text-ink-dim">
            Not a flat 0.6. A CRM field update and a client call do not
            automate alike, so R is tiered by how deterministic the work is.
            Unmapped/unknown categories default to 0.0 — we never claim
            recoverable time on unclassified work.
          </p>
          <div className="mt-3 overflow-hidden rounded-lg border border-line">
            <table className="w-full text-left text-[12px]">
              <thead className="bg-panel-2 text-ink-faint">
                <tr>
                  <th className="px-3 py-2 font-medium">Category</th>
                  <th className="px-3 py-2 font-medium">Tier</th>
                  <th className="px-3 py-2 text-right font-medium">R</th>
                </tr>
              </thead>
              <tbody>
                {R_ROWS.map((r) => (
                  <tr key={r.category} className="border-t border-line-soft">
                    <td className="px-3 py-1.5">{r.category}</td>
                    <td className="px-3 py-1.5 text-ink-dim">
                      {tierLabel[r.tier]}
                    </td>
                    <td className="tnum px-3 py-1.5 text-right">
                      {r.r.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>

        <Section title="Automation-priority score">
          <Formula>
            {SCORE_WEIGHTS.repetitiveHrs} z(rep hrs) +{" "}
            {SCORE_WEIGHTS.repetitiveShare} z(rep share) +{" "}
            {SCORE_WEIGHTS.distinctEmployees} z(distinct emp) +{" "}
            {SCORE_WEIGHTS.rupeeImpact} z(₹ impact)
          </Formula>
          <p className="mt-2 text-[13px] text-ink-dim">
            Z-scored across categories so different units compose. Volume
            weighted highest (it is the prize), rupee impact next. Every
            component is shown as a signed bar so the rank is auditable.
          </p>
        </Section>
      </aside>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="hairline mt-6 pt-5">
      <h3 className="text-[13px] font-semibold text-ink">{title}</h3>
      <div className="mt-2">{children}</div>
    </section>
  );
}

function Formula({ children }: { children: React.ReactNode }) {
  return (
    <code className="block rounded-md border border-line bg-canvas px-3 py-2 font-mono text-[12px] text-ink-dim">
      {children}
    </code>
  );
}

function Stat({ k, v }: { k: string; v: string }) {
  return (
    <div className="rounded-md border border-line bg-panel-2 px-3 py-2">
      <div className="text-[10px] uppercase tracking-wider text-ink-faint">
        {k}
      </div>
      <div className="mt-0.5 text-ink">{v}</div>
    </div>
  );
}
