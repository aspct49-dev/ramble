import { AFFILIATE_CODE } from "../data";

/**
 * Race configuration read from Dicey's own race page.
 *
 * Dicey's public race route is a React Router "single fetch" endpoint: adding
 * `.data` to the page URL returns the loader payload. That payload is
 * turbo-stream encoded, but the GraphQL result inside it is an ordinary JSON
 * string, so we locate and decode just that.
 *
 * This is an undocumented internal endpoint, so every field is treated as
 * optional and the caller falls back to local config if anything is off.
 */

const RACE_URL = `https://dicey.com/challenges/wager-race/${AFFILIATE_CODE.toLowerCase()}.data`;

// Freshness is handled entirely by Next's fetch cache below. A module-level
// cache would be per-instance on serverless, so two visitors routed to
// different lambdas could see different standings with no way to purge either.

export type PayoutTier = { rankFrom: number; rankTo: number; amount: number };

export type RaceConfig = {
  id: string;
  name: string;
  startsAt: string;
  endsAt: string;
  prizePool: number;
  payoutTiers: PayoutTier[];
};

/** Pull the single embedded GraphQL JSON string out of the turbo-stream. */
function extractRace(raw: string): unknown {
  const marker = '"{\\"streamerWagerRaceByCode';
  const start = raw.indexOf(marker);
  if (start === -1) return null;

  // The value is a JSON string literal; decoding it yields the inner JSON
  // text. Walk to the closing quote, honouring escapes.
  let i = start + 1;
  let out = "";
  while (i < raw.length) {
    const ch = raw[i];
    if (ch === "\\") {
      out += raw[i] + raw[i + 1];
      i += 2;
      continue;
    }
    if (ch === '"') break;
    out += ch;
    i += 1;
  }
  try {
    return JSON.parse(JSON.parse(`"${out}"`));
  } catch {
    return null;
  }
}

function toNumber(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export async function fetchRaceConfig(): Promise<RaceConfig | null> {
  try {
    const response = await fetch(RACE_URL, {
      headers: { accept: "*/*", "user-agent": "Mozilla/5.0" },
      // Matches the pages' own `revalidate = 60`. `no-store` would force those
      // routes dynamic and break static generation, which costs prefetching
      // for no benefit — the race config changes twice a month, not per hit.
      next: { revalidate: 60 },
    });
    if (!response.ok) throw new Error(`Dicey race ${response.status}`);

    const parsed = extractRace(await response.text()) as
      | { streamerWagerRaceByCode?: Record<string, unknown> }
      | null;
    const race = parsed?.streamerWagerRaceByCode;
    if (!race?.startsAt || !race?.endsAt) throw new Error("race payload missing dates");

    const tiers = Array.isArray(race.payoutTiers) ? race.payoutTiers : [];
    const data: RaceConfig = {
      id: String(race.id ?? ""),
      name: String(race.name ?? ""),
      startsAt: String(race.startsAt),
      endsAt: String(race.endsAt),
      prizePool: toNumber(race.prizePoolAmount),
      payoutTiers: tiers
        .map((t) => {
          const tier = t as Record<string, unknown>;
          return {
            rankFrom: toNumber(tier.rankFrom),
            rankTo: toNumber(tier.rankTo),
            amount: toNumber(tier.payoutValue),
          };
        })
        .filter((t) => t.rankFrom > 0 && t.amount > 0)
        .sort((a, b) => a.rankFrom - b.rankFrom),
    };

    return data;
  } catch (error) {
    console.error("Dicey race config fetch failed:", error);
    return null;
  }
}

const GRAPHQL_URL = "https://api.dicey.com/graphql";

/**
 * The exact document Dicey's own race page sends. Their API has introspection
 * disabled, so this was taken from the query their client issues rather than
 * guessed — keep it in sync if their page changes.
 */
const LEADERBOARD_QUERY = `query GetWagerRaceLeaderboard($raceId: ID!, $limit: Int) {
  wagerRaceLeaderboard(raceId: $raceId, limit: $limit) {
    entries {
      rank
      score
      payoutAmountUsd
      user { id username }
    }
    totalParticipants
  }
}`;

export type DiceyEntry = { rank: number; name: string; points: number; prize: number };

/**
 * Live standings for a race.
 *
 * Usernames arrive already masked by Dicey ("nugg****", or "Hidden" when a
 * player opts out), so they are passed through rather than re-masked.
 */
export async function fetchDiceyLeaderboard(
  raceId: string,
  limit: number,
): Promise<DiceyEntry[] | null> {
  try {
    const response = await fetch(GRAPHQL_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json",
        origin: "https://dicey.com",
        referer: "https://dicey.com/",
        "user-agent": "Mozilla/5.0",
      },
      body: JSON.stringify({
        query: LEADERBOARD_QUERY,
        variables: { raceId, limit },
      }),
      next: { revalidate: 60 },
    });
    if (!response.ok) throw new Error(`Dicey leaderboard ${response.status}`);

    const payload = (await response.json()) as {
      errors?: unknown[];
      data?: { wagerRaceLeaderboard?: { entries?: unknown[] } };
    };
    if (payload.errors?.length) throw new Error(JSON.stringify(payload.errors).slice(0, 200));

    const entries = payload.data?.wagerRaceLeaderboard?.entries;
    if (!Array.isArray(entries)) return null;

    return entries
      .map((raw) => {
        const e = raw as {
          rank?: number;
          score?: number | string;
          payoutAmountUsd?: number | string;
          user?: { username?: string } | null;
        };
        return {
          rank: toNumber(e.rank),
          name: e.user?.username?.trim() || "Hidden",
          points: toNumber(e.score),
          prize: toNumber(e.payoutAmountUsd),
        };
      })
      .filter((e) => e.rank > 0)
      .sort((a, b) => a.rank - b.rank);
  } catch (error) {
    console.error("Dicey leaderboard fetch failed:", error);
    return null;
  }
}

/** Flatten tiers into a prize-per-rank array: [rank1, rank2, …]. */
export function prizesFromTiers(tiers: PayoutTier[]): number[] {
  const out: number[] = [];
  for (const tier of tiers) {
    for (let rank = tier.rankFrom; rank <= tier.rankTo; rank += 1) {
      out[rank - 1] = tier.amount;
    }
  }
  return out.map((v) => v ?? 0);
}
