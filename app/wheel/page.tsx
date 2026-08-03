import type { Metadata } from "next";
import { boards, brand } from "../data";
import { WheelClient } from "./wheel-client";

export const metadata: Metadata = {
  title: "Wheel",
  description:
    `Spin the ${brand.name} prize wheel for tips and bonus buys under code ${boards.main.code}.`,
  alternates: { canonical: "/wheel" },
  openGraph: {
    title: `${brand.name} Prize Wheel`,
    description:
      `Spin for tips and bonus buys under code ${boards.main.code}.`,
    url: "/wheel",
    images: ["/og.png"],
  },
};

export default function WheelPage() {
  return <WheelClient />;
}
