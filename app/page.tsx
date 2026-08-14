import type { Metadata } from "next";
import Link from "next/link";
import {
  AFFILIATE_CODE,
  boards,
  brand,
  maskedName,
  money,
  paidPlaces,
  primaryBoard,
  score,
  scoreLabel,
  WATCH_URL,
} from "./data";
import { StreamSection } from "./components/stream-section";
import { PETALS_BACK, PETALS_FRONT, PetalField } from "./components/petal-field";
import { MotionObserver } from "./components/motion-observer";
import { getBoardsData } from "./lib/leaderboards";

// Revalidate rather than force-dynamic: force-dynamic blocks prefetching and
// makes every click wait on a server round-trip. 60s matches the revalidate on
// the outbound feed fetches, so this costs no extra staleness.
export const revalidate = 60;

// Derived from the configured boards, so adding a partner updates the copy
// instead of leaving it advertising a pool that is no longer the whole story.
const partnerNames = boards.map((board) => board.name).join(" and ");
const totalPool = boards.reduce(
  (sum, board) => sum + board.prizes.reduce((a, b) => a + b, 0),
  0,
);
const poolText = `$${totalPool.toLocaleString("en-US")}`;

export const metadata: Metadata = {
  title: `${brand.name} | Bi-Weekly Leaderboard and Rewards`,
  description:
    `Join ${brand.name}'s ${poolText} bi-weekly ${partnerNames} leaderboards with code ${AFFILIATE_CODE} and climb for your share of the prize pool.`,
  alternates: { canonical: "/" },
  openGraph: {
    title: `${brand.name} | Bi-Weekly Leaderboard and Rewards`,
    description:
      `Compete in ${brand.name}'s ${poolText} bi-weekly ${partnerNames} leaderboards under code ${AFFILIATE_CODE}.`,
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
  const data = await getBoardsData();
  // The home page previews one board; the leaderboard page shows them all.
  const board = primaryBoard;
  const result = data[board.key];
  const status = result?.status ?? "unavailable";
  const topThree = (result?.standings ?? []).slice(0, 3);
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

          {/* Grouped by partner rather than one flat grid: with two casinos
              running different offers, an ungrouped list leaves a visitor
              unable to tell whose bonus is whose. */}
          {/* A partner with nothing confirmed yet gets no section at all: a
              heading over an empty grid reads as a page that failed to load. */}
          {boards
            .filter((entry) => entry.offers.length > 0 || entry.wagerTiers.length > 0)
            .map((entry) => (
            <div className="partnerRewards" key={entry.key}>
              <div className="partnerRewardsHead" data-reveal="heading">
                {entry.logo ? (
                  <img className="partnerRewardsLogo" src={entry.logo} alt={entry.name} />
                ) : (
                  <span className="boardTabName">{entry.name}</span>
                )}
                <span className="partnerRewardsCode">Code {entry.code}</span>
              </div>

              <div className="bonusGrid">
                {/* Only what the partner themselves publish. Our own prize
                    pool used to lead this grid, but it already has a page of
                    its own — repeating it here pushed the actual casino
                    bonuses, which is what this section is for, below the fold. */}
                {entry.offers.map((offer) => (
                  <article className="bonusCard" data-reveal="card" key={offer.headline}>
                    <span className="bonusBadge">{offer.badge}</span>
                    <div className="bonusLogoWrap">
                      {entry.logo ? (
                        <img className="bonusLogo" src={entry.logo} alt={entry.name} />
                      ) : (
                        <span className="casinoWordmark">{entry.name}</span>
                      )}
                    </div>
                    <p className="bonusDesc">{offer.blurb}</p>
                    <div className="bonusBox">
                      <span className="bonusBoxLabel">{offer.headline}</span>
                      <div className="bonusAmountRow">
                        <span className="bonusAmount">{offer.amount}</span>
                        <span className="bonusAmountSuffix">{offer.suffix}</span>
                      </div>
                      <ul className="bonusFeatures">
                        {offer.terms.map((term) => (
                          <li key={term}>{term}</li>
                        ))}
                      </ul>
                    </div>
                    <a
                      className="perkAction bonusCta"
                      href={entry.url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Claim on {entry.name} ↗
                    </a>
                    <p className="bonusNote">{offer.note}</p>
                  </article>
                ))}
              </div>

              {entry.wagerTiers.length > 0 && (
                <div className="wagerTiers" data-reveal="section">
                  <div className="wagerTiersHead">
                    <h3>{entry.name} Wager Prizes</h3>
                    <span>Resets every month</span>
                  </div>
                  <ol className="wagerTierList">
                    {entry.wagerTiers.map((tier) => (
                      <li className="wagerTier" key={tier.wagered}>
                        <span className="wagerTierAmount">{tier.wagered}</span>
                        <span className="wagerTierArrow" aria-hidden="true">
                          →
                        </span>
                        <strong className="wagerTierPrize">{tier.prize}</strong>
                      </li>
                    ))}
                  </ol>
                  <p className="wagerTierNote">
                    Paid on total wagered on {entry.name} under code {entry.code}. Separate from
                    the {entry.pool} bi-weekly leaderboard.
                  </p>
                </div>
              )}
            </div>
          ))}
        </section>
      </div>

      <div className="band bandDusk">
        <StreamSection />
      </div>

      <div className="band bandNight bandPromo">
        <section className="promoBanner" aria-label="Current leaderboard preview" data-reveal="section">
          <div className="promoCopy">
            <h2><span>{board.pool}</span> Leaderboard</h2>
            <p>Bi-weekly race on {board.name}. Top {paidPlaces(board)} paid, every two weeks.</p>
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
                        <span className="podiumLabel">{scoreLabel(board)}</span>
                        <span className="wagerPill">{score(board, player.score)}</span>
                      </div>
                      <div className="podiumPrize">{money(player.prize)}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="promoEmpty">
              {status === "unavailable"
                ? "Standings are temporarily unavailable."
                : "Standings for this race will appear here shortly."}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
