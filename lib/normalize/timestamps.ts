import { IST_OFFSET_MIN } from "./constants";

export interface ParsedTimestamp {
  timestampIso: string; // ISO-8601 with +05:30, e.g. 2025-10-14T11:23:00+05:30
  istCivil: string; // "YYYY-MM-DD HH:mm" wall-clock in IST
  dateKey: string; // "YYYY-MM-DD" IST calendar date
  isoWeek: string; // "YYYY-Www" ISO week the date falls in
  epochUtcMs: number; // true UTC instant (IST civil minus 5:30)
}

const ISO = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/;
const SLASH = /^(\d{2})\/(\d{2})\/(\d{4}) (\d{2}):(\d{2})(?::(\d{2}))?$/;

function pad(n: number, w = 2): string {
  return String(n).padStart(w, "0");
}

// ISO-8601 week number/year for a Gregorian date (all values IST-civil).
function isoWeek(y: number, m: number, d: number): string {
  // Thursday-based: shift date to the Thursday of its week.
  const date = new Date(Date.UTC(y, m - 1, d));
  const day = (date.getUTCDay() + 6) % 7; // Mon=0..Sun=6
  date.setUTCDate(date.getUTCDate() - day + 3);
  const firstThursday = new Date(Date.UTC(date.getUTCFullYear(), 0, 4));
  const fd = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - fd + 3);
  const week =
    1 +
    Math.round(
      (date.getTime() - firstThursday.getTime()) / (7 * 24 * 3600 * 1000),
    );
  return `${date.getUTCFullYear()}-W${pad(week)}`;
}

/** Parses the 3 timestamp formats in the dataset. Slash form is DD/MM/YYYY
 *  (Indian convention; day values >12 in the data confirm this). All
 *  timestamps are interpreted as IST wall-clock (the logs carry no zone). */
export function parseTimestamp(raw: string): ParsedTimestamp | null {
  const t = raw.trim();
  let y: number, mo: number, d: number, h: number, mi: number, s: number;

  const iso = ISO.exec(t);
  const slash = iso ? null : SLASH.exec(t);
  if (iso) {
    y = +iso[1];
    mo = +iso[2];
    d = +iso[3];
    h = +iso[4];
    mi = +iso[5];
    s = iso[6] ? +iso[6] : 0;
  } else if (slash) {
    d = +slash[1];
    mo = +slash[2];
    y = +slash[3];
    h = +slash[4];
    mi = +slash[5];
    s = slash[6] ? +slash[6] : 0;
  } else {
    return null;
  }

  if (mo < 1 || mo > 12 || d < 1 || d > 31 || h > 23 || mi > 59 || s > 59) {
    return null;
  }

  const dateKey = `${y}-${pad(mo)}-${pad(d)}`;
  const istCivil = `${dateKey} ${pad(h)}:${pad(mi)}`;
  const epochUtcMs =
    Date.UTC(y, mo - 1, d, h, mi, s) - IST_OFFSET_MIN * 60_000;

  return {
    timestampIso: `${dateKey}T${pad(h)}:${pad(mi)}:${pad(s)}+05:30`,
    istCivil,
    dateKey,
    isoWeek: isoWeek(y, mo, d),
    epochUtcMs,
  };
}
