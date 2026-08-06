import { boards, type BoardKey } from "../data";
import { periodRange } from "./race-period";
import { fetchDiceyLeaderboard, fetchRaceConfig, prizesFromTiers } from "./dicey-race";

export type Standing = {
  name: string;
  points: number;
  prize: number;
};

export type BoardsData = Record<BoardKey, Standing[]>;

// Fallback ladder, used only if Dicey's race config can't be read. Must total
// the advertised pool — 2000+850+650+500+400+300+200+100 = 5000.
const FALLBACK_PRIZES = [2000, 850, 650, 500, 400, 300, 200, 100];

// Invented players, for local design work only — never a production fallback.
//
// These once stood in whenever the live feed came back empty, which shipped
// fake names onto the live site the moment Dicey cleared its standings mid-
// race. A leaderboard that invents entrants misrepresents a real promotion to
// real players, so an empty board is now always preferred to a plausible one.
// Set SHOW_PLACEHOLDER_STANDINGS=1 locally to see them.
const PLACEHOLDER_STANDINGS: Array<{ name: string; points: number }> = [
  { name: "KoiRunner", points: 737698 },
  { name: "SakuraDrift", points: 12055 },
  { name: "Torii", points: 9576 },
  { name: "NightPagoda", points: 6635 },
  { name: "FujiClimber", points: 4180 },
  { name: "LanternWake", points: 3021 },
  { name: "PineShadow", points: 1894 },
  { name: "BlueRidge", points: 1102 },
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
// board renders as "standings unavailable" rather than a 500.
async function safely(load: () => Promise<Standing[]>): Promise<Standing[]> {
  try {
    return await load();
  } catch (error) {
    console.error("leaderboard fetch failed:", error);
    return [];
  }
}

function rank(
  entries: Array<{ name: string; points: number }>,
  prizes: number[] = FALLBACK_PRIZES,
): Standing[] {
  return entries
    .filter((entry) => Number.isFinite(entry.points) && entry.points > 0)
    .sort((a, b) => b.points - a.points)
    .slice(0, prizes.length)
    .map((entry, index) => ({ ...entry, prize: prizes[index] ?? 0 }));
}

// Parses a published CSV (e.g. a Google Sheets "publish to web" link) with
// username,points columns — the common way affiliate exports are shared.
function parseCsv(text: string): Array<{ name: string; points: number }> {
  return text
    .split(/\r?\n/)
    .map((line) => line.split(","))
    .filter((cols) => cols.length >= 2)
    .map((cols) => ({
      name: cols[0].trim().replace(/^"|"$/g, ""),
      points: Number(cols[1].replace(/[^0-9.]/g, "")),
    }))
    .filter((entry) => entry.name && entry.name.toLowerCase() !== "username");
}

async function fetchStandings(prizes: number[]): Promise<Standing[]> {
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
          username?: string; name?: string;
          points?: number | string; wagered?: number | string;
        };
        return {
          name: item.username ?? item.name ?? "player",
          // Accept either key: Dicey reports points, other feeds report wagered.
          points: Number(item.points ?? item.wagered ?? 0),
        };
      }),
      prizes,
    );
  }

  // No feed configured. Showing nothing is the honest answer; the pages render
  // an explicit "standings appear here shortly" state for an empty board.
  if (env("SHOW_PLACEHOLDER_STANDINGS")) return rank(PLACEHOLDER_STANDINGS, prizes);
  return [];
}

export async function getBoardsData(): Promise<BoardsData> {
  const race = await fetchRaceConfig();
  // Prize ladder from Dicey's own payout tiers, so the rewards column cannot
  // drift from what they actually pay.
  const prizes = race?.payoutTiers.length
    ? prizesFromTiers(race.payoutTiers)
    : FALLBACK_PRIZES;

  const main = await safely(async () => {
    // An explicitly configured feed always wins — it is a deliberate override.
    if (env("LEADERBOARD_CSV_URL") || env("LEADERBOARD_API_URL")) {
      return fetchStandings(prizes);
    }
    // Otherwise read Dicey's own race directly. Their entries already carry a
    // per-player payout, so no local ladder is applied.
    if (race?.id) {
      const live = await fetchDiceyLeaderboard(race.id, prizes.length);
      // An empty array is an answer, not a failure. Dicey returns no entries
      // between races and while it recomputes standings mid-race — their own
      // page shows "the new leaderboard will appear here shortly" — so an
      // empty board must be rendered as empty. Only null means the call
      // itself failed, and even then we never invent players.
      if (live) {
        return live.map((e) => ({ name: e.name, points: e.points, prize: e.prize }));
      }
    }
    return fetchStandings(prizes);
  });

  return { main };
}
