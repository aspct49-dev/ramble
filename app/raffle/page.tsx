import type { Metadata } from "next";
import { brand, raffle, rafflePool } from "../data";
import { affiliateConfigured, fetchWagering } from "../lib/dicey-affiliate";
import { buildRaffle } from "../lib/raffle";
import { RaffleClient } from "./raffle-client";

// Dicey's docs suggest polling every 30–60s; 60 keeps every route static.
export const revalidate = 60;

const poolText = `$${rafflePool.toLocaleString("en-US")}`;

export const metadata: Metadata = {
  title: "Monthly Raffle",
  description:
    `${brand.name}'s ${poolText} monthly raffle: every $${raffle.ticketCostUsd} wagered earns a ticket, and every ticket is a chance at a drawn prize position.`,
  alternates: { canonical: "/raffle" },
  openGraph: {
    title: `${brand.name} | ${poolText} Monthly Raffle`,
    description: `Every $${raffle.ticketCostUsd} wagered earns one ticket.`,
    url: "/raffle",
    images: ["/og.png"],
  },
};

export default async function RafflePage() {
  const from = new Date(raffle.startsAt);
  const to = new Date(raffle.endsAt);

  const rows = affiliateConfigured() ? await fetchWagering(from, to) : null;
  const result =
    rows === null
      ? null
      : buildRaffle(rows, {
          ticketCostUsd: raffle.ticketCostUsd,
          endsAt: to,
          prizes: raffle.prizes,
        });

  return <RaffleClient result={result} />;
}
