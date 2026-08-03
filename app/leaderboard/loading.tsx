import { boards } from "../data";

/**
 * Shown instantly while the leaderboard segment renders.
 *
 * Mirrors the real layout — same frame art, same podium offsets, same table
 * row count — so the swap to real content is a fill, not a jump.
 */
const ROWS = Array.from({ length: 10 }, (_, index) => index);
const PODIUM = [2, 1, 3];

export default function LeaderboardLoading() {
  const board = boards.main;

  return (
    <main className="lbSkeleton lbPage" aria-busy="true" aria-label="Loading leaderboard">
      <section className="lbHero">
        <div className="skel skelLogo" />
        <div className="skel skelTitle" />
        <div className="skel skelSub" />

        <div className="podium">
          {PODIUM.map((place) => (
            <div className={`podiumSlot place${place}`} key={place}>
              <div className="podiumCard">
                <img
                  className="frameArt"
                  src={place === 1 ? "/lb-frame-crown.png" : "/lb-frame-plain.png"}
                  alt=""
                  aria-hidden="true"
                />
                <div className="podiumInner">
                  <div className="skel skelAvatar" />
                  <div className="skel skelName" />
                  <div className="skel skelPill" />
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="countdownWrap">
          <span className="countdownTitle">Leaderboard ends in</span>
          <div className="countdownBoxes">
            {["Days", "Hours", "Minutes", "Seconds"].map((label, index) => (
              <div className="countBox" key={label}>
                <strong className="countValue">--</strong>
                <span>{label}</span>
                {index < 3 && null}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="leaderboardSection">
        <div className="sectionHeading">
          <div>
            <p className="eyebrow">Loading {board.name} standings</p>
            <h2>Wager Leaderboard</h2>
          </div>
        </div>
        <div className="leaderboardTable">
          <div className="tableRow tableHead">
            <span>Rank</span><span>Player</span><span>Points</span><span>Reward</span>
          </div>
          {ROWS.map((index) => (
            <div className="tableRow" key={index}>
              <span className="skel skelRank" />
              <span className="skel skelUser" />
              <span className="skel skelNum" />
              <span className="skel skelNum" />
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
