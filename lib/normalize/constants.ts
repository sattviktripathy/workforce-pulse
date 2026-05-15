// Tunable, documented constants. Every value here is justified in the README.

/** A single logged activity longer than 8h is implausible; treat as a data
 *  error. We exclude (not clamp) — clamping fabricates a number. */
export const MAX_DURATION_MIN = 480;

/** Working days per year for annual -> hourly conversion: 5 days * 52 weeks.
 *  Holidays ignored (documented simplification; biases rates slightly low,
 *  i.e. the rupee headline is conservative). */
export const WORK_DAYS_PER_YEAR = 260;

/** Used when an employee's working_hours is null in HRMS. 9-18 is the modal
 *  schedule in the data. Flagged as `defaulted` so it is auditable. */
export const DEFAULT_WORK_HOURS = 9;

/** IST is a fixed offset (no DST). */
export const IST_OFFSET_MIN = 330; // +05:30
