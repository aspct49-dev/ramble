"use client";

import { useEffect, useState } from "react";
import { type BoardPeriod } from "../data";
import { periodWindow } from "../lib/race-period";

const DAY_MS = 86_400_000;
const pad = (value: number) => String(value).padStart(2, "0");

export type RaceClock = {
  label: string;
  periodKey: string;
  countdown: string;
  parts: { days: string; hours: string; minutes: string; seconds: string };
};

/** An exact window from the partner, when we have one. */
export type RaceWindow = { start: string; end: string };

export function useRaceClock(
  period: BoardPeriod,
  window_?: RaceWindow | null,
): RaceClock | null {
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    const update = () => setNow(Date.now());
    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, []);

  if (now === null) return null;

  // Prefer the partner's own start/end — their race is the 1st-15th in US
  // Eastern, which no fixed-length local cycle reproduces across DST.
  const exact =
    window_ && Number.isFinite(Date.parse(window_.end))
      ? { start: Date.parse(window_.start), end: Date.parse(window_.end) }
      : null;
  const { start, end } = exact ?? periodWindow(now, period);
  const remaining = Math.max(0, end - now);
  const days = Math.floor(remaining / DAY_MS);
  const hours = Math.floor((remaining / 3_600_000) % 24);
  const minutes = Math.floor((remaining / 60_000) % 60);
  const seconds = Math.floor((remaining / 1_000) % 60);
  const dateFormat = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
  const label = period === "month"
    ? new Intl.DateTimeFormat("en-US", {
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    }).format(new Date(now))
    : `${dateFormat.format(new Date(start))} - ${dateFormat.format(new Date(end - DAY_MS))}`;

  return {
    label,
    periodKey: new Date(start).toISOString(),
    countdown: `${pad(days)}D : ${pad(hours)}H : ${pad(minutes)}M`,
    parts: {
      days: pad(days),
      hours: pad(hours),
      minutes: pad(minutes),
      seconds: pad(seconds),
    },
  };
}

export function MonthCountdown() {
  const race = useRaceClock("month");
  return <span className="monthCountdown">{race?.countdown ?? "--D : --H : --M"}</span>;
}

export function RaceCountdownBoxes({
  period,
  window: raceWindow,
}: {
  period: BoardPeriod;
  window?: RaceWindow | null;
}) {
  const race = useRaceClock(period, raceWindow);
  const parts = race?.parts ?? { days: "--", hours: "--", minutes: "--", seconds: "--" };

  return (
    <div className="countdownWrap" aria-label={`Time until the ${period === "week" ? "weekly" : period === "biweek" ? "bi-weekly" : "monthly"} leaderboard resets`}>
      <span className="countdownTitle">Leaderboard ends in</span>
      <div className="countdownBoxes">
        <div className="countBox"><strong className="countValue" key={`days-${parts.days}`}>{parts.days}</strong><span>Days</span></div>
        <span className="countSep">:</span>
        <div className="countBox"><strong className="countValue" key={`hours-${parts.hours}`}>{parts.hours}</strong><span>Hours</span></div>
        <span className="countSep">:</span>
        <div className="countBox"><strong className="countValue" key={`minutes-${parts.minutes}`}>{parts.minutes}</strong><span>Minutes</span></div>
        <span className="countSep">:</span>
        <div className="countBox"><strong className="countValue" key={`seconds-${parts.seconds}`}>{parts.seconds}</strong><span>Seconds</span></div>
      </div>
    </div>
  );
}
