/**
 * Maxxed's partner stats API (referon.zentariconnect.io/api/Partner/players).
 *
 * Returns every referred player's wagering over a date range, split by
 * product (slots, live casino, originals, sports), in USD. Usernames arrive
 * already masked ("TU***Y"). One response, no paging.
 *
 * Requires MAXXED_API_KEY, sent as an X-API-Key header. Server-side only.
 */
// MAXXED_API_BASE exists so the board can be rendered against a local stub
// during development; production leaves it unset.
const BASE =
  process.env.MAXXED_API_BASE?.trim() || "https://referon.zentariconnect.io/api/Partner/players";

export type MaxxedWager = {
  slots: number;
  liveCasino: number;
  originals: number;
  sports: number;
};

export type MaxxedEntry = {
  /** Masked by Maxxed, e.g. "TU***Y". Also the only identifier they expose. */
  username: string;
  /** USD wagered per product over the window. */
  wager: MaxxedWager;
};

function env(name: string): string | undefined {
  const value = process.env[name];
  return value && value.trim() !== "" ? value.trim() : undefined;
}

/**
 * Usernames to leave off the board, as Maxxed masks them ("Ra***o").
 *
 * The feed includes every account on our code, the streamer's own included,
 * which would otherwise sit on a board they pay out.
 */
function excludedNames(): Set<string> {
  return new Set(
    (env("MAXXED_EXCLUDE_USERNAMES") ?? "")
      .split(",")
      .map((name) => name.trim().toLowerCase())
      .filter(Boolean),
  );
}

/** Their from/to are whole, inclusive days. */
function day(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

function amount(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/**
 * Every referred player's wagering over [start, end), as UTC days.
 *
 * Returns null when the call fails, which the page renders as "unavailable"
 * rather than as a race nobody entered.
 */
export async function fetchMaxxedWagering(
  start: number,
  end: number,
): Promise<MaxxedEntry[] | null> {
  const key = env("MAXXED_API_KEY");
  if (!key) {
    console.error("MAXXED_API_KEY not set — Maxxed leaderboard cannot load");
    return null;
  }

  const url = new URL(BASE);
  url.searchParams.set("from", day(start));
  // end is exclusive and `to` is inclusive, so the last day is end − 1ms.
  url.searchParams.set("to", day(end - 1));

  const response = await fetch(url, {
    headers: { "X-API-Key": key, accept: "application/json" },
    next: { revalidate: 60 },
  });
  if (!response.ok) {
    console.error(`Maxxed players ${response.status}`);
    return null;
  }

  const payload = (await response.json()) as {
    players?: Array<{ username?: unknown; wager?: Record<string, unknown> }>;
  };
  if (!Array.isArray(payload.players)) {
    console.error("Maxxed players: response had no players array");
    return null;
  }

  const excluded = excludedNames();
  return payload.players
    .map((raw) => ({
      username: String(raw.username ?? ""),
      wager: {
        slots: amount(raw.wager?.slots),
        liveCasino: amount(raw.wager?.liveCasino),
        originals: amount(raw.wager?.originals),
        sports: amount(raw.wager?.sports),
      },
    }))
    .filter((entry) => entry.username && !excluded.has(entry.username.toLowerCase()));
}
