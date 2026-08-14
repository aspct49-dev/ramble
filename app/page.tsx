import type { Metadata } from "next";
import Link from "next/link";
import {
  AFFILIATE_CODE,
  boards,
  brand,
  maskedName,
  money,
  vipBonuses,
  wagered,
  WATCH_URL,
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
    `Join ${brand.name}'s $1,000 bi-weekly Gamba leaderboard with code ${AFFILIATE_CODE}, and climb the Gamba VIP ladder for rakeback, daily, weekly and monthly bonuses.`,
  alternates: { canonical: "/" },
  openGraph: {
    title: `${brand.name} | Bi-Weekly Leaderboard and Rewards`,
    description:
      `Compete in ${brand.name}'s $1,000 bi-weekly Gamba leaderboard under code ${AFFILIATE_CODE} and win your share of the prize pool.`,
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
              <span className="bonusBadge">Every player</span>
              <div className="bonusLogoWrap">
                <img className="bonusLogo" src={board.logo} alt={board.logoAlt} />
              </div>
              <p className="bonusDesc">
                Sign up under code {board.code} and every dollar you wager earns XP toward the{" "}
                {board.name} VIP ladder.
              </p>
              <div className="bonusBox">
                <span className="bonusBoxLabel">VIP Programme</span>
                <div className="bonusAmountRow">
                  <span className="bonusAmount">1 XP</span>
                  <span className="bonusAmountSuffix">per $1</span>
                </div>
                <ul className="bonusFeatures">
                  {vipBonuses.slice(0, 4).map((perk) => <li key={perk.name}>{perk.name}</li>)}
                </ul>
              </div>
              <Link className="perkAction bonusCta" href="/bonuses">
                See all bonuses
              </Link>
              <p className="bonusNote">Rewards scale with your rank. Terms on {board.name}.</p>
            </article>

            <article className="bonusCard" data-reveal="card">
              <span className="bonusBadge">Bi-weekly</span>
              <div className="bonusLogoWrap">
                <img className="bonusLogo" src={board.logo} alt={board.logoAlt} />
              </div>
              <p className="bonusDesc">
                Our own prize pool on top of {board.name}&apos;s rewards, paid to the top{" "}
                {board.paidPlaces} by wagered every two weeks.
              </p>
              <div className="bonusBox">
                <span className="bonusBoxLabel">Leaderboard</span>
                <div className="bonusAmountRow">
                  <span className="bonusAmount">{board.pool}</span>
                  <span className="bonusAmountSuffix">Pool</span>
                </div>
                <ul className="bonusFeatures">
                  <li>Top {board.paidPlaces} paid</li>
                  <li>Resets every two weeks</li>
                  <li>Ranked on total wagered</li>
                  <li>Code {board.code} required</li>
                </ul>
              </div>
              <Link className="perkAction bonusCta" href="/leaderboard">
                View standings
              </Link>
              <p className="bonusNote">
                Sign up under code {board.code} to qualify automatically.
              </p>
            </article>
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
                        <span className="wagerPill">{wagered(player.wagered)}</span>
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
