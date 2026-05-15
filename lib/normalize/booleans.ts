import type { RepetitiveValue } from "../types";

const TRUE_SET = new Set(["true", "t", "1", "yes", "y"]);
const FALSE_SET = new Set(["false", "f", "0", "no", "n"]);

/** Normalizes the 11 observed is_repetitive spellings
 *  (TRUE/true/1/yes/Yes/no/false/FALSE/No/0/-) plus defensive empty/NA.
 *  Anything not clearly true/false is "unknown" and excluded from the
 *  repetitive-share denominator (reported separately). */
export function normalizeRepetitive(raw: string): RepetitiveValue {
  const v = raw.trim().toLowerCase();
  if (TRUE_SET.has(v)) return "true";
  if (FALSE_SET.has(v)) return "false";
  return "unknown";
}
