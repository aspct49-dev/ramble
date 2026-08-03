"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { MotionObserver } from "../components/motion-observer";
import { PETALS_SIDES, PetalField } from "../components/petal-field";
import { boards, brand, wheelPrizes } from "../data";

const SEGMENTS = wheelPrizes.length;
const SEG_DEG = 360 / SEGMENTS;
const MIN_TURNS = 5;
const SPIN_MS = 4200;

const SIZE = 400;
const C = SIZE / 2;
const R = SIZE / 2 - 10;

/** Point on the wheel edge, measured clockwise from twelve o'clock. */
function edge(deg: number) {
  const rad = ((deg - 90) * Math.PI) / 180;
  return [C + R * Math.cos(rad), C + R * Math.sin(rad)] as const;
}

function wedge(index: number) {
  const a0 = index * SEG_DEG;
  const a1 = a0 + SEG_DEG;
  const [x0, y0] = edge(a0);
  const [x1, y1] = edge(a1);
  const large = SEG_DEG > 180 ? 1 : 0;
  return `M ${C} ${C} L ${x0} ${y0} A ${R} ${R} 0 ${large} 1 ${x1} ${y1} Z`;
}

export function WheelClient() {
  // Start with segment 0 centred under the pointer rather than a seam.
  const [rotation, setRotation] = useState((360 - SEG_DEG / 2) % 360);
  const [spinning, setSpinning] = useState(false);
  const [won, setWon] = useState<number | null>(null);
  const landedOn = useRef<number | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const spinRef = useRef<HTMLButtonElement>(null);

  const spin = useCallback(() => {
    if (spinning || won !== null) return;

    const index = Math.floor(Math.random() * SEGMENTS);
    landedOn.current = index;

    // Rotation that brings this segment's centre under the pointer at top.
    const target = (360 - (index * SEG_DEG + SEG_DEG / 2)) % 360;
    // Always land forward of where we are, after at least MIN_TURNS turns, so
    // repeat spins keep travelling in the same direction.
    const base = Math.ceil((rotation + 360 * MIN_TURNS) / 360) * 360;

    setSpinning(true);
    setRotation(base + target);
  }, [rotation, spinning, won]);

  const settle = useCallback(() => {
    if (!spinning) return;
    setSpinning(false);
    setWon(landedOn.current);
  }, [spinning]);

  // Motion-averse visitors get the result without the four-second spin.
  const reduced =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  useEffect(() => {
    if (!spinning || !reduced) return;
    const t = window.setTimeout(settle, 20);
    return () => window.clearTimeout(t);
  }, [spinning, reduced, settle]);

  // Move focus into the dialog, and back to the spin button when it closes.
  useEffect(() => {
    if (won !== null) closeRef.current?.focus();
    else spinRef.current?.focus();
  }, [won]);

  useEffect(() => {
    if (won === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setWon(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [won]);

  const prize = won === null ? null : wheelPrizes[won];

  return (
    <main className="lbPage">
      <MotionObserver />
      <section className="wheelHero">
        <PetalField petals={PETALS_SIDES} className="lbPetals" />
        <h1 className="lbTitle">Spin the <span>Wheel</span></h1>
        <p className="lbSub">
          Every spin wins. Tips and bonus buys for players under code{" "}
          <strong>{boards.main.code}</strong>.
        </p>

        <div className="wheelStage">
          <span className="wheelPointer" aria-hidden="true" />
          <svg
            className="wheelFace"
            viewBox={`0 0 ${SIZE} ${SIZE}`}
            role="img"
            aria-label={`Prize wheel with ${SEGMENTS} segments`}
            style={{
              transform: `rotate(${rotation}deg)`,
              transition: spinning && !reduced
                ? `transform ${SPIN_MS}ms cubic-bezier(0.12, 0.7, 0.1, 1)`
                : "none",
            }}
            onTransitionEnd={settle}
          >
            <circle cx={C} cy={C} r={R + 8} className="wheelRim" />
            {wheelPrizes.map((p, i) => (
              <path
                key={i}
                d={wedge(i)}
                className={i % 2 === 0 ? "wheelWedgeA" : "wheelWedgeB"}
              />
            ))}
            {wheelPrizes.map((p, i) => {
              const mid = i * SEG_DEG + SEG_DEG / 2;
              const ly = C - R * 0.6;
              return (
                <g key={i} transform={`rotate(${mid} ${C} ${C})`}>
                  {/* Counter-rotated about its own anchor: without this the
                      labels past 180deg render upside down. Two lines, because
                      "$40 BONUS BUY" on one line does not fit a 45deg wedge. */}
                  <g transform={`rotate(${-mid} ${C} ${ly})`}>
                    <text x={C} y={ly} className="wheelAmount">{p.amount}</text>
                    {/* One word per line: "BONUS BUY" on a single line is
                        wider than a 45deg wedge and spills into its
                        neighbours. */}
                    {p.kind.split(" ").map((word, w) => (
                      <text key={word} x={C} y={ly + 18 + w * 13} className="wheelKind">
                        {word}
                      </text>
                    ))}
                  </g>
                </g>
              );
            })}
            <circle cx={C} cy={C} r={26} className="wheelHubOuter" />
            <circle cx={C} cy={C} r={18} className="wheelHub" />
          </svg>
        </div>

        <button
          className="primaryAction wheelSpin"
          type="button"
          ref={spinRef}
          onClick={spin}
          disabled={spinning || won !== null}
        >
          {spinning ? "Spinning…" : "Spin"}
        </button>

        <p className="wheelNote">
          Prizes are paid manually — screenshot your win and open a ticket in the{" "}
          {brand.name} Discord to claim.
        </p>
      </section>

      {/* Announced politely so a screen reader hears the result without the
          dialog stealing the announcement mid-spin. */}
      <p className="visuallyHidden" role="status" aria-live="polite">
        {prize ? `You won ${prize.name}` : ""}
      </p>

      {prize && (
        <div className="wheelDialogWrap" role="presentation">
          <div
            className="wheelDialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="wheel-win-title"
          >
            <span className="bonusBadge">Winner</span>
            <h2 id="wheel-win-title">Congrats!</h2>
            <p className="wheelDialogLead">You won</p>
            <p className="wheelDialogPrize">{prize.name}</p>
            <div className="wheelDialogActions">
              <button
                className="primaryAction"
                type="button"
                ref={closeRef}
                onClick={() => setWon(null)}
              >
                Close &amp; Spin Again
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
