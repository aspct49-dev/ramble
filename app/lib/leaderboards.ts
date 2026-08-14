import { boards, PRIZE_LADDER, type BoardKey } from "../data";
import { periodRange, periodWindow } from "./race-period";
import { fetchGambaLeaderboard } from "./gamba-race";

export type Standing = {
  name: string;
  /** Dollars wagered in the open race window. */
  wagered: number;
  prize: number;
};

export type BoardsData = Record<BoardKey, Standing[]>;

const PRIZES = [...PRIZE_LADDER];

// Invented players, for local design work only — never a production fallback.
//
// These once stood in whenever the live feed came back empty, which shipped
// fake names onto the live site the moment the partner cleared its standings
// mid-race. A leaderboard that invents entrants misrepresents a real promotion
// to real players, so an empty board is always preferred to a plausible one.
// Set SHOW_PLACEHOLDER_STANDINGS=1 locally to see them.
const PLACEHOLDER_STANDINGS: Array<{ name: string; wagered: number }> = [
  { name: "KoiRunner", wagered: 73769 },
  { name: "SakuraDrift", wagered: 12055 },
  { name: "Torii", wagered: 9576 },
  { name: "NightPagoda", wagered: 6635 },
  { name: "FujiClimber", wagered: 4180 },
];

function env(name: string): string | undefined {
  try {
    const value = process.env[name];
    return value && value.trim() !== "" ? value.trim() : undefined;
  } catch {
    return undefined;
  }
}

// The open race window, shared with the countdown so the two cannot drift.
function currentRange() {
  return periodRange(boards.main.period);
}

// A standings fetch must never take the whole page down with it; an empty
// board renders as "standings appear here shortly" rather than a 500.
async function safely(load: () => Promise<Standing[]>): Promise<Standing[]> {
  try {
    return await load();
  } catch (error) {
    console.error("leaderboard fetch failed:", error);
    return [];
  }
}

function rank(
  entries: Array<{ name: string; wagered: number }>,
  prizes: number[] = PRIZES,
): Standing[] {
  return entries
    .filter((entry) => Number.isFinite(entry.wagered) && entry.wagered > 0)
    .sort((a, b) => b.wagered - a.wagered)
    .slice(0, prizes.length)
    .map((entry, index) => ({ ...entry, prize: prizes[index] ?? 0 }));
}

// Parses a published CSV (e.g. a Google Sheets "publish to web" link) with
// username,wagered columns — the common way affiliate exports are shared.
function parseCsv(text: string): Array<{ name: string; wagered: number }> {
  return text
    .split(/\r?\n/)
    .map((line) => line.split(","))
    .filter((cols) => cols.length >= 2)
    .map((cols) => ({
      name: cols[0].trim().replace(/^"|"$/g, ""),
      wagered: Number(cols[1].replace(/[^0-9.]/g, "")),
    }))
    .filter((entry) => entry.name && entry.name.toLowerCase() !== "username");
}

async function fetchOverride(prizes: number[]): Promise<Standing[]> {
  const csvUrl = env("LEADERBOARD_CSV_URL");
  const apiUrl = env("LEADERBOARD_API_URL");

  if (csvUrl) {
    // Every outbound fetch here must declare a revalidate. Next 16 leaves an
    // undeclared fetch uncached, which opts the whole route out of static
    // generation — setting one env var would silently make the site dynamic.
    const response = await fetch(csvUrl, { next: { revalidate: 60 } });
    if (!response.ok) throw new Error(`Leaderboard CSV ${response.status}`);
    return rank(parseCsv(await response.text()), prizes);
  }

  if (apiUrl) {
    const { start, end } = currentRange();
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
          wagered?: number | string;
        };
        return {
          name: item.username ?? item.name ?? "player",
          wagered: Number(item.wagered ?? 0),
        };
      }),
      prizes,
    );
  }

  // No override configured. Showing nothing is the honest answer; the pages
  // render an explicit "standings appear here shortly" state for an empty board.
  if (env("SHOW_PLACEHOLDER_STANDINGS")) return rank(PLACEHOLDER_STANDINGS, prizes);
  return [];
}

export async function getBoardsData(): Promise<BoardsData> {
  const main = await safely(async () => {
    // An explicitly configured feed always wins — it is a deliberate override.
    if (env("LEADERBOARD_CSV_URL") || env("LEADERBOARD_API_URL")) {
      return fetchOverride(PRIZES);
    }

    const { start, end } = periodWindow(Date.now(), boards.main.period);
    const live = await fetchGambaLeaderboard(start, end, PRIZES.length);
    // An empty array is an answer, not a failure: a fresh race genuinely has
    // no entrants until the first wagers land. Only null means the call
    // itself failed, and even then we never invent players.
    if (live) {
      return live.map((entry, index) => ({
        name: entry.name,
        wagered: entry.wagered,
        prize: PRIZES[index] ?? 0,
      }));
    }
    return fetchOverride(PRIZES);
  });

  return { main };
}
