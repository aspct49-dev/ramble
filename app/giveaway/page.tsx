import type { Metadata } from "next";
import { brand } from "../data";
import { GiveawayClient } from "./giveaway-client";

export const metadata: Metadata = {
  title: "Giveaway Picker",
  description:
    `Run a live giveaway from ${brand.name}'s Kick chat: collect entries by keyword and draw a winner at random.`,
  alternates: { canonical: "/giveaway" },
  openGraph: {
    title: `${brand.name} | Kick Giveaway Picker`,
    description: "Collect entries from Kick chat by keyword and draw a winner at random.",
    url: "/giveaway",
    images: ["/og.png"],
  },
};

export default function GiveawayPage() {
  return <GiveawayClient />;
}
