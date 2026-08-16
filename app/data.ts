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

/** The code players type on a partner site. Shared across partners today. */
export const AFFILIATE_CODE = "RAMBLEGG";

export type BoardKey = "dicey";
export type BoardPeriod = "week" | "biweek" | "month";

/** Which feed a board's standings come from. */
export type BoardSource = "dicey";

/**
 * What the partner's feed actually measures. Dicey ranks on points; other
 * affiliate feeds report dollars wagered. Labelling one as the other puts a
 * number on screen that means something else, so each board carries its own.
 */
export type BoardMetric = "wagered" | "points";

/** A headline offer on a partner site, shown as a card in the rewards grid. */
export type BoardOffer = {
  badge: string;
  headline: string;
  amount: string;
  /** Short word after the amount: "Match", "Back". */
  suffix: string;
  blurb: string;
  terms: readonly string[];
  note: string;
};

/** A wager milestone ladder, paid on total wagered. */
export type WagerTier = { wagered: string; prize: string };

export type BoardConfig = {
  key: BoardKey;
  name: string;
  /** Partner artwork. Null renders a text wordmark instead of a broken image. */
  logo: string | null;
  code: string;
  url: string;
  pool: string;
  /** Highest first. Must sum to `pool` — a test asserts it. */
  prizes: readonly number[];
  period: BoardPeriod;
  source: BoardSource;
  metric: BoardMetric;
  /**
   * Offers this partner actually publishes. Empty is meaningful: we show no
   * bonus rather than borrow another casino's terms, because advertising a
   * bonus a partner does not offer is worse than advertising none.
   */
  offers: readonly BoardOffer[];
  /** Monthly wager milestones, if the partner runs them. */
  wagerTiers: readonly WagerTier[];
};

/**
 * Every board the site runs, in display order.
 *
 * A list rather than a single "main" board: adding a partner is one entry
 * here plus a fetch branch, not a rewrite of every consumer. The leaderboard
 * page renders one section per entry, so it reads correctly with one board
 * or several.
 */
export const boards: readonly BoardConfig[] = [
  {
    key: "dicey",
    name: "Dicey",
    logo: "/dicey_logo.webp",
    code: AFFILIATE_CODE,
    url: "https://dicey.com/signup?ref=RambleGG",
    pool: "$5,000",
    prizes: [2000, 850, 650, 500, 400, 300, 200, 100],
    period: "biweek",
    source: "dicey",
    metric: "points",
    offers: [
      {
        badge: "New players",
        headline: "100% Deposit Match",
        amount: "$5,000",
        suffix: "Match",
        blurb: "Doubled on your first deposit, up to $5,000.",
        terms: [
          "100% match on your first deposit",
          "Up to $5,000",
          "20x rollover",
          "New users only",
        ],
        note: "First deposit only. 20x rollover applies.",
      },
      {
        badge: "All code users",
        headline: "Lossback",
        amount: "15%",
        suffix: "Back",
        blurb: "Paid back on losses, for everyone using the code.",
        terms: [
          "15% of net losses returned",
          "Available to all code users",
          "No opt-in required",
          "Stacks with the wager prizes",
        ],
        note: `Sign up under code ${AFFILIATE_CODE} to qualify automatically.`,
      },
    ],
    wagerTiers: [
      { wagered: "$5,000", prize: "$20" },
      { wagered: "$10,000", prize: "$50" },
      { wagered: "$25,000", prize: "$125" },
      { wagered: "$50,000", prize: "$250" },
      { wagered: "$100,000", prize: "$500" },
      { wagered: "$500,000", prize: "$1,000" },
    ],
  },
];

/** The board the home page previews and the nav badge advertises. */
export const primaryBoard = boards[0];

export function boardByKey(key: BoardKey): BoardConfig | undefined {
  return boards.find((board) => board.key === key);
}

export const paidPlaces = (board: BoardConfig) => board.prizes.length;

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
 * Masks players on the public board: the first four characters then four
 * stars ("nugg****"), or "Hidden" when there is no usable name.
 *
 * Dicey masks server-side, but an affiliate feed may return raw usernames —
 * so this can be the only thing between an API and a player's handle being
 * published. It must be applied at every render site.
 */
export function maskedName(name: string) {
  const clean = (name ?? "").trim();
  if (!clean || clean.toLowerCase() === "hidden") return "Hidden";
  return `${clean.slice(0, 4)}****`;
}

/** Points: a whole number, thousands separated, no currency symbol. */
export function points(value: number) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value);
}

/**
 * Dollars wagered. Rounded to whole dollars — the feed reports cents
 * (150.75) and a column of ragged decimals reads as noise at a glance.
 */
export function wagered(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

/** Formats a board's score using whatever that partner actually measures. */
export function score(board: BoardConfig, value: number) {
  return board.metric === "wagered" ? wagered(value) : points(value);
}

/** Column heading for a board's score. */
export function scoreLabel(board: BoardConfig) {
  return board.metric === "wagered" ? "Wagered" : "Points";
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
