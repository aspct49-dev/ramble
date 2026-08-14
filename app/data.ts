// Every brand-level string the site renders lives here, so renaming RambleGamble or
// swapping in a real partner is a one-file change.

export const brand = {
  name: "RambleGamble",
  wordmark: "/wordmark.png",
  tagline: "Leaderboards. Rewards. Live with RambleGamble.",
  summary:
    "A $1,000 bi-weekly leaderboard, the full Gamba VIP ladder, and every stream in one place.",
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

/** The code players type on Gamba. */
export const AFFILIATE_CODE = "RAMBLEGG";

/** The referral link Gamba issued. Kept separate from AFFILIATE_CODE because
    the link preserves Gamba's own casing ("RambleGG") while the site shows
    the code uppercased. */
export const AFFILIATE_URL = "https://gamba.com/?c=RambleGG";

/** Gamba's public VIP programme page, linked from /bonuses as the source of
    truth for tiers and terms — we summarise it, they own it. */
export const VIP_PROGRAM_URL = "https://gamba.com/vip-program";

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
    name: "Gamba",
    logo: "/gamba-logo.webp",
    logoAlt: "Gamba",
    code: AFFILIATE_CODE,
    url: AFFILIATE_URL,
    pool: "$1,000",
    paidPlaces: 5,
    period: "biweek",
  },
};

/**
 * The bi-weekly ladder, highest first. Must total the advertised pool —
 * 400+250+200+100+50 = 1000 — and a test asserts exactly that, so the two
 * cannot drift apart on the page.
 */
export const PRIZE_LADDER = [400, 250, 200, 100, 50] as const;

/**
 * Gamba's VIP programme, summarised from gamba.com/vip-program.
 *
 * Every figure here is one Gamba publishes. Nothing is invented and no rate is
 * quoted that their page does not state: the rank ladder pays on personal XP,
 * so a headline percentage would differ per player and read as a promise we
 * cannot keep. VIP_PROGRAM_URL stays linked as the authority.
 */
export type VipPerk = { name: string; blurb: string };

/** Recurring bonuses, in the order Gamba lists them. */
export const vipBonuses: readonly VipPerk[] = [
  {
    name: "Rank-Up Bonus",
    blurb:
      "A bonus tailored to how you actually play, claimable in full or drawn down gradually as you climb the ranks.",
  },
  {
    name: "Rakeback",
    blurb: "A share of the house edge back on every bet you place, win or lose.",
  },
  {
    name: "Daily Bonus",
    blurb:
      "A daily lossback reward scaled to your betting activity, running until ReJuice unlocks at Silver 2.",
  },
  {
    name: "Weekly Bonus",
    blurb: "Unlocked every week, calibrated to your wagers and losses over the previous seven days.",
  },
  {
    name: "Monthly Bonus",
    blurb: "A personalised monthly bonus built around your own play across the month.",
  },
];

/** Features that unlock as your rank climbs. */
export const vipFeatures: readonly VipPerk[] = [
  {
    name: "ReJuice",
    blurb: "A dynamic bonus driven by the past week's wagering and net losses.",
  },
  { name: "Personal VIP Host", blurb: "A dedicated host assigned to your account as you level up." },
  {
    name: "Lottery Tickets",
    blurb: "Earned as you play, with more available to buy, for the weekly progressive lottery.",
  },
  {
    name: "Gamba Points",
    blurb: "Redeemable for profile customisation — avatars, backgrounds and more.",
  },
  {
    name: "VIP Experiences",
    blurb: "Sports events, luxury stays and parties, on the house, for top-ranked players.",
  },
];

/** How a player enters the programme. 1 XP per $1 wagered. */
export const vipSteps: readonly { step: string; blurb: string }[] = [
  {
    step: "Sign up",
    blurb: `Create a Gamba account with code ${AFFILIATE_CODE}, deposit, and start betting on the casino or sportsbook.`,
  },
  {
    step: "Earn XP",
    blurb:
      "Every $1 wagered earns 1 XP. Challenges and achievements stack on top to move you up faster.",
  },
  {
    step: "Climb the ranks",
    blurb: "Each rank unlocks larger rakeback, reloads, free spins and the perks below.",
  },
];

/** Total-wagered bands for the published rank tiers, lowest first. */
export const vipTiers: readonly string[] = [
  "$5k – $15k",
  "$20k – $50k",
  "$75k – $150k",
  "$200k – $500k",
  "$1M – $5M",
  "$10M – $50M",
  "$100M – $500M",
];

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
 * Masks players on the public board: first four characters then four stars
 * ("nugg****"), or "Hidden" when there is no usable name.
 *
 * Unlike the previous partner, Gamba's affiliate feed returns raw usernames,
 * so this is now the only thing standing between the API and a player's
 * handle being published. It must be applied at every render site.
 */
export function maskedName(name: string) {
  const clean = (name ?? "").trim();
  if (!clean || clean.toLowerCase() === "hidden") return "Hidden";
  return `${clean.slice(0, 4)}****`;
}

/**
 * Gamba's affiliate feed reports dollars wagered, so the board shows currency.
 * Rounded to whole dollars: the feed returns cents (150.75) and a column of
 * ragged decimals reads as noise at a glance.
 */
export function wagered(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
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
