"use client";

import { RaceCountdownBoxes, useRaceClock } from "../components/month-countdown";
import { MotionObserver } from "../components/motion-observer";
import { PETALS_SIDES, PetalField } from "../components/petal-field";
import {
  badgeFor,
  boards,
  brand,
  maskedName,
  money,
  paidPlaces,
  score,
  scoreLabel,
  type BoardConfig,
} from "../data";
import type { BoardResult, BoardsData } from "../lib/leaderboards";

const placeLabel = ["1st", "2nd", "3rd"];

/** Partner mark, falling back to a text wordmark when no artwork exists. */
function PartnerLogo({ board }: { board: BoardConfig }) {
  if (!board.logo) {
    return <span className="casinoWordmark">{board.name}</span>;
  }
  return <img className="casinoLogo" src={board.logo} alt={board.name} />;
}

function BoardSection({ board, result }: { board: BoardConfig; result: BoardResult }) {
  // Each board runs its own race on its own partner's clock.
  const race = useRaceClock(board.period, null);
  const players = result.standings;
  // "Nothing yet" and "we couldn't load this" are different promises to a
  // visitor, and only one of them is a fault worth chasing.
  const unavailable = result.status === "unavailable";
  const topThree = players.slice(0, 3);
  const metric = scoreLabel(board);

  return (
    <section className="boardSection" aria-label={`${board.name} leaderboard`}>
      <div className="lbHero">
        <PartnerLogo board={board} />
        <h1 className="lbTitle">
          <span>{board.pool}</span> Bi-Weekly Leaderboard
        </h1>
        <p className="lbSub">
          Compete against other players on {board.name} under code <strong>{board.code}</strong> and
          win big rewards!
        </p>
        <div className="codeRow">
          <span className="codePill">
            Code: <strong>{board.code}</strong>
          </span>
          <a className="primaryAction" href={board.url} target="_blank" rel="noreferrer">
            Visit {board.name} ↗
          </a>
        </div>

        {topThree.length === 3 ? (
          <div className="podium" aria-label={`Top three players on ${board.name}`}>
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
                        <img
                          className="rankBadge"
                          src={`/medal-${place}.png`}
                          alt={placeLabel[place - 1]}
                        />
                      </div>
                      <h2>{maskedName(player.name)}</h2>
                      <span className="podiumLabel">{metric}</span>
                      <span className="wagerPill">{score(board, player.score)}</span>
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
              : `Standings for ${race?.label ?? "this race"} will appear here as play is recorded on ${board.name}.`}
          </div>
        )}

        <RaceCountdownBoxes period={board.period} window={null} />
      </div>

      <div className="leaderboardSection">
        <div className="sectionHeading" data-reveal="heading">
          <div>
            <p className="eyebrow">
              {race?.label ?? "Current race"} | {board.name} | Code {board.code}
            </p>
            <h2>Wager Leaderboard</h2>
          </div>
          <span className="verifiedNote">
            Resets every 2 weeks | Top {paidPlaces(board)} paid
          </span>
        </div>
        <div
          className="leaderboardTable"
          role="table"
          aria-label={`${brand.name} ${board.name} leaderboard`}
          tabIndex={0}
        >
          <div className="tableRow tableHead" role="row">
            <span>Rank</span>
            <span>Player</span>
            <span>{metric}</span>
            <span>Reward</span>
          </div>
          {players.map((player, index) => (
            <div
              className="tableRow"
              role="row"
              key={index}
              data-reveal={index < 8 ? "row" : undefined}
            >
              {index < 3 ? (
                <img
                  className="rankMedal"
                  src={`/medal-${index + 1}.png`}
                  alt={`Rank ${index + 1}`}
                />
              ) : (
                <span className="rankChip">{index + 1}</span>
              )}
              <div className="tablePlayer">
                <span className="miniBadge">{badgeFor(player.name)}</span>
                <strong>{maskedName(player.name)}</strong>
              </div>
              <strong className="points">{score(board, player.score)}</strong>
              <strong className="prize">{player.prize > 0 ? money(player.prize) : "-"}</strong>
            </div>
          ))}
          {players.length === 0 && (
            <div className="emptyState">
              {/* Reached before the first play settles and while a partner
                  recomputes mid-race, so it must not claim nobody has played —
                  and must not pass a failed read off as an empty race. */}
              {unavailable
                ? "Standings are temporarily unavailable. Please check back shortly."
                : `Standings for ${race?.label ?? "this race"} will appear here shortly.`}
            </div>
          )}
        </div>
        <p className="maskNote">
          Player names are masked for privacy. Standings update as play is processed.
        </p>
      </div>
    </section>
  );
}

export function LeaderboardClient({ standings }: { standings: BoardsData }) {
  // One section per configured partner. Reads correctly with a single board
  // today and with several once more partners are added.
  const active = boards
    .map((board) => ({ board, result: standings[board.key] }))
    .filter((entry): entry is { board: BoardConfig; result: BoardResult } => Boolean(entry.result));

  return (
    <main className="lbPage">
      <MotionObserver />
      <PetalField petals={PETALS_SIDES} className="lbPetals" />
      {active.map(({ board, result }) => (
        <BoardSection board={board} result={result} key={board.key} />
      ))}
    </main>
  );
}
