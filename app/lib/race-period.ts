import type { BoardPeriod } from "../data";

const DAY_MS = 86_400_000;

/** First bi-weekly period start: 1 August 2026. Move to shift the reset day. */
export const BIWEEK_ANCHOR_UTC = Date.UTC(2026, 7, 1);


/** A repeating window of whole calendar months, counted from an anchor day. */
function monthCycle(now: number, start: string, months: number) {
  const [y, m, d] = start.split("-").map(Number);
  const at = (k: number) => Date.UTC(y, m - 1 + k * months, d);
  const current = new Date(now);
  // A first guess from the calendar, then nudged: day-of-month and time of
  // day can put "now" either side of the guessed boundary.
  let k = Math.floor(
    ((current.getUTCFullYear() - y) * 12 + current.getUTCMonth() - (m - 1)) / months,
  );
  while (at(k) > now) k -= 1;
  while (at(k + 1) <= now) k += 1;
  // Before the first race starts, it is still the one on the clock: there is
  // no earlier race to count down to.
  k = Math.max(k, 0);
  return { start: at(k), end: at(k + 1) };
}

/** A repeating fixed-length window, counted from an anchor. */
function cycle(now: number, anchor: number, days: number) {
  const spanMs = days * DAY_MS;
  // Never before the first race, for the same reason as monthCycle.
  const index = Math.max(0, Math.floor((now - anchor) / spanMs));
  const start = anchor + index * spanMs;
  return { start, end: start + spanMs };
}

/**
 * The open race window for a period, in UTC.
 *
 * Shared deliberately: the countdown and the standings fetch must agree on
 * which window is open, or the clock ticks down to a reset that the data
 * hasn't had yet.
 */
export function periodWindow(now: number, period: BoardPeriod) {
  const current = new Date(now);
  const year = current.getUTCFullYear();
  const month = current.getUTCMonth();

  if (period === "week") {
    const utcMidnight = Date.UTC(year, month, current.getUTCDate());
    const daysSinceMonday = (current.getUTCDay() + 6) % 7;
    const start = utcMidnight - daysSinceMonday * DAY_MS;
    return { start, end: start + 7 * DAY_MS };
  }

  if (period === "biweek") return cycle(now, BIWEEK_ANCHOR_UTC, 14);
  if (typeof period === "object") {
    return "months" in period
      ? monthCycle(now, period.start, period.months)
      : cycle(now, Date.parse(`${period.start}T00:00:00Z`), period.days);
  }

  return {
    start: Date.UTC(year, month, 1),
    end: Date.UTC(year, month + 1, 1),
  };
}

/**
 * The span whose wagering counts toward the open race. This is the race window
 * itself, except that the first race of a backdated cycle starts counting at
 * `countsFrom` instead of at its own start.
 */
export function wagerWindow(now: number, period: BoardPeriod) {
  const window = periodWindow(now, period);
  if (typeof period === "object" && period.countsFrom) {
    const first = periodWindow(Date.parse(`${period.start}T00:00:00Z`), period);
    if (window.start === first.start) {
      return { start: Date.parse(`${period.countsFrom}T00:00:00Z`), end: window.end };
    }
  }
  return window;
}

/** The same window as ISO strings, for API query params and cache keys. */
export function periodRange(period: BoardPeriod, now = Date.now()) {
  const { start, end } = periodWindow(now, period);
  return {
    start: new Date(start).toISOString(),
    end: new Date(end).toISOString(),
  };
}
