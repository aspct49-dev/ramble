import { permanentRedirect } from "next/navigation";

/**
 * The leaderboard became the monthly raffle. Kept as a permanent redirect so
 * existing links, the old sitemap entry and anything already indexed land on
 * the replacement instead of a 404.
 */
export default function LeaderboardPage(): never {
  permanentRedirect("/raffle");
}
