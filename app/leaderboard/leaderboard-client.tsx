"use client";

import {
  RaceCountdownBoxes,
  useRaceClock,
  type RaceWindow,
} from "../components/month-countdown";
import { MotionObserver } from "../components/motion-observer";
import { PETALS_SIDES, PetalField } from "../components/petal-field";
import { badgeFor, boards, brand, maskedName, money, points } from "../data";
import type { BoardsData } from "../lib/leaderboards";

const placeLabel = ["1st", "2nd", "3rd"];

export function LeaderboardClient({
  standings,
  raceWindow = null,
}: {
  standings: BoardsData;
  raceWindow?: RaceWindow | null;
}) {
  const board = boards.main;
  const race = useRaceClock(board.period, raceWindow);
  const rankedPlayers = standings.main ?? [];
  // "Nothing yet" and "we couldn't load this" are different promises to a
  // visitor, and only one of them is a fault worth chasing.
  const unavailable = standings.status === "unavailable";
  const topThree = rankedPlayers.slice(0, 3);

  return (
    <main className="lbPage">
      <MotionObserver />
      <section className="lbHero">
        <PetalField petals={PETALS_SIDES} className="lbPetals" />
        <img className="casinoLogo" src={board.logo} alt={board.logoAlt} />
        <h1 className="lbTitle"><span>{board.pool}</span> Bi-Weekly Leaderboard</h1>
        <p className="lbSub">
          Compete against other players on {board.name} under code <strong>{board.code}</strong>{" "}
          and win big rewards!
        </p>
        <div className="codeRow">
          <span className="codePill">Code: <strong>{board.code}</strong></span>
          <a className="primaryAction" href={board.url} target="_blank" rel="noreferrer">
            Visit {board.name} ↗
          </a>
        </div>

        {topThree.length === 3 ? (
          <div className="podium" aria-label="Top three players this race">
            {[topThree[1], topThree[0], topThree[2]].map((player, index) => {
              const place = index === 0 ? 2 : index === 1 ? 1 : 3;
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
                        <img className="rankBadge" src={`/medal-${place}.png`} alt={placeLabel[place - 1]} />
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
          <div className="monthlyResetState">
            {unavailable
              ? `Standings are temporarily unavailable. They will return as soon as ${board.name} publishes them.`
              : `Standings for ${race?.label ?? "this race"} will appear here as points are recorded on ${board.name}.`}
          </div>
        )}

        <RaceCountdownBoxes period={board.period} window={raceWindow} />
      </section>

      <section className="leaderboardSection">
        <div className="sectionHeading" data-reveal="heading">
          <div>
            <p className="eyebrow">
              {race?.label ?? "Current race"} | {board.name} | Code {board.code}
            </p>
            <h2>Wager Leaderboard</h2>
          </div>
          <span className="verifiedNote">Resets every 2 weeks | Top {board.paidPlaces} paid</span>
        </div>
        <div
          className="leaderboardTable"
          role="table"
          aria-label={`${brand.name} ${board.name} leaderboard`}
          tabIndex={0}
        >
          <div className="tableRow tableHead" role="row">
            <span>Rank</span><span>Player</span><span>Points</span><span>Reward</span>
          </div>
          {rankedPlayers.map((player, index) => (
            <div className="tableRow" role="row" key={index} data-reveal={index < 8 ? "row" : undefined}>
              {index < 3 ? (
                <img className="rankMedal" src={`/medal-${index + 1}.png`} alt={`Rank ${index + 1}`} />
              ) : (
                <span className="rankChip">{index + 1}</span>
              )}
              <div className="tablePlayer">
                <span className="miniBadge">{badgeFor(player.name)}</span>
                <strong>{maskedName(player.name)}</strong>
              </div>
              <strong className="points">{points(player.points)}</strong>
              <strong className="prize">{player.prize > 0 ? money(player.prize) : "-"}</strong>
            </div>
          ))}
          {rankedPlayers.length === 0 && (
            <div className="emptyState">
              {/* Reached before the first wagers settle and while Dicey
                  recomputes mid-race, so it must not claim nobody has played —
                  and must not pass a failed read off as an empty race. */}
              {unavailable
                ? "Standings are temporarily unavailable. Please check back shortly."
                : `Standings for ${race?.label ?? "this race"} will appear here shortly.`}
            </div>
          )}
        </div>
        <p className="maskNote">
          Player names are masked for privacy. Standings update as points are processed.
        </p>
      </section>
    </main>
  );
}
