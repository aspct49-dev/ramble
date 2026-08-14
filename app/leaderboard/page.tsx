import type { Metadata } from "next";
import { boards, brand } from "../data";
import { getBoardsData } from "../lib/leaderboards";
import { fetchRaceConfig } from "../lib/dicey-race";
import { LeaderboardClient } from "./leaderboard-client";

// Revalidate rather than force-dynamic: force-dynamic blocks prefetching and
// makes every click wait on a server round-trip. 60s matches the cache TTL
// already inside getBoardsData(), so this costs no extra staleness.
export const revalidate = 60;

export const metadata: Metadata = {
  title: "Leaderboard",
  description:
    `Live standings for ${brand.name}'s ${boards.main.pool} bi-weekly ${boards.main.name} leaderboard under code ${boards.main.code}. Updated every 60 seconds.`,
  alternates: { canonical: "/leaderboard" },
  openGraph: {
    title: `${brand.name} ${boards.main.pool} Bi-Weekly Leaderboard`,
    description:
      `Live standings for ${brand.name}'s ${boards.main.pool} bi-weekly wager race under code ${boards.main.code}.`,
    url: "/leaderboard",
    images: ["/og.png"],
  },
};

export default async function LeaderboardPage() {
  const [standings, race] = await Promise.all([getBoardsData(), fetchRaceConfig()]);
  const raceWindow = race ? { start: race.startsAt, end: race.endsAt } : null;
  return <LeaderboardClient standings={standings} raceWindow={raceWindow} />;
}
