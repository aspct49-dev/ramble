import type { Metadata } from "next";
import { boards, brand, periodName, primaryBoard, totalPool } from "../data";
import { getBoardsData } from "../lib/leaderboards";
import { LeaderboardClient } from "./leaderboard-client";

// Revalidate rather than force-dynamic: force-dynamic blocks prefetching and
// makes every click wait on a server round-trip. 60s matches the revalidate on
// the outbound feed fetches, so this costs no extra staleness.
export const revalidate = 60;

// Derived from the configured boards so adding a partner updates the copy
// rather than leaving it advertising a pool that is no longer the whole story.
const partners = boards.map((board) => board.name).join(" and ");
const poolText = `$${totalPool.toLocaleString("en-US")}`;
const period = periodName(primaryBoard);

export const metadata: Metadata = {
  title: "Leaderboard",
  description:
    `Live standings for ${brand.name}'s ${poolText} ${period.toLowerCase()} ${partners} leaderboard under code ${primaryBoard.code}. Updated every 60 seconds.`,
  alternates: { canonical: "/leaderboard" },
  openGraph: {
    title: `${brand.name} ${poolText} ${period} Leaderboard`,
    description:
      `Live standings for ${brand.name}'s ${poolText} ${period.toLowerCase()} wager race under code ${primaryBoard.code}.`,
    url: "/leaderboard",
    images: ["/og.png"],
  },
};

export default async function LeaderboardPage() {
  const standings = await getBoardsData();
  return <LeaderboardClient standings={standings} />;
}
