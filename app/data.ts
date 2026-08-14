// Every brand-level string the site renders lives here, so renaming RambleGamble or
// swapping in a real partner is a one-file change.

export const brand = {
  name: "RambleGamble",
  wordmark: "/wordmark.png",
  tagline: "Leaderboards. Rewards. Live with RambleGamble.",
  summary:
    "A $5,000 bi-weekly leaderboard, monthly wager prizes, 15% lossback, and every stream in one place.",
  kicker: "Official Partner",
} as const;

/** Kick channel slug — drives both the embedded player and the watch links. */
export const KICK_SLUG = "ramblegamble";

export const socials = {
  kick: `https://kick.com/${KICK_SLUG}`,
  x: "https://x.com/RambleGG",
  discord: "https://discord.gg/ramblegamble",
} as const;

/** Kick's embeddable player. Renders its own offline state when not live. */
export const KICK_EMBED_URL = `https://player.kick.com/${KICK_SLUG}`;

export const DISCORD_URL = socials.discord;
export const WATCH_URL = socials.kick;

/** The code players type on Dicey. */
export const AFFILIATE_CODE = "RAMBLEGG";

/** The referral link Dicey issued. Kept separate from AFFILIATE_CODE because
    the link preserves Dicey's own casing ("RambleGG") while the site shows
    the code uppercased. */
export const AFFILIATE_URL = "https://dicey.com/signup?ref=RambleGG";

export type BoardKey = "main";
export type BoardPeriod = "week" | "biweek" | "month";

export type BoardConfig = {
  key: BoardKey;
  name: string;
  logo: string;
  logoAlt: string;
  code: string;
  url: string;
  pool: string;
  paidPlaces: number;
  period: BoardPeriod;
};

export const boards: Record<BoardKey, BoardConfig> = {
  main: {
    key: "main",
    name: "Dicey",
    logo: "/dicey_logo.webp",
    logoAlt: "Dicey",
    code: AFFILIATE_CODE,
    url: AFFILIATE_URL,
    pool: "$5,000",
    paidPlaces: 8,
    period: "biweek",
  },
};

/** First-deposit offer for new sign-ups. */
export const welcomeOffer = {
  amount: "$5,000",
  headline: "100% Deposit Match",
  blurb: "Doubled on your first deposit, up to $5,000.",
  terms: [
    "100% match on your first deposit",
    "Up to $5,000",
    "20x rollover",
    "New users only",
  ],
} as const;

/** Standing offer for anyone signed up under the code. */
export const lossback = {
  amount: "15%",
  headline: "Lossback",
  blurb: "Paid back on losses, for everyone using the code.",
  terms: [
    "15% of net losses returned",
    "Available to all code users",
    "No opt-in required",
    "Stacks with the wager prizes",
  ],
} as const;

export type WheelPrize = {
  /** Large line on the wedge. */
  amount: string;
  /** Smaller line beneath it — the segments are narrow, so keep it short. */
  kind: string;
  /** Full prize name, shown in the win dialog. */
  name: string;
};

/**
 * Wheel segments. The four prizes are laid out twice, alternating, so the
 * face reads as eight wedges — four is too sparse to look like a wheel — and
 * every prize keeps an equal 1-in-4 chance.
 */
export const wheelPrizes: readonly WheelPrize[] = [
  { amount: "$10", kind: "TIP", name: "$10 Tip" },
  { amount: "$40", kind: "BONUS BUY", name: "$40 Bonus Buy" },
  { amount: "$20", kind: "TIP", name: "$20 Tip" },
  { amount: "$60", kind: "BONUS BUY", name: "$60 Bonus Buy" },
  { amount: "$10", kind: "TIP", name: "$10 Tip" },
  { amount: "$40", kind: "BONUS BUY", name: "$40 Bonus Buy" },
  { amount: "$20", kind: "TIP", name: "$20 Tip" },
  { amount: "$60", kind: "BONUS BUY", name: "$60 Bonus Buy" },
];

/**
 * Wager milestones, paid on total wagered. Resets monthly — a separate
 * cadence from the bi-weekly leaderboard, so the two are shown apart.
 */
export const wagerPrizes: ReadonlyArray<{ wagered: string; prize: string }> = [
  { wagered: "$5,000", prize: "$20" },
  { wagered: "$10,000", prize: "$50" },
  { wagered: "$25,000", prize: "$125" },
  { wagered: "$50,000", prize: "$250" },
  { wagered: "$100,000", prize: "$500" },
  { wagered: "$500,000", prize: "$1,000" },
];

/**
 * Matches how Dicey masks players on the race page: the first four characters
 * then four stars ("nugg****"), or "Hidden" when the player has opted out.
 */
export function maskedName(name: string) {
  const clean = (name ?? "").trim();
  if (!clean || clean.toLowerCase() === "hidden") return "Hidden";
  return `${clean.slice(0, 4)}****`;
}

/**
 * Dicey ranks on points, not dollars wagered — a whole number with thousands
 * separators and no currency symbol.
 */
export function points(value: number) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value);
}

export function badgeFor(name: string) {
  return name.slice(0, 2).toUpperCase();
}

export function money(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}
