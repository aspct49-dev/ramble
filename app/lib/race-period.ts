import type { BoardPeriod } from "../data";

const DAY_MS = 86_400_000;

/** First bi-weekly period start: 1 August 2026. Move to shift the reset day. */
export const BIWEEK_ANCHOR_UTC = Date.UTC(2026, 7, 1);

/**
 * First 30-day race start: 27 September 2026, so the first race ends on
 * 27 October. Every race after runs a further 30 days. Move this to restart
 * the clock.
 */
export const THIRTY_DAY_ANCHOR_UTC = Date.UTC(2026, 8, 27);

/** A repeating fixed-length window, counted from an anchor. */
function cycle(now: number, anchor: number, days: number) {
  const spanMs = days * DAY_MS;
  const index = Math.floor((now - anchor) / spanMs);
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
  if (period === "30day") return cycle(now, THIRTY_DAY_ANCHOR_UTC, 30);

  return {
    start: Date.UTC(year, month, 1),
    end: Date.UTC(year, month + 1, 1),
  };
}

/** The same window as ISO strings, for API query params and cache keys. */
export function periodRange(period: BoardPeriod, now = Date.now()) {
  const { start, end } = periodWindow(now, period);
  return {
    start: new Date(start).toISOString(),
    end: new Date(end).toISOString(),
  };
}
