import type { WageringEntry } from "./dicey-affiliate";

export type Entrant = {
  id: string;
  username: string;
  vipLevel: string | null;
  wagered: number;
  tickets: number;
};

export type DrawnPlace = {
  /** 1-based finishing position. */
  place: number;
  entrant: Entrant;
  prize: number;
};

export type RaffleResult = {
  entrants: Entrant[];
  totalTickets: number;
  totalWagered: number;
  /** Highest ticket count; wins the guaranteed prize regardless of the draw. */
  topHolder: Entrant | null;
  closed: boolean;
  /** Null until the window closes — the draw has not happened yet. */
  draw: DrawnPlace[] | null;
  /** Published so anyone can re-run the draw and check it. */
  seed: string;
};

/** Whole tickets only: $49 of wagering is no ticket, $99 is one. */
export function ticketsFor(wagered: number, costPerTicket: number): number {
  if (!(costPerTicket > 0)) return 0;
  return Math.max(0, Math.floor(wagered / costPerTicket));
}

/** FNV-1a, for turning the raffle's final state into a 32-bit seed. */
function hashSeed(text: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

/** mulberry32 — small, fast, and identical everywhere it runs. */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * A weighted random order, where every ticket is one equal chance.
 *
 * Efraimidis–Spirakis: give each entrant the key U^(1/tickets) and sort
 * descending. That yields a weighted permutation without replacement in one
 * pass — nobody can be drawn twice, and holding twice the tickets means twice
 * the chance at every position, not just the first.
 *
 * Seeded from the raffle's own final state, so it is deterministic: the same
 * entrants and tickets always produce the same order. Without that the
 * positions would reshuffle on every page load and every server render.
 */
function weightedOrder(entrants: Entrant[], seed: number): Entrant[] {
  const next = rng(seed);
  return entrants
    .map((entrant) => {
      const u = Math.max(next(), Number.EPSILON);
      return { entrant, key: Math.pow(u, 1 / entrant.tickets) };
    })
    .sort((a, b) => b.key - a.key || a.entrant.id.localeCompare(b.entrant.id))
    .map((scored) => scored.entrant);
}

/** Ranks on tickets, then wagered, then id — so ties never wobble. */
function byTickets(a: Entrant, b: Entrant): number {
  return b.tickets - a.tickets || b.wagered - a.wagered || a.id.localeCompare(b.id);
}

export function buildRaffle(
  rows: WageringEntry[],
  options: {
    ticketCostUsd: number;
    endsAt: Date;
    prizes: readonly number[];
    now?: Date;
  },
): RaffleResult {
  const { ticketCostUsd, endsAt, prizes } = options;
  const now = options.now ?? new Date();

  const entrants: Entrant[] = rows
    .map((row) => ({
      id: row.id,
      username: row.username,
      vipLevel: row.vipLevel,
      wagered: row.wagered,
      tickets: ticketsFor(row.wagered, ticketCostUsd),
    }))
    // No ticket, no entry. Showing someone in a raffle they cannot win is
    // worse than leaving them out.
    .filter((entrant) => entrant.tickets > 0)
    .sort(byTickets);

  const totalTickets = entrants.reduce((sum, e) => sum + e.tickets, 0);
  const totalWagered = entrants.reduce((sum, e) => sum + e.wagered, 0);
  const closed = now.getTime() >= endsAt.getTime();

  // Includes the ticket counts, so the seed cannot be known before entries
  // close — and can be recomputed afterwards by anyone holding the same data.
  const seedText = `${endsAt.toISOString()}|${entrants.map((e) => `${e.id}:${e.tickets}`).join(",")}`;
  const seed = hashSeed(seedText);

  let draw: DrawnPlace[] | null = null;
  if (closed && entrants.length > 0) {
    draw = weightedOrder(entrants, seed)
      .slice(0, prizes.length)
      .map((entrant, index) => ({
        place: index + 1,
        entrant,
        prize: prizes[index] ?? 0,
      }));
  }

  return {
    entrants,
    totalTickets,
    totalWagered,
    topHolder: entrants[0] ?? null,
    closed,
    draw,
    seed: seed.toString(16).padStart(8, "0"),
  };
}
