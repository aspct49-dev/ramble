/**
 * Kingz's affiliate stats API (leaderboard.kingz.win/v1/external/affiliates).
 *
 * Billed as a drop-in Rainbet replacement: same params, same response shape.
 * The key travels as a query param, so the URL itself is a secret — it must
 * only ever be built server-side and never logged.
 *
 * Requires KINGZ_API_KEY.
 */
// KINGZ_API_BASE exists so the board can be rendered against a local stub
// during development; production leaves it unset.
const BASE =
  process.env.KINGZ_API_BASE?.trim() || "https://leaderboard.kingz.win/v1/external/affiliates";

export type KingzEntry = {
  /** Stable per-player id. */
  id: string;
  /** Raw, unmasked username — mask before rendering. */
  username: string;
  /** Dollars wagered over the window. */
  wagered: number;
};

function env(name: string): string | undefined {
  const value = process.env[name];
  return value && value.trim() !== "" ? value.trim() : undefined;
}

/**
 * Usernames to leave off the board.
 *
 * The feed is raw — it includes every account attributed to our links,
 * including our own — so the streamer's own wagering would otherwise sit at
 * the top of a race they pay out.
 */
function excludedNames(): Set<string> {
  return new Set(
    (env("KINGZ_EXCLUDE_USERNAMES") ?? "")
      .split(",")
      .map((name) => name.trim().toLowerCase())
      .filter(Boolean),
  );
}

/** Their params are whole days: start_at from 00:00, end_at through 23:59. */
function day(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/**
 * Every referred player's wagering over [start, end), as UTC days.
 *
 * Returns null when the call fails, which the page renders as "unavailable"
 * rather than as a race nobody entered.
 */
export async function fetchKingzWagering(
  start: number,
  end: number,
): Promise<KingzEntry[] | null> {
  const key = env("KINGZ_API_KEY");
  if (!key) {
    console.error("KINGZ_API_KEY not set — Kingz leaderboard cannot load");
    return null;
  }

  const url = new URL(BASE);
  url.searchParams.set("start_at", day(start));
  // end is exclusive and end_at is inclusive, so the last day is end − 1ms.
  url.searchParams.set("end_at", day(end - 1));
  url.searchParams.set("key", key);

  const response = await fetch(url, {
    headers: { accept: "application/json" },
    next: { revalidate: 60 },
  });
  if (!response.ok) {
    // Status only: the URL carries the key.
    console.error(`Kingz affiliates ${response.status}`);
    return null;
  }

  const payload = (await response.json()) as {
    affiliates?: Array<Record<string, unknown>>;
  };
  if (!Array.isArray(payload.affiliates)) {
    console.error("Kingz affiliates: response had no affiliates array");
    return null;
  }

  const excluded = excludedNames();
  return payload.affiliates
    .map((raw) => ({
      id: String(raw.id ?? ""),
      username: String(raw.username ?? ""),
      // Arrives as a decimal string, e.g. "708.6200".
      wagered: Number(raw.wagered_amount ?? 0) || 0,
    }))
    .filter((entry) => entry.id && !excluded.has(entry.username.toLowerCase()));
}
