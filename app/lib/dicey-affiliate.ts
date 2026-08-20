/**
 * Dicey's partner affiliate API (api.dicey.com/v1).
 *
 * This is the documented, key-authenticated API — not the undocumented
 * endpoints their own website uses. The key is server-only: their docs are
 * explicit that it must never reach client code or a public overlay URL.
 *
 * Requires DICEY_API_KEY and DICEY_STREAMER_ID. The streamer id must be our
 * own affiliate user id; any other returns 403.
 */
// DICEY_API_BASE exists so the raffle can be rendered against a local stub
// during development; production leaves it unset.
const BASE = process.env.DICEY_API_BASE?.trim() || "https://api.dicey.com/v1";

/** Their documented ceiling: to − from must be ≤ 31 days. */
export const MAX_WINDOW_DAYS = 31;

/** Their documented page size ceiling. */
const PAGE_SIZE = 200;
/** Guard against paging forever if totalUsers ever disagrees with entries. */
const MAX_PAGES = 25;

export type WageringEntry = {
  /** Opaque, stable per-player id. The only identifier they expose. */
  id: string;
  /** Already obfuscated by Dicey, e.g. "us***me". */
  username: string;
  vipLevel: string | null;
  /** Commission-eligible gross wagering, in USD. */
  wagered: number;
  betCount: number;
};

function env(name: string): string | undefined {
  const value = process.env[name];
  return value && value.trim() !== "" ? value.trim() : undefined;
}

export function affiliateConfigured(): boolean {
  return Boolean(env("DICEY_API_KEY") && env("DICEY_STREAMER_ID"));
}

/**
 * Money arrives as decimal strings, and with far more precision than their
 * example suggests — "389761.329725304440000000" is a real value. It is only
 * ever divided into whole $50 tickets and rounded down, where a double has
 * ample headroom, so reading it as a number is safe here. It must not be
 * summed into a payout figure without revisiting that.
 */
function toAmount(value: unknown): number {
  const n = typeof value === "string" ? Number(value) : Number(value);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/**
 * Every referred player's wagering over a window, across all pages.
 *
 * Returns null when the call fails, which the page renders as "unavailable"
 * rather than as a raffle nobody entered.
 */
export async function fetchWagering(
  from: Date,
  to: Date,
): Promise<WageringEntry[] | null> {
  const key = env("DICEY_API_KEY");
  const streamer = env("DICEY_STREAMER_ID");
  if (!key || !streamer) {
    console.error("DICEY_API_KEY / DICEY_STREAMER_ID not set — raffle cannot load");
    return null;
  }

  // Nobody has wagered in the future, and an affiliate API is far more likely
  // to reject a `to` past now than to quietly clamp it — which is exactly the
  // shape of failure that empties the raffle while every credential is valid.
  // The raffle's own endsAt still decides when the draw happens; this only
  // bounds the query.
  const queryTo = new Date(Math.min(to.getTime(), Date.now()));

  // Before the window opens there is nothing to have recorded yet. That is an
  // empty raffle, not a broken one, and it must not render as "unavailable".
  if (queryTo.getTime() <= from.getTime()) return [];

  const spanDays = (queryTo.getTime() - from.getTime()) / 86_400_000;
  if (spanDays > MAX_WINDOW_DAYS) {
    console.error(`Raffle window is ${spanDays}d; Dicey rejects anything over ${MAX_WINDOW_DAYS}d`);
    return null;
  }

  const all: WageringEntry[] = [];
  try {
    for (let page = 0; page < MAX_PAGES; page += 1) {
      const url = new URL(`${BASE}/streamer-races/${streamer}/wagering`);
      url.searchParams.set("from", from.toISOString());
      url.searchParams.set("to", queryTo.toISOString());
      url.searchParams.set("limit", String(PAGE_SIZE));
      url.searchParams.set("offset", String(page * PAGE_SIZE));

      const response = await fetch(url, {
        headers: { authorization: `Bearer ${key}`, accept: "application/json" },
        // Their guidance is to poll every 30–60s, well inside 60 req/min.
        next: { revalidate: 60 },
      });
      if (!response.ok) {
        // The status alone cannot tell a wrong key from a wrong streamer id
        // from a rejected window, and this only ever fails where nobody is
        // watching, so the body has to come with it. It is Dicey's own error
        // text, and the key is never in it.
        const detail = await response.text().catch(() => "");
        console.error(
          `Dicey wagering failed: ${response.status} ${response.statusText} ` +
            `on page ${page} of ${url.pathname}${url.search} - ` +
            `${detail.slice(0, 600).trim() || "(empty body)"}`,
        );
        // Partial data would understate people's tickets, which is worse than
        // showing nothing: it would misreport who is winning.
        return null;
      }

      // The live API wraps the payload in { data, timestamp, path } even
      // though their published example shows entries at the top level. Both
      // shapes are accepted so a change at either end cannot empty the raffle
      // silently — reading only the documented shape returned nothing at all.
      const payload = (await response.json()) as {
        data?: { entries?: Array<Record<string, unknown>>; totalUsers?: number };
        entries?: Array<Record<string, unknown>>;
        totalUsers?: number;
      };
      const body = payload.data ?? payload;
      const entries = body.entries ?? [];

      for (const raw of entries) {
        all.push({
          id: String(raw.publicPseudoId ?? ""),
          username: String(raw.username ?? "Hidden"),
          vipLevel: raw.vipLevel ? String(raw.vipLevel) : null,
          wagered: toAmount(raw.totalWageredUsd),
          betCount: Number(raw.betCount ?? 0) || 0,
        });
      }

      // Their documented stop condition: an empty page means we have paged
      // past the end, even if totalUsers still reads higher.
      if (entries.length < PAGE_SIZE) break;
    }
  } catch (error) {
    console.error("Dicey wagering fetch failed:", error);
    return null;
  }

  return all.filter((entry) => entry.id);
}
