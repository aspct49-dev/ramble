"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { boards, brand, DISCORD_URL } from "../data";

const navigation = [
  { href: "/", label: "Home" },
  { href: "/leaderboard", label: "Leaderboard", badge: "$5K" },
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
        Code {boards.main.code}
      </span>
    </header>
  );
}
