// Shared day-of-month math for monthly-recurring content posts. A recurring
// post's `scheduledDate` is the anchor — its first occurrence, time-of-day
// included. Every later month it repeats on the same day-of-month at the
// same time, clamped down for months that don't have that day (e.g. an
// anchor on the 31st falls on the 28th/29th in February). All math is done
// in UTC to match how scheduledDate is stored and how the month-range
// filter in /api/content is built.

export function daysInMonth(year: number, monthIndex0: number): number {
  return new Date(Date.UTC(year, monthIndex0 + 1, 0)).getUTCDate();
}

// The datetime this recurring post falls on within the given (year, monthIndex0).
export function occurrenceInMonth(anchor: Date, year: number, monthIndex0: number): Date {
  const clampedDay = Math.min(anchor.getUTCDate(), daysInMonth(year, monthIndex0));
  return new Date(
    Date.UTC(year, monthIndex0, clampedDay, anchor.getUTCHours(), anchor.getUTCMinutes(), anchor.getUTCSeconds())
  );
}

export function isAnchorMonth(anchor: Date, year: number, monthIndex0: number): boolean {
  return anchor.getUTCFullYear() === year && anchor.getUTCMonth() === monthIndex0;
}

export function isSameUtcMonth(a: Date, b: Date): boolean {
  return a.getUTCFullYear() === b.getUTCFullYear() && a.getUTCMonth() === b.getUTCMonth();
}

export function startOfUtcMonth(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

// Whether a recurring series has begun as of (year, monthIndex0) — i.e. its
// anchor isn't in a month that hasn't happened yet. Without this, a series
// anchored in a future month would appear to "occur" in every earlier month
// too, since occurrenceInMonth just clamps a day-of-month with no notion of
// where the series starts.
export function hasSeriesStarted(anchor: Date, year: number, monthIndex0: number): boolean {
  const anchorKey = anchor.getUTCFullYear() * 12 + anchor.getUTCMonth();
  const targetKey = year * 12 + monthIndex0;
  return targetKey >= anchorKey;
}
