// Sakura drift, shared by the hero, the splash screen and the leaderboard hero.
// Fields are hand-tuned constants rather than random so server and client
// markup always agree.

export type Petal = {
  /** Which petal sprite, 1 or 2. */
  sprite: 1 | 2;
  /** Horizontal position, in % of the container. */
  left: number;
  /** Rendered width in px. */
  size: number;
  /** Seconds for one full fall. */
  fall: number;
  /** Seconds before the first fall starts. */
  delay: number;
  /** Seconds for one sway cycle. */
  sway: number;
};

export function PetalField({
  petals,
  className = "",
}: {
  petals: readonly Petal[];
  className?: string;
}) {
  return (
    <div className={`petalLayer ${className}`} aria-hidden="true">
      {petals.map(({ sprite, left, size, fall, delay, sway }, index) => (
        <span
          className="petal"
          key={index}
          style={{
            left: `${left}%`,
            width: `${size}px`,
            animationDuration: `${fall}s`,
            animationDelay: `${delay}s`,
          }}
        >
          <img
            src={`/petal-${sprite}.png`}
            alt=""
            style={{ animationDuration: `${sway}s` }}
          />
        </span>
      ))}
    </div>
  );
}

// The two planes must not overlap in size or speed, or they read as one
// noisy field instead of two depths. Far tops out at 13px / 22s; near starts
// at 40px / 13s, leaving a clear gap on both axes.

/** Far plane: tiny, slow, drifting almost in place. */
export const PETALS_BACK: readonly Petal[] = [
  { sprite: 1, left: 6, size: 11, fall: 26, delay: 0, sway: 7.5 },
  { sprite: 2, left: 18, size: 8, fall: 23, delay: 4, sway: 6.4 },
  { sprite: 1, left: 31, size: 12, fall: 28, delay: 8, sway: 8.2 },
  { sprite: 2, left: 44, size: 9, fall: 24, delay: 2, sway: 6.9 },
  { sprite: 1, left: 58, size: 7, fall: 22, delay: 6, sway: 6.1 },
  { sprite: 2, left: 71, size: 13, fall: 29, delay: 10, sway: 8.0 },
  { sprite: 1, left: 84, size: 9, fall: 23, delay: 3, sway: 6.6 },
  { sprite: 2, left: 93, size: 10, fall: 27, delay: 12, sway: 7.2 },
];

/** Near plane: large, fast, sharp — falls past the viewer. */
export const PETALS_FRONT: readonly Petal[] = [
  { sprite: 2, left: 10, size: 52, fall: 7.5, delay: 1, sway: 2.8 },
  { sprite: 1, left: 24, size: 66, fall: 9, delay: 5, sway: 3.3 },
  { sprite: 2, left: 38, size: 44, fall: 7, delay: 3, sway: 2.5 },
  { sprite: 1, left: 55, size: 58, fall: 8.5, delay: 7, sway: 3.0 },
  { sprite: 2, left: 68, size: 40, fall: 6.5, delay: 0, sway: 2.3 },
  { sprite: 1, left: 80, size: 62, fall: 9.5, delay: 4, sway: 3.4 },
  { sprite: 2, left: 91, size: 48, fall: 8, delay: 8, sway: 2.6 },
];

/** Splash screen: quick cycle so it reads as motion in ~1.4s. */
export const PETALS_SPLASH: readonly Petal[] = [
  { sprite: 1, left: 12, size: 22, fall: 7, delay: 0, sway: 3.8 },
  { sprite: 2, left: 24, size: 14, fall: 6.2, delay: 1.1, sway: 3.2 },
  { sprite: 1, left: 38, size: 19, fall: 7.6, delay: 0.4, sway: 4.1 },
  { sprite: 2, left: 55, size: 16, fall: 6.8, delay: 1.6, sway: 3.5 },
  { sprite: 1, left: 68, size: 26, fall: 8, delay: 0.2, sway: 4.4 },
  { sprite: 2, left: 80, size: 15, fall: 6.4, delay: 1.3, sway: 3.1 },
  { sprite: 1, left: 90, size: 21, fall: 7.2, delay: 0.7, sway: 3.9 },
];

/** Leaderboard hero: hugs the left and right gutters, clear of the podium. */
export const PETALS_SIDES: readonly Petal[] = [
  { sprite: 1, left: 2, size: 30, fall: 13, delay: 0, sway: 4.2 },
  { sprite: 2, left: 5, size: 16, fall: 11, delay: 4, sway: 3.6 },
  { sprite: 1, left: 8, size: 22, fall: 15, delay: 8, sway: 4.8 },
  { sprite: 2, left: 4, size: 18, fall: 12, delay: 2, sway: 4.0 },
  { sprite: 1, left: 96, size: 14, fall: 12, delay: 5, sway: 3.4 },
  { sprite: 2, left: 93, size: 28, fall: 14, delay: 1, sway: 4.6 },
  { sprite: 1, left: 90, size: 20, fall: 11, delay: 7, sway: 3.8 },
  { sprite: 2, left: 95, size: 24, fall: 15, delay: 10, sway: 4.4 },
];
