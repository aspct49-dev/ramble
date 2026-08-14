/**
 * Krush affiliate standings, read from the krush.gg affiliate API.
 *
 * Documented shape:
 *   GET https://api.krush.gg/api/affiliate/wager-leader
 *     ?startTimestamp=<unix seconds, required, no older than 60 days>
 *     &endTimestamp=<unix seconds, optional, defaults to now>
 *   X-API-Key: <affiliate key>
 *
 *   { "code": 200, "data": [ { username, avatarUrl, wagered } ], "msg": "..." }
 *
 * The key is server-only. It must never reach the client, so this module is
 * imported exclusively from server components.
 */

const API_URL = "https://api.krush.gg/api/affiliate/wager-leader";

/** The API rejects a window starting more than 60 days ago. */
const MAX_LOOKBACK_DAYS = 60;

export type KrushEntry = { name: string; wagered: number };

function toNumber(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Standings for a window, highest wagered first.
 *
 * Returns null only when the call itself fails. An empty array means the API
 * answered and nobody has wagered yet — a real state during a fresh race,
 * and one the pages render as an explicit empty board rather than inventing
 * entrants to fill it.
 */
export async function fetchKrushLeaderboard(
  startMs: number,
  endMs: number,
  limit: number,
): Promise<KrushEntry[] | null> {
  const key = process.env.KRUSH_API_KEY?.trim();
  if (!key) {
    console.error("KRUSH_API_KEY is not set — leaderboard cannot be fetched");
    return null;
  }

  // Clamp to the documented window rather than letting the API 400: a race
  // that opened before the cutoff should still return its recent activity.
  const floor = Date.now() - MAX_LOOKBACK_DAYS * 86_400_000;
  const start = Math.floor(Math.max(startMs, floor) / 1000);
  const end = Math.floor(endMs / 1000);

  const url = new URL(API_URL);
  url.searchParams.set("startTimestamp", String(start));
  // Only send endTimestamp when it is genuinely in the past. The API requires
  // it to be greater than the start and defaults to now, so a future race end
  // is better expressed by omitting it.
  if (end > start && endMs < Date.now()) {
    url.searchParams.set("endTimestamp", String(end));
  }

  try {
    const response = await fetch(url, {
      headers: { "X-API-Key": key, accept: "application/json" },
      // Matches the pages' own `revalidate = 60`. `no-store` would force those
      // routes dynamic and cost prefetching for no benefit.
      next: { revalidate: 60 },
    });
    if (!response.ok) throw new Error(`Krush leaderboard HTTP ${response.status}`);

    const payload = (await response.json()) as {
      code?: number;
      data?: unknown;
      msg?: string;
    };
    // The API returns 200 with a non-200 body code for some failures, so the
    // envelope is checked rather than trusted.
    if (payload.code && payload.code !== 200) {
      throw new Error(`Krush leaderboard code ${payload.code}: ${payload.msg ?? ""}`);
    }
    if (!Array.isArray(payload.data)) return [];

    return payload.data
      .map((raw) => {
        const entry = raw as { username?: string; wagered?: number | string };
        return {
          name: entry.username?.trim() || "Hidden",
          wagered: toNumber(entry.wagered),
        };
      })
      .filter((entry) => entry.wagered > 0)
      .sort((a, b) => b.wagered - a.wagered)
      .slice(0, limit);
  } catch (error) {
    console.error("Krush leaderboard fetch failed:", error);
    return null;
  }
}
