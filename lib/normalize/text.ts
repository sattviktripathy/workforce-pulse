/** Canonical lookup key: trim, collapse internal whitespace, lowercase,
 *  unify `-`/`_` to spaces, drop dots. Handles the CSV's whitespace padding
 *  and casing/spelling noise (e.g. " Gmail ", "MS Excel", "data-entry"). */
export function canonKey(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[._]/g, " ")
    .replace(/-/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const MISSING_KEYS = new Set(["", "-", "na", "n/a", "none", "null"]);

export function isMissingToken(raw: string): boolean {
  return MISSING_KEYS.has(raw.trim().toLowerCase());
}
