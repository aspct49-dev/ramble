import type { Metadata } from "next";
import Link from "next/link";
import {
  AFFILIATE_CODE,
  boards,
  brand,
  DISCORD_URL,
  lossback,
  maskedName,
  money,
  points,
  wagerPrizes,
  WATCH_URL,
  welcomeOffer,
} from "./data";
import { StreamSection } from "./components/stream-section";
import { PETALS_BACK, PETALS_FRONT, PetalField } from "./components/petal-field";
import { MotionObserver } from "./components/motion-observer";
import { getBoardsData } from "./lib/leaderboards";

// Revalidate rather than force-dynamic: force-dynamic blocks prefetching and
// makes every click wait on a server round-trip. 60s matches the cache TTL
// already inside getBoardsData(), so this costs no extra staleness.
export const revalidate = 60;

export const metadata: Metadata = {
  title: `${brand.name} | Bi-Weekly Leaderboard and Rewards`,
  description:
    `Join ${brand.name}'s $5,000 bi-weekly Dicey leaderboard with code ${AFFILIATE_CODE}, claim a 100% deposit match up to $5,000, 15% lossback and monthly wager prizes.`,
  alternates: { canonical: "/" },
  openGraph: {
    title: `${brand.name} | Bi-Weekly Leaderboard and Rewards`,
    description:
      `Compete in ${brand.name}'s $5,000 bi-weekly Dicey leaderboard under code ${AFFILIATE_CODE} and win your share of the prize pool.`,
    url: "/",
    images: ["/og.png"],
  },
};

const ribbonPlaces = [2, 1, 3];

// Cloud banks: [sprite, top %, width px, drift s, delay s].
//
// Two genuine depth planes rather than one. Far clouds are small, slow and
// sit high; near clouds are large, fast and low. The size and speed gap is
// what makes the parallax read — the CSS then grades their colour to match.
const CLOUDS_FAR: Array<[number, number, number, number, number]> = [
  [3, 9, 78, 190, 0],
  [1, 15, 62, 230, -70],
  [2, 6, 94, 205, -140],
  [3, 21, 54, 250, -35],
  [1, 27, 70, 215, -175],
];

const CLOUDS_NEAR: Array<[number, number, number, number, number]> = [
  [2, 12, 300, 68, -10],
  [3, 24, 240, 58, -40],
  [1, 5, 340, 78, -62],
  [2, 33, 210, 52, -25],
];

function CloudDrift({ clouds, plane }: { clouds: typeof CLOUDS_FAR; plane: string }) {
  return (
    <div className={`cloudLayer ${plane}`} aria-hidden="true">
      {clouds.map(([sprite, top, width, drift, delay], index) => (
        <img
          className="driftCloud"
          key={index}
          src={`/drift-${sprite}.png`}
          alt=""
          style={{
            top: `${top}%`,
            width: `${width}px`,
            animationDuration: `${drift}s`,
            animationDelay: `${delay}s`,
          }}
        />
      ))}
    </div>
  );
}

export default async function Home() {
  const { main } = await getBoardsData();
  const board = boards.main;
  const topThree = main.slice(0, 3);
  const ribbonOrder = topThree.length === 3 ? [topThree[1], topThree[0], topThree[2]] : [];

  return (
    <main>
      <MotionObserver />
      <section className="homeHero" aria-labelledby="home-hero-title">
        {/* Depth planes, far to near. Each is graded in CSS so the distance
            reads through colour as well as scale and speed. */}
        <div className="heroSky" aria-hidden="true" />
        <div className="heroHaze" aria-hidden="true" />
        <div className="heroSunGlow" aria-hidden="true" />
        <CloudDrift clouds={CLOUDS_FAR} plane="cloudsFar" />
        <PetalField petals={PETALS_BACK} className="petalsBack" />

        <img className="heroPagoda" src="/pagoda.png" alt="" aria-hidden="true" />
        <CloudDrift clouds={CLOUDS_NEAR} plane="cloudsNear" />

        <div className="waterBand waterBack" aria-hidden="true" />
        <div className="heroKoi" aria-hidden="true">
          <img src="/koi-mascot.png" alt="" />
        </div>
        <div className="waterBand waterFront" aria-hidden="true" />

        <PetalField petals={PETALS_FRONT} className="petalsFront" />
        <img className="heroPine pineLeft" src="/pine-left.png" alt="" aria-hidden="true" />
        <img className="heroPine pineRight" src="/pine-right.png" alt="" aria-hidden="true" />

        <div className="heroContent">
          <span className="heroKicker">{brand.kicker}</span>
          <h1 id="home-hero-title" className="heroLogoTitle">
            <img src={brand.wordmark} alt={brand.name} />
          </h1>
          <p className="heroTagline">{brand.tagline}</p>
          <p className="heroSummary">{brand.summary}</p>
          <div className="heroActions">
            <Link className="primaryAction" href="/leaderboard">View Leaderboard</Link>
            <a className="secondaryAction" href={WATCH_URL} target="_blank" rel="noreferrer">
              Watch Live
            </a>
          </div>
        </div>

        <a className="heroScroll" href="#rewards" aria-label="Scroll to rewards">
          <span aria-hidden="true" />
          Explore rewards
        </a>
      </section>

      {/* The anchor sits on the inner section, not the band: the band's box
          now extends 88px upward for the ridge, which would park the heading
          that far below the viewport top on a jump link. */}
      <div className="band bandDawn">
        <section className="homeSection" id="rewards" aria-label={`${brand.name} exclusive rewards`}>
          <div className="centerHeading" data-reveal="heading">
            <h2>REWARDS</h2>
            <p className="underCode">Exclusive perks under code {board.code}</p>
          </div>

          <div className="bonusGrid">
            <article className="bonusCard" data-reveal="card">
              <span className="bonusBadge">New players</span>
              <div className="bonusLogoWrap">
                <img className="bonusLogo" src={board.logo} alt={board.logoAlt} />
              </div>
              <p className="bonusDesc">{welcomeOffer.blurb}</p>
              <div className="bonusBox">
                <span className="bonusBoxLabel">{welcomeOffer.headline}</span>
                <div className="bonusAmountRow">
                  <span className="bonusAmount">{welcomeOffer.amount}</span>
                  <span className="bonusAmountSuffix">Match</span>
                </div>
                <ul className="bonusFeatures">
                  {welcomeOffer.terms.map((term) => <li key={term}>{term}</li>)}
                </ul>
              </div>
              <a className="perkAction bonusCta" href={board.url} target="_blank" rel="noreferrer">
                Claim on {board.name} ↗
              </a>
              <p className="bonusNote">First deposit only. 20x rollover applies.</p>
            </article>

            <article className="bonusCard" data-reveal="card">
              <span className="bonusBadge">All code users</span>
              <div className="bonusLogoWrap">
                <img className="bonusLogo" src={board.logo} alt={board.logoAlt} />
              </div>
              <p className="bonusDesc">{lossback.blurb}</p>
              <div className="bonusBox">
                <span className="bonusBoxLabel">{lossback.headline}</span>
                <div className="bonusAmountRow">
                  <span className="bonusAmount">{lossback.amount}</span>
                  <span className="bonusAmountSuffix">Back</span>
                </div>
                <ul className="bonusFeatures">
                  {lossback.terms.map((term) => <li key={term}>{term}</li>)}
                </ul>
              </div>
              <a className="perkAction bonusCta" href={DISCORD_URL} target="_blank" rel="noreferrer">
                Claim Lossback ↗
              </a>
              <p className="bonusNote">
                Sign up under code {board.code} to qualify automatically.
              </p>
            </article>
          </div>

          <div className="wagerTiers" data-reveal="section">
            <div className="wagerTiersHead">
              <h3>Wager Prizes</h3>
              <span>Resets every month</span>
            </div>
            <ol className="wagerTierList">
              {wagerPrizes.map(({ wagered, prize }) => (
                <li className="wagerTier" key={wagered}>
                  <span className="wagerTierAmount">{wagered}</span>
                  <span className="wagerTierArrow" aria-hidden="true">→</span>
                  <strong className="wagerTierPrize">{prize}</strong>
                </li>
              ))}
            </ol>
            <p className="wagerTierNote">
              Paid on total wagered on {board.name} under code {board.code}. Separate from the{" "}
              {board.pool} bi-weekly leaderboard.
            </p>
          </div>
        </section>
      </div>

      <div className="band bandDusk">
        <StreamSection />
      </div>

      <div className="band bandNight bandPromo">
        <section className="promoBanner" aria-label="Current leaderboard preview" data-reveal="section">
          <div className="promoCopy">
            <h2><span>{board.pool}</span> Leaderboard</h2>
            <p>Bi-weekly race on {board.name}. Top {board.paidPlaces} paid, every two weeks.</p>
            <Link className="primaryAction" href="/leaderboard">View Leaderboard</Link>
          </div>
          {ribbonOrder.length === 3 ? (
            <div className="promoPodium">
              {ribbonOrder.map((player, index) => {
                const place = ribbonPlaces[index];
                return (
                  <div className={`podiumSlot place${place}`} key={place}>
                    <div className="podiumCard">
                      <img
                        className="frameArt"
                        src={place === 1 ? "/lb-frame-crown.png" : "/lb-frame-plain.png"}
                        alt=""
                        aria-hidden="true"
                      />
                      <div className="podiumInner">
                        <div className="podiumAvatar">
                          <span className="avatarRing">
                            <img src="/koi-face.png" alt="" />
                          </span>
                          <img className="rankBadge" src={`/medal-${place}.png`} alt={`Rank ${place}`} />
                        </div>
                        <h2>{maskedName(player.name)}</h2>
                        <span className="podiumLabel">Points</span>
                        <span className="wagerPill">{points(player.points)}</span>
                      </div>
                      <div className="podiumPrize">{money(player.prize)}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="promoEmpty">
              Standings for this race will appear here shortly.
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
