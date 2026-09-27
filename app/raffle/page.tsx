import { permanentRedirect } from "next/navigation";

/**
 * The raffle was replaced by the Kingz leaderboard. Kept as a permanent
 * redirect so existing links and anything already indexed land on the
 * replacement instead of a 404.
 */
export default function RafflePage(): never {
  permanentRedirect("/leaderboard");
}
