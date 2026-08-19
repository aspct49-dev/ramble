"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { primaryBoard, brand, rafflePool, DISCORD_URL } from "../data";

// The raffle pool, so the badge matches what is actually on the table.
const totalPool = rafflePool;
const poolBadge = totalPool >= 1000 ? `$${Math.round(totalPool / 1000)}K` : `$${totalPool}`;

const navigation = [
  { href: "/", label: "Home" },
  // Derived, not typed: a hardcoded "$5K" is exactly how the nav came to
  // advertise a pool the leaderboard no longer paid.
  { href: "/raffle", label: "Raffle", badge: poolBadge },
  { href: "/wheel", label: "Wheel" },
  { href: "/giveaway", label: "Giveaway" },
  { href: "/#rewards", label: "Rewards" },
  { href: "/#stream", label: "Stream" },
];

export function SiteHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <header className="siteHeader">
      <nav className="topNav" aria-label="Primary navigation">
        <Link
          className="brand"
          href="/"
          aria-label={`${brand.name} home`}
          onClick={() => setOpen(false)}
        >
          <img src={brand.wordmark} alt={brand.name} />
        </Link>

        <div className={`navLinks ${open ? "open" : ""}`}>
          {navigation.map((item) => (
            <Link
              className={pathname === item.href ? "active" : ""}
              href={item.href}
              key={item.href}
              onClick={() => setOpen(false)}
            >
              {item.label}
              {item.badge && <span className="navBadge">{item.badge}</span>}
            </Link>
          ))}
        </div>

        <div className="navEnd">
          <a
            className="headerAction"
            href={DISCORD_URL}
            target="_blank"
            rel="noreferrer"
          >
            Claim Reward
          </a>

          <button
            className={`menuButton ${open ? "open" : ""}`}
            type="button"
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            onClick={() => setOpen((current) => !current)}
            title={open ? "Close menu" : "Open menu"}
          >
            <span />
            <span />
            <span />
          </button>
        </div>
      </nav>
      <span className="headerCode" aria-hidden="true">
        Code {primaryBoard.code}
      </span>
    </header>
  );
}
