"use client";

import type { ReactNode } from "react";

export function Panel({
  title,
  kicker,
  right,
  children,
  className = "",
}: {
  title?: string;
  kicker?: string;
  right?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`panel flex flex-col ${className}`}>
      {(title || right) && (
        <header className="flex items-start justify-between gap-4 px-5 pt-4 pb-3">
          <div>
            {kicker && <div className="kicker">{kicker}</div>}
            {title && (
              <h2 className="mt-1 text-[15px] font-semibold text-ink">
                {title}
              </h2>
            )}
          </div>
          {right}
        </header>
      )}
      <div className="flex-1 px-5 pb-5">{children}</div>
    </section>
  );
}

/** Segmented toggle (time-sink dimension, etc.). */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="inline-flex rounded-lg border border-line bg-panel-2 p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
            value === o.value
              ? "bg-line text-ink"
              : "text-ink-faint hover:text-ink-dim"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Horizontal magnitude bar with a label and a value, optionally clickable. */
export function MeterRow({
  label,
  value,
  frac,
  color = "var(--color-accent)",
  active = false,
  onClick,
  sub,
}: {
  label: string;
  value: string;
  frac: number; // 0..1
  color?: string;
  active?: boolean;
  onClick?: () => void;
  sub?: string;
}) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      onClick={onClick}
      className={`group grid w-full grid-cols-[150px_1fr_auto] items-center gap-3 rounded-md px-2 py-1.5 text-left transition-colors ${
        onClick ? "hover:bg-panel-2" : ""
      } ${active ? "bg-panel-2 ring-1 ring-line" : ""}`}
    >
      <span className="truncate text-[13px] text-ink-dim" title={label}>
        {label}
      </span>
      <span className="h-2 overflow-hidden rounded-full bg-line-soft">
        <span
          className="block h-full rounded-full transition-[width] duration-500"
          style={{
            width: `${Math.max(frac * 100, 1.5)}%`,
            background: color,
          }}
        />
      </span>
      <span className="tnum w-28 text-right text-[13px] text-ink">
        {value}
        {sub && (
          <span className="ml-1 text-[11px] text-ink-faint">{sub}</span>
        )}
      </span>
    </Tag>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-full min-h-24 items-center justify-center text-sm text-ink-faint">
      {children}
    </div>
  );
}
