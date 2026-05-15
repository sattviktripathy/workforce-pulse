import { DEFAULT_WORK_HOURS } from "./constants";

export interface WorkingHours {
  start: string | null; // "HH:MM"
  end: string | null;
  hoursPerDay: number;
  defaulted: boolean;
}

function toMinutes(token: string): number | null {
  const m = /^(\d{1,2})(?::(\d{2}))?$/.exec(token.trim());
  if (!m) return null;
  const h = +m[1];
  const mi = m[2] ? +m[2] : 0;
  if (h > 24 || mi > 59) return null;
  return h * 60 + mi;
}

function fmt(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** Handles the 4 shapes: null, "9-18", "9:30-18:30", {start,end,timezone}. */
export function normalizeWorkingHours(raw: unknown): WorkingHours {
  const def: WorkingHours = {
    start: null,
    end: null,
    hoursPerDay: DEFAULT_WORK_HOURS,
    defaulted: true,
  };
  if (raw == null) return def;

  let startTok: string | null = null;
  let endTok: string | null = null;

  if (typeof raw === "string") {
    const parts = raw.split("-");
    if (parts.length === 2) {
      startTok = parts[0];
      endTok = parts[1];
    }
  } else if (typeof raw === "object") {
    const o = raw as Record<string, unknown>;
    if (typeof o.start === "string" && typeof o.end === "string") {
      startTok = o.start;
      endTok = o.end;
    }
  }

  if (startTok == null || endTok == null) return def;
  const sm = toMinutes(startTok);
  const em = toMinutes(endTok);
  if (sm == null || em == null || em <= sm) return def;

  return {
    start: fmt(sm),
    end: fmt(em),
    hoursPerDay: (em - sm) / 60,
    defaulted: false,
  };
}
