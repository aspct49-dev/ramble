import type { Metadata } from "next";
import Link from "next/link";
import {
  boards,
  brand,
  vipBonuses,
  vipFeatures,
  vipSteps,
  vipTiers,
  VIP_PROGRAM_URL,
} from "../data";
import { MotionObserver } from "../components/motion-observer";
import { PETALS_SIDES, PetalField } from "../components/petal-field";

const board = boards.main;

export const metadata: Metadata = {
  title: "Bonuses",
  description:
    `Every ${board.name} bonus available under code ${board.code}: rakeback, daily, weekly and monthly bonuses, ReJuice, lottery tickets and the full VIP ladder.`,
  alternates: { canonical: "/bonuses" },
  openGraph: {
    title: `${brand.name} | ${board.name} Bonuses and VIP Programme`,
    description:
      `Rakeback, daily, weekly and monthly bonuses on ${board.name} under code ${board.code}.`,
    url: "/bonuses",
    images: ["/og.png"],
  },
};

export default function BonusesPage() {
  return (
    <main className="lbPage bonusesPage">
      <MotionObserver />

      <section className="lbHero">
        <PetalField petals={PETALS_SIDES} className="lbPetals" />
        <img className="casinoLogo" src={board.logo} alt={board.logoAlt} />
        <h1 className="lbTitle">
          <span>{board.name}</span> Bonuses
        </h1>
        <p className="lbSub">
          Every reward on {board.name} is driven by one number: XP. You earn 1 XP for every $1
          wagered, and each rank you clear unlocks more.
        </p>
        <div className="codeRow">
          <span className="codePill">
            Code: <strong>{board.code}</strong>
          </span>
          <a className="primaryAction" href={board.url} target="_blank" rel="noreferrer">
            Join {board.name} ↗
          </a>
        </div>
      </section>

      <section className="homeSection" aria-label="How the VIP programme works">
        <div className="centerHeading" data-reveal="heading">
          <h2>GETTING STARTED</h2>
          <p className="underCode">Three steps onto the ladder</p>
        </div>
        <ol className="vipSteps">
          {vipSteps.map(({ step, blurb }, index) => (
            <li className="vipStep" key={step} data-reveal="card">
              <span className="vipStepNum" aria-hidden="true">
                {index + 1}
              </span>
              <div>
                <h3>{step}</h3>
                <p>{blurb}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <div className="band bandDusk">
        <section className="homeSection" aria-label={`${board.name} bonuses`}>
          <div className="centerHeading" data-reveal="heading">
            <h2>BONUSES</h2>
            <p className="underCode">Paid on a rolling schedule as you play</p>
          </div>
          <div className="perkGrid">
            {vipBonuses.map((perk) => (
              <article className="perkCard" key={perk.name} data-reveal="card">
                <h3>{perk.name}</h3>
                <p>{perk.blurb}</p>
              </article>
            ))}
          </div>
        </section>
      </div>

      <div className="band bandNight">
        <section className="homeSection" aria-label="Unlockable features">
          <div className="centerHeading" data-reveal="heading">
            <h2>UNLOCKABLES</h2>
            <p className="underCode">Features that open up as your rank climbs</p>
          </div>
          <div className="perkGrid">
            {vipFeatures.map((perk) => (
              <article className="perkCard" key={perk.name} data-reveal="card">
                <h3>{perk.name}</h3>
                <p>{perk.blurb}</p>
              </article>
            ))}
          </div>

          <div className="wagerTiers" data-reveal="section">
            <div className="wagerTiersHead">
              <h3>Rank Ladder</h3>
              <span>Total wagered</span>
            </div>
            <ol className="vipTierList">
              {vipTiers.map((tier, index) => (
                <li className="vipTier" key={tier}>
                  <span className="vipTierRank" aria-hidden="true">
                    {index + 1}
                  </span>
                  <span className="vipTierBand">{tier}</span>
                </li>
              ))}
            </ol>
            {/* Gamba owns the exact per-rank rewards and revises them, so we
                summarise the ladder and send players to their page for terms
                rather than restating numbers that could go stale here. */}
            <p className="wagerTierNote">
              Each band unlocks a higher rank with larger rakeback, reloads and free spins.{" "}
              <a href={VIP_PROGRAM_URL} target="_blank" rel="noreferrer">
                Full rank details and terms on {board.name} ↗
              </a>
            </p>
          </div>

          <div className="bonusesCta">
            <Link className="primaryAction" href="/leaderboard">
              View the {board.pool} leaderboard
            </Link>
            <a className="secondaryAction" href={board.url} target="_blank" rel="noreferrer">
              Sign up with code {board.code} ↗
            </a>
          </div>
        </section>
      </div>
    </main>
  );
}
