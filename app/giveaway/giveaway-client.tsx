"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { MotionObserver } from "../components/motion-observer";
import { PETALS_SIDES, PetalField } from "../components/petal-field";
import { KICK_CHATROOM_ID, KICK_SLUG, brand } from "../data";

/** Kick's public Pusher app. No credentials, no account, read-only. */
const PUSHER_KEY = "32cbd69e4b950bf97679";
const CHAT_EVENT = "App\\Events\\ChatMessageEvent";

const DEFAULT_KEYWORD = "!enter";

type Entry = { username: string; at: number };
type Status = "idle" | "connecting" | "connected" | "error";

/**
 * Uniform random index, from the crypto RNG rather than Math.random.
 *
 * This picks who receives real money, so the draw should be defensible:
 * Math.random is not uniform across its range and is trivially predictable
 * from prior outputs. Rejection sampling avoids the modulo bias that would
 * otherwise favour the first few entrants.
 */
function fairIndex(count: number): number {
  if (count <= 1) return 0;
  const limit = Math.floor(0xffffffff / count) * count;
  const buffer = new Uint32Array(1);
  let value = 0;
  do {
    crypto.getRandomValues(buffer);
    value = buffer[0];
  } while (value >= limit);
  return value % count;
}

export function GiveawayClient() {
  const channel = KICK_SLUG;
  const [keyword, setKeyword] = useState(DEFAULT_KEYWORD);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [winner, setWinner] = useState<string | null>(null);
  const [rolling, setRolling] = useState(false);
  const [reel, setReel] = useState<string[]>([]);

  const socket = useRef<WebSocket | null>(null);
  // The socket handler is created once but reads these every message, so they
  // are refs — state captured in the closure would freeze at connect time.
  const openRef = useRef(false);
  const keywordRef = useRef(DEFAULT_KEYWORD);
  useEffect(() => { openRef.current = open; }, [open]);
  useEffect(() => { keywordRef.current = keyword; }, [keyword]);

  const disconnect = useCallback(() => {
    socket.current?.close();
    socket.current = null;
    setStatus("idle");
    setOpen(false);
  }, []);

  // Close the socket if the tab goes away mid-draw.
  useEffect(() => () => socket.current?.close(), []);

  function connectChat(chatroomId: number) {
    const ws = new WebSocket(
      `wss://ws-us2.pusher.com/app/${PUSHER_KEY}?protocol=7&client=js&version=7.4.0&flash=false`,
    );
    socket.current = ws;

    ws.onopen = () => {
      setStatus("connected");
      ws.send(
        JSON.stringify({
          event: "pusher:subscribe",
          data: { channel: `chatrooms.${chatroomId}.v2` },
        }),
      );
    };

    ws.onmessage = (event) => {
      let frame: { event?: string; data?: string };
      try {
        frame = JSON.parse(event.data as string);
      } catch {
        return;
      }
      if (frame.event !== CHAT_EVENT || !frame.data) return;

      try {
        const payload = JSON.parse(frame.data) as {
          sender?: { username?: string; slug?: string };
          content?: string;
        };
        const username = (payload.sender?.username ?? payload.sender?.slug ?? "").trim();
        const text = (payload.content ?? "").trim();
        if (!username || !text) return;
        if (!openRef.current) return;
        if (text.toLowerCase() !== keywordRef.current.trim().toLowerCase()) return;

        setEntries((prev) =>
          // One entry per viewer, however many times they type it.
          prev.some((entry) => entry.username.toLowerCase() === username.toLowerCase())
            ? prev
            : [...prev, { username, at: Date.now() }],
        );
      } catch {
        // A malformed frame must not take the socket down.
      }
    };

    ws.onerror = () => setStatus("error");
    ws.onclose = () => {
      socket.current = null;
      setStatus((s) => (s === "error" ? s : "idle"));
      setOpen(false);
    };
  }

  function connect() {
    // Straight to Kick's socket. The chatroom id is configured rather than
    // looked up because that endpoint is unreachable from both sides — see
    // KICK_CHATROOM_ID in data.ts — which also means there is no server hop
    // here and nothing to go wrong in between.
    setError("");
    setStatus("connecting");
    connectChat(KICK_CHATROOM_ID);
  }

  function draw() {
    if (entries.length === 0 || rolling) return;
    setRolling(true);
    setWinner(null);
    // Entries stop counting the moment a draw starts, so nobody can join a
    // draw that is already running.
    setOpen(false);

    const names = entries.map((entry) => entry.username);
    const picked = names[fairIndex(names.length)];

    // The reel is decoration; the winner above is already decided, so the
    // animation can never change the outcome.
    const strip: string[] = [];
    for (let i = 0; i < 28; i += 1) strip.push(names[fairIndex(names.length)]);
    strip.push(picked);
    setReel(strip);

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.setTimeout(() => {
      setWinner(picked);
      setRolling(false);
    }, reduced ? 0 : 2600);
  }

  function reset() {
    setEntries([]);
    setWinner(null);
    setReel([]);
  }

  const connected = status === "connected";
  const statusLabel = {
    idle: "Not connected",
    connecting: "Connecting…",
    // Deliberately not "live": we read the chat socket, which says nothing
    // about whether the stream itself is broadcasting.
    connected: "Connected to chat",
    error: "Connection error",
  }[status];

  return (
    <main className="lbPage gwPage">
      <MotionObserver />
      <PetalField petals={PETALS_SIDES} className="lbPetals" />

      <section className="lbHero">
        <h1 className="lbTitle">
          <span>Kick</span> Giveaway Picker
        </h1>
        <p className="lbSub">
          Reads {brand.name}&apos;s Kick chat live, collects everyone who types the keyword, and
          draws a winner at random.
        </p>

        <div className="gwPanel" data-reveal="section">
          <div className="gwSetup">
            <div className="gwField">
              <span>Kick channel</span>
              {/* Fixed, not editable: the chatroom id is configured for this
                  one channel, so an input would imply a choice that does not
                  exist and silently connect to a chat with no messages. */}
              <p className="gwChannel">
                kick.com/<strong>{channel}</strong>
              </p>
            </div>
            <label className="gwField">
              <span>Entry keyword</span>
              <input
                value={keyword}
                onChange={(event) => setKeyword(event.target.value)}
                spellCheck={false}
                autoComplete="off"
              />
            </label>
            {connected ? (
              <button type="button" className="secondaryAction" onClick={disconnect}>
                Disconnect
              </button>
            ) : (
              <button
                type="button"
                className="primaryAction"
                onClick={connect}
                disabled={status === "connecting"}
              >
                {status === "connecting" ? "Connecting…" : "Connect"}
              </button>
            )}
          </div>

          <div className="gwStatusRow">
            <span className={`gwDot gwDot-${status}`} aria-hidden="true" />
            <span className="gwStatus" role="status">
              {statusLabel}
            </span>
            {error && (
              <span className="gwError" role="alert">
                {error}
              </span>
            )}
          </div>

          {connected && (
            <div className="gwControls">
              <button
                type="button"
                className={open ? "secondaryAction" : "primaryAction"}
                onClick={() => setOpen((value) => !value)}
              >
                {open ? "Stop entries" : "Open entries"}
              </button>
              <button
                type="button"
                className="primaryAction"
                onClick={draw}
                disabled={entries.length === 0 || rolling}
              >
                {rolling ? "Drawing…" : "Draw winner"}
              </button>
              <button
                type="button"
                className="perkAction"
                onClick={reset}
                disabled={entries.length === 0 && !winner}
              >
                Clear
              </button>
            </div>
          )}

          <p className="gwCount">
            <strong>{entries.length}</strong> {entries.length === 1 ? "entry" : "entries"}
            {open && " · listening for "}
            {open && <code>{keyword}</code>}
          </p>
        </div>
      </section>

      {(rolling || winner) && (
        <section className="gwDrawWrap" aria-live="polite">
          {rolling && (
            <div className="gwReel" aria-hidden="true">
              <div className="gwReelTrack">
                {reel.map((name, index) => (
                  <span className="gwReelName" key={index}>
                    {name}
                  </span>
                ))}
              </div>
            </div>
          )}
          {winner && !rolling && (
            <div className="gwWinner" data-reveal="card">
              <span className="gwWinnerLabel">Winner</span>
              <strong className="gwWinnerName">{winner}</strong>
              <p className="gwWinnerNote">
                Drawn at random from {entries.length}{" "}
                {entries.length === 1 ? "entry" : "entries"}.
              </p>
              <button type="button" className="primaryAction" onClick={draw}>
                Draw again
              </button>
            </div>
          )}
        </section>
      )}

      <section className="leaderboardSection">
        <div className="sectionHeading">
          <div>
            <p className="eyebrow">kick.com/{channel}</p>
            <h2>Entries</h2>
          </div>
          <span className="verifiedNote">One entry per viewer</span>
        </div>
        <div className="gwEntries">
          {entries.length === 0 ? (
            <p className="emptyState">
              {connected
                ? open
                  ? `Waiting for viewers to type ${keyword} in chat.`
                  : "Connected. Open entries to start collecting."
                : "Connect to a Kick channel to collect entries."}
            </p>
          ) : (
            <ul className="gwEntryList">
              {entries.map((entry) => (
                <li
                  className={`gwEntry${winner === entry.username ? " isWinner" : ""}`}
                  key={entry.username.toLowerCase()}
                >
                  {entry.username}
                </li>
              ))}
            </ul>
          )}
        </div>
        <p className="maskNote">
          Chat is read from Kick&apos;s public WebSocket. No Kick login is used and nothing is
          stored — entries live in this browser tab only, and reloading clears them.
        </p>
      </section>
    </main>
  );
}
