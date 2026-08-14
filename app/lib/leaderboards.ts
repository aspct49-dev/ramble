import { boards, type BoardConfig, type BoardKey } from "../data";
import { periodRange, periodWindow } from "./race-period";
import { fetchKrushLeaderboard } from "./krush-race";
import { fetchDiceyLeaderboard, fetchRaceConfig } from "./dicey-race";

export type Standing = {
  name: string;
  /** Whatever the partner measures — dollars wagered, or points. */
  score: number;
  prize: number;
};

/**
 * "ok"          — the feed answered. An empty list means nobody has scored yet.
 * "unavailable" — we could not read the feed at all: missing key, race taken
 *                 down, network failure, or an error response.
 *
 * These were once indistinguishable on screen, so a broken feed rendered as a
 * normal empty board and hid the fault completely. A visitor deserves the
 * difference too: "nothing yet" and "we can't load this" are not the same
 * promise, and only one is worth chasing.
 */
export type BoardStatus = "ok" | "unavailable";

export type BoardResult = { standings: Standing[]; status: BoardStatus };

/** One entry per configured board, keyed so a page can pick them out. */
export type BoardsData = Partial<Record<BoardKey, BoardResult>>;

// Invented players, for local design work only — never a production fallback.
//
// These once stood in whenever a live feed came back empty, which shipped fake
// names onto the live site the moment a partner cleared its standings mid-race.
// A leaderboard that invents entrants misrepresents a real promotion to real
// players, so an empty board is always preferred to a plausible one.
// Set SHOW_PLACEHOLDER_STANDINGS=1 locally to see them.
const PLACEHOLDER_STANDINGS: Array<{ name: string; score: number }> = [
  { name: "KoiRunner", score: 73769 },
  { name: "SakuraDrift", score: 12055 },
  { name: "Torii", score: 9576 },
  { name: "NightPagoda", score: 6635 },
  { name: "FujiClimber", score: 4180 },
  { name: "LanternWake", score: 3021 },
  { name: "PineShadow", score: 1894 },
  { name: "BlueRidge", score: 1102 },
];

function env(name: string): string | undefined {
  try {
    const value = process.env[name];
    return value && value.trim() !== "" ? value.trim() : undefined;
  } catch {
    return undefined;
  }
}

// A standings fetch must never take the whole page down with it; a failure
// renders as an explicit "unavailable" state rather than a 500.
async function safely(load: () => Promise<BoardResult>): Promise<BoardResult> {
  try {
    return await load();
  } catch (error) {
    console.error("leaderboard fetch failed:", error);
    return { standings: [], status: "unavailable" };
  }
}

function rank(
  entries: Array<{ name: string; score: number; prize?: number }>,
  prizes: readonly number[],
): Standing[] {
  return entries
    .filter((entry) => Number.isFinite(entry.score) && entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, prizes.length)
    .map((entry, index) => ({
      name: entry.name,
      score: entry.score,
      // A partner-supplied payout wins over our ladder: it is what they will
      // actually pay, so the column cannot drift from their own figures.
      prize: entry.prize ?? prizes[index] ?? 0,
    }));
}

// Parses a published CSV (e.g. a Google Sheets "publish to web" link) with
// username,score columns — the common way affiliate exports are shared.
function parseCsv(text: string): Array<{ name: string; score: number }> {
  return text
    .split(/\r?\n/)
    .map((line) => line.split(","))
    .filter((cols) => cols.length >= 2)
    .map((cols) => ({
      name: cols[0].trim().replace(/^"|"$/g, ""),
      score: Number(cols[1].replace(/[^0-9.]/g, "")),
    }))
    .filter((entry) => entry.name && entry.name.toLowerCase() !== "username");
}

/** Operator-configured feed, overriding the partner's own. */
async function fetchOverride(board: BoardConfig): Promise<Standing[] | null> {
  const csvUrl = env("LEADERBOARD_CSV_URL");
  const apiUrl = env("LEADERBOARD_API_URL");

  if (csvUrl) {
    // Every outbound fetch here must declare a revalidate. Next 16 leaves an
    // undeclared fetch uncached, which opts the whole route out of static
    // generation — setting one env var would silently make the site dynamic.
    const response = await fetch(csvUrl, { next: { revalidate: 60 } });
    if (!response.ok) throw new Error(`Leaderboard CSV ${response.status}`);
    return rank(parseCsv(await response.text()), board.prizes);
  }

  if (apiUrl) {
    const { start, end } = periodRange(board.period);
    const url = new URL(apiUrl);
    if (!url.searchParams.has("startDate")) url.searchParams.set("startDate", start);
    if (!url.searchParams.has("endDate")) url.searchParams.set("endDate", end);

    const headers: Record<string, string> = { accept: "application/json" };
    const token = env("LEADERBOARD_API_TOKEN");
    if (token) headers.Authorization = `Bearer ${token}`;

    const response = await fetch(url, { headers, next: { revalidate: 60 } });
    if (!response.ok) throw new Error(`Leaderboard API ${response.status}`);

    const payload = (await response.json()) as unknown;
    const list = Array.isArray(payload)
      ? payload
      : ((payload as { data?: unknown[] })?.data ??
        (payload as { leaderboard?: unknown[] })?.leaderboard ??
        []);
    if (!Array.isArray(list)) return [];

    return rank(
      list.map((entry) => {
        const item = entry as {
          username?: string;
          name?: string;
          points?: number | string;
          wagered?: number | string;
        };
        return {
          name: item.username ?? item.name ?? "player",
          // Accept either key: Dicey reports points, Krush reports wagered.
          score: Number(item.points ?? item.wagered ?? 0),
        };
      }),
      board.prizes,
    );
  }

  return null;
}

/** The partner's own feed. Null means it could not be read. */
async function fetchLive(board: BoardConfig): Promise<Standing[] | null> {
  const { start, end } = periodWindow(Date.now(), board.period);

  if (board.source === "krush") {
    const live = await fetchKrushLeaderboard(start, end, board.prizes.length);
    if (!live) return null;
    return rank(
      live.map((entry) => ({ name: entry.name, score: entry.wagered })),
      board.prizes,
    );
  }

  // Dicey: the race config carries the id, dates and payout tiers. Without it
  // there is nothing to query — their race can be taken down entirely.
  const race = await fetchRaceConfig();
  if (!race?.id) return null;

  const live = await fetchDiceyLeaderboard(race.id, board.prizes.length);
  if (!live) return null;
  return rank(
    live.map((entry) => ({ name: entry.name, score: entry.points, prize: entry.prize })),
    board.prizes,
  );
}

async function loadBoard(board: BoardConfig): Promise<BoardResult> {
  return safely(async () => {
    // An explicitly configured feed always wins — it is a deliberate override.
    const override = await fetchOverride(board);
    if (override) return { standings: override, status: "ok" as const };

    const live = await fetchLive(board);
    // An empty array is an answer, not a failure: a fresh race genuinely has
    // no entrants until the first wagers land. Only null means the call itself
    // failed, and even then we never invent players.
    if (live) return { standings: live, status: "ok" as const };

    if (env("SHOW_PLACEHOLDER_STANDINGS")) {
      return { standings: rank(PLACEHOLDER_STANDINGS, board.prizes), status: "ok" as const };
    }
    return { standings: [], status: "unavailable" as const };
  });
}

export async function getBoardsData(): Promise<BoardsData> {
  // Boards are independent partners, so one being down must not delay or
  // break the others — settle them in parallel and report each separately.
  const results = await Promise.all(boards.map((board) => loadBoard(board)));

  const data: BoardsData = {};
  boards.forEach((board, index) => {
    data[board.key] = results[index];
  });
  return data;
}
