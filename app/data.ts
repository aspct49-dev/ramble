// Every brand-level string the site renders lives here, so renaming RambleGamble or
// swapping in a real partner is a one-file change.

export const brand = {
  name: "RambleGamble",
  wordmark: "/wordmark.png",
  tagline: "Leaderboards. Rewards. Live with RambleGamble.",
  summary:
    "A $5,000 monthly Maxxed leaderboard, no-wagering bonuses, and every stream in one place.",
  kicker: "Official Partner",
} as const;

/** Kick channel slug — drives both the embedded player and the watch links. */
export const KICK_SLUG = "ramblegamble";

/**
 * Chatroom id for KICK_SLUG, used to subscribe to Kick's chat socket.
 *
 * Configured rather than resolved at runtime, because it cannot be looked up
 * from either side: kick.com/api/v2/channels sends no CORS headers, so the
 * browser is blocked, and Cloudflare fingerprints the TLS handshake, so a
 * server fetch gets 403 no matter what headers it sends. curl passes, which
 * is why `pnpm kick:chatroom` shells out to it.
 *
 * Re-run that script if the giveaway picker connects but never sees a
 * message — a wrong id subscribes successfully and then stays silent, since
 * Pusher creates public channels on demand.
 */
export const KICK_CHATROOM_ID = 17249070;

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
export const AFFILIATE_CODE = "RAMBLE";

export type BoardKey = "maxxed";
/**
 * How long a race runs. The named periods follow the calendar; a cycle is a
 * race from a start day (UTC) lasting a fixed number of days or calendar
 * months, repeating back to back after it.
 */
export type RaceCycle = { start: string; days: number } | { start: string; months: number };
export type BoardPeriod = "week" | "biweek" | "month" | RaceCycle;

/** Which feed a board's standings come from. */
export type BoardSource = "maxxed";

/**
 * What the partner's feed actually measures. Some partners rank on points;
 * others report dollars wagered. Labelling one as the other puts a number on
 * screen that means something else, so each board carries its own.
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
    key: "maxxed",
    name: "Maxxed",
    logo: "/maxxed_logo.svg",
    code: AFFILIATE_CODE,
    url: "https://maxxed.io",
    pool: "$5,000",
    prizes: [2000, 1000, 600, 400, 300, 250, 200, 125, 75, 50],
    // 16 Oct to 16 Nov 2026 (UTC), then the 16th to the 16th each month.
    // Move `start` to restart the clock.
    period: { start: "2026-10-16", months: 1 },
    source: "maxxed",
    metric: "wagered",
    // Maxxed's own packs, as published on their site. Every one is
    // no-wagering, so that leads each card.
    offers: [
      {
        badge: "No Wagering",
        headline: "Sportsbook",
        amount: "$2,500",
        suffix: "Free Bets",
        blurb: "Up to $2,500 in free bets on the sportsbook.",
        terms: [
          "Min deposit $100",
          "Eligible: Sportsbook",
          "Duration: 7 days",
          "Max payout: Unlimited",
        ],
        note: "No wagering requirement on winnings.",
      },
      {
        badge: "No Wagering",
        headline: "Highroller",
        amount: "20%",
        suffix: "Cashback",
        blurb: "20% cashback across the casino and sportsbook.",
        terms: [
          "Min deposit $500",
          "Eligible: Casino + Sports",
          "Duration: 7 days",
          "Max payout: Unlimited",
        ],
        note: "No wagering requirement on cashback.",
      },
      {
        badge: "No Wagering",
        headline: "Casino",
        amount: "2,500",
        suffix: "Free Spins",
        blurb: "Up to 2,500 free spins on slots.",
        terms: [
          "Min deposit $100",
          "Eligible: Slots",
          "Duration: 7 days",
          "Max payout: Unlimited",
        ],
        note: "No wagering requirement on winnings.",
      },
    ],
    wagerTiers: [],
  },
];

/** The board the home page previews and the nav badge advertises. */
export const primaryBoard = boards[0];

export function boardByKey(key: BoardKey): BoardConfig | undefined {
  return boards.find((board) => board.key === key);
}

export const paidPlaces = (board: BoardConfig) => board.prizes.length;

/** The race length as a heading word: "Monthly", "Bi-Weekly", "Weekly". */
export function periodName(board: BoardConfig) {
  if (board.period === "week") return "Weekly";
  if (board.period === "biweek") return "Bi-Weekly";
  return "Monthly";
}

/** When the race resets, as a phrase: "every month". */
export function periodReset(board: BoardConfig) {
  if (board.period === "week") return "every week";
  if (board.period === "biweek") return "every two weeks";
  if (typeof board.period === "object") {
    if ("months" in board.period) {
      const day = Number(board.period.start.slice(8, 10));
      const suffix = day % 10 === 1 && day !== 11 ? "st" : day % 10 === 2 && day !== 12 ? "nd" : day % 10 === 3 && day !== 13 ? "rd" : "th";
      return board.period.months === 1
        ? `on the ${day}${suffix} of every month`
        : `every ${board.period.months} months`;
    }
    return `every ${board.period.days} days`;
  }
  return "every month";
}

/** Every board's ladder added up — what the nav badge and meta copy advertise. */
export const totalPool = boards.reduce(
  (sum, board) => sum + board.prizes.reduce((a, b) => a + b, 0),
  0,
);

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
 * Affiliate feeds can return raw usernames, so this can be the only thing
 * between a feed and a player's handle being published. It must be applied at every render
 * site.
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
