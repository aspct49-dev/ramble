"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { boards, primaryBoard, brand, DISCORD_URL } from "../data";

// Total across every board, so the badge reflects what is actually on offer.
const totalPool = boards.reduce((sum, b) => sum + b.prizes.reduce((a, p) => a + p, 0), 0);
const poolBadge = totalPool >= 1000 ? `$${Math.round(totalPool / 1000)}K` : `$${totalPool}`;

const navigation = [
  { href: "/", label: "Home" },
  // Derived, not typed: a hardcoded "$5K" is exactly how the nav came to
  // advertise a pool the leaderboard no longer paid.
  { href: "/leaderboard", label: "Leaderboard", badge: poolBadge },
  { href: "/wheel", label: "Wheel" },
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
