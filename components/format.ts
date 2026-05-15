// Display formatting only. Never used in metric math — keeps rounding out of
// the numbers and in the presentation layer.

const inr0 = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

const n1 = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 1 });
const n0 = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });

/** ₹ with Indian grouping, no paise. */
export const inr = (v: number): string => inr0.format(Math.round(v));

/** Compact rupees for tight cells: ₹42.3k / ₹1.2L / ₹2.4Cr. */
export function inrCompact(v: number): string {
  const a = Math.abs(v);
  if (a >= 1e7) return `₹${n1.format(v / 1e7)}Cr`;
  if (a >= 1e5) return `₹${n1.format(v / 1e5)}L`;
  if (a >= 1e3) return `₹${n1.format(v / 1e3)}k`;
  return `₹${n0.format(v)}`;
}

export const hrs = (v: number): string => `${n1.format(v)}h`;
export const hrs0 = (v: number): string => `${n0.format(v)}h`;
export const pct = (v: number): string => `${n0.format(v * 100)}%`;
export const num1 = (v: number): string => n1.format(v);
export const signed1 = (v: number): string =>
  `${v >= 0 ? "+" : ""}${n1.format(v)}`;
