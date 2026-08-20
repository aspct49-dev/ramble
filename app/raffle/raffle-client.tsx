"use client";

import { RaceCountdownBoxes, useRaceClock } from "../components/month-countdown";
import { MotionObserver } from "../components/motion-observer";
import { PETALS_SIDES, PetalField } from "../components/petal-field";
import { badgeFor, brand, money, primaryBoard, raffle, rafflePool } from "../data";
import type { RaffleResult } from "../lib/raffle";

const placeLabel = ["1st", "2nd", "3rd"];
const suffix = ["st", "nd", "rd"];

const tickets = (n: number) => new Intl.NumberFormat("en-US").format(n);

/** An entrant's chance at any one drawn position. */
function oddsPercent(entrantTickets: number, totalTickets: number): string {
  if (totalTickets <= 0) return "—";
  const pct = (entrantTickets / totalTickets) * 100;
  if (pct >= 10) return `${pct.toFixed(0)}%`;
  if (pct >= 1) return `${pct.toFixed(1)}%`;
  return "<1%";
}

export function RaffleClient({ result }: { result: RaffleResult | null }) {
  // The raffle runs on its own fixed window, not the partner's race cycle.
  const window = { start: raffle.startsAt, end: raffle.endsAt };
  const clock = useRaceClock("month", window);

  const entrants = result?.entrants ?? [];
  const drawn = result?.draw ?? null;
  const podium = entrants.slice(0, 3);
  const board = primaryBoard;
  const total = result?.totalTickets ?? 0;

  return (
    <main className="lbPage">
      <MotionObserver />
      <PetalField petals={PETALS_SIDES} className="lbPetals" />

      <section className="lbHero">
        {board.logo && <img className="casinoLogo" src={board.logo} alt={board.name} />}
        <h1 className="lbTitle">
          <span>${rafflePool.toLocaleString("en-US")}</span> Monthly Raffle
        </h1>
        <p className="lbSub">
          Every <strong>${raffle.ticketCostUsd}</strong> wagered on {board.name} under code{" "}
          <strong>{board.code}</strong> earns one ticket. Every ticket is a chance at a prize
          position — and the biggest ticket holder takes{" "}
          <strong>{money(raffle.topPrize)}</strong> outright.
        </p>
        <div className="codeRow">
          <span className="codePill">
            Code: <strong>{board.code}</strong>
          </span>
          <a className="primaryAction" href={board.url} target="_blank" rel="noreferrer">
            Play on {board.name} ↗
          </a>
        </div>

        {podium.length === 3 ? (
          <div className="podium" aria-label="Top three ticket holders">
            {[podium[1], podium[0], podium[2]].map((entrant, index) => {
              const place = index === 0 ? 2 : index === 1 ? 1 : 3;
              return (
                <div className={`podiumSlot place${place}`} key={entrant.id}>
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
                      <h2>{entrant.username}</h2>
                      <span className="podiumLabel">Tickets</span>
                      <span className="wagerPill">{tickets(entrant.tickets)}</span>
                    </div>
                    {/* Only the largest holder has a guaranteed prize. The
                        other two show odds, not a payout they have not won. */}
                    <div className="podiumPrize">
                      {place === 1 ? money(raffle.topPrize) : oddsPercent(entrant.tickets, total)}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="monthlyResetState">
            {result === null
              ? "Ticket standings are temporarily unavailable."
              : `Tickets appear here as wagering is recorded on ${board.name}.`}
          </div>
        )}

        <RaceCountdownBoxes period="month" window={window} label="Raffle closes in" />
      </section>

      <section className="leaderboardSection">
        <div className="sectionHeading" data-reveal="heading">
          <div>
            <p className="eyebrow">
              {clock?.label ?? "This raffle"} | {board.name} | Code {board.code}
            </p>
            <h2>{drawn ? "Draw Results" : "Ticket Standings"}</h2>
          </div>
          <span className="verifiedNote">
            {result ? `${tickets(total)} tickets | ${entrants.length} entrants` : "—"}
          </span>
        </div>

        <div
          className="leaderboardTable"
          role="table"
          aria-label={`${brand.name} monthly raffle`}
          tabIndex={0}
        >
          <div className="tableRow tableHead" role="row">
            <span>{drawn ? "Place" : "Rank"}</span>
            <span>Player</span>
            <span>Tickets</span>
            <span>{drawn ? "Prize" : "Odds"}</span>
          </div>

          {drawn
            ? drawn.map((row) => (
                <div className="tableRow" role="row" key={row.entrant.id} data-reveal="row">
                  {row.place <= 3 ? (
                    <img
                      className="rankMedal"
                      src={`/medal-${row.place}.png`}
                      alt={`Place ${row.place}`}
                    />
                  ) : (
                    <span className="rankChip">{row.place}</span>
                  )}
                  <div className="tablePlayer">
                    <span className="miniBadge">{badgeFor(row.entrant.username)}</span>
                    <strong>{row.entrant.username}</strong>
                  </div>
                  <strong className="points">{tickets(row.entrant.tickets)}</strong>
                  <strong className="prize">{money(row.prize)}</strong>
                </div>
              ))
            : entrants.map((entrant, index) => (
                <div
                  className="tableRow"
                  role="row"
                  key={entrant.id}
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
                    <span className="miniBadge">{badgeFor(entrant.username)}</span>
                    <strong>{entrant.username}</strong>
                  </div>
                  <strong className="points">{tickets(entrant.tickets)}</strong>
                  <strong className="prize">{oddsPercent(entrant.tickets, total)}</strong>
                </div>
              ))}

          {entrants.length === 0 && (
            <div className="emptyState">
              {result === null
                ? "Ticket standings are temporarily unavailable. Please check back shortly."
                : `No tickets yet. The first ${money(raffle.ticketCostUsd)} wagered earns one.`}
            </div>
          )}
        </div>

        <div className="raffleLadder" data-reveal="section">
          <div className="wagerTiersHead">
            <h3>Prize Ladder</h3>
            <span>{drawn ? "Drawn" : "Drawn when the raffle closes"}</span>
          </div>
          <ol className="raffleLadderList">
            {raffle.prizes.map((prize, index) => (
              <li className="raffleRung" key={index}>
                <span className="raffleRungPlace">
                  {index + 1}
                  {suffix[index] ?? "th"}
                </span>
                <strong className="raffleRungPrize">{money(prize)}</strong>
              </li>
            ))}
          </ol>
          <p className="wagerTierNote">
            Positions are drawn at random, weighted by tickets — more tickets means better odds,
            not a guaranteed place. Separately, the largest ticket holder is guaranteed{" "}
            {money(raffle.topPrize)}.
            {result?.seed ? (
              <>
                {" "}
                Draw seed <code>{result.seed}</code>, derived from the final ticket counts so the
                result can be checked.
              </>
            ) : null}
          </p>
        </div>

        <p className="maskNote">
          Player names are obfuscated by {board.name}. Tickets update as wagering is processed.
        </p>
      </section>
    </main>
  );
}
