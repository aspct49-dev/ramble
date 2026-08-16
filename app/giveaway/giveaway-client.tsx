"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { SiKick } from "react-icons/si";
import { MotionObserver } from "../components/motion-observer";
import { KICK_CHATROOM_ID, KICK_SLUG, brand } from "../data";

/** Kick's public Pusher app. No credentials, no account, read-only. */
const PUSHER_KEY = "32cbd69e4b950bf97679";
const CHAT_EVENT = "App\\Events\\ChatMessageEvent";

const DEFAULT_KEYWORD = "!enter";
/** Slots in the reel. Odd, so one sits dead centre under the pointers. */
const REEL_SLOTS = 5;
const CENTRE = Math.floor(REEL_SLOTS / 2);

type Entry = { username: string; colour: string; avatar: string | null; at: number };
type ChatLine = { text: string; at: number };
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

/**
 * A reel row: `centre` in the middle, the rest filled with other entrants.
 *
 * Sampled without replacement so a five-slot reel shows five different
 * people whenever there are five to show — independent picks per slot repeat
 * often enough at small entry counts to look broken.
 */
function reelRow(pool: Entry[], centre: Entry, slots: number, centreAt: number): Entry[] {
  const others = pool.filter((entry) => entry.username !== centre.username);
  // Fisher-Yates over a copy, so the source order is untouched.
  for (let i = others.length - 1; i > 0; i -= 1) {
    const j = fairIndex(i + 1);
    [others[i], others[j]] = [others[j], others[i]];
  }
  return Array.from({ length: slots }, (_, slot) => {
    if (slot === centreAt) return centre;
    const offset = slot < centreAt ? slot : slot - 1;
    // Cycles when there are fewer entrants than slots — unavoidable, and
    // reads as a short reel rather than a bug.
    return others.length ? others[offset % others.length] : centre;
  });
}

/**
 * Stable colour for a viewer with no Kick chat colour of their own.
 * Hashed from the name so the same person is the same colour every draw.
 */
function colourFor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) hash = (hash * 31 + name.charCodeAt(i)) | 0;
  return `hsl(${Math.abs(hash) % 360} 62% 58%)`;
}

/**
 * Kick avatar, falling back to a colour-initial tile.
 *
 * The fallback is the normal case, not an error path: profile pictures live
 * behind kick.com/api/v2/channels, which sends no CORS headers, so a browser
 * cannot read them and neither can our server (Cloudflare rejects its TLS
 * fingerprint). Kick's CDN does serve images cross-origin, so a URL is used
 * whenever chat happens to carry one. The tile uses each viewer's own Kick
 * chat colour, so they look the way they do in chat.
 */
function Avatar({ entry, size }: { entry: Entry; size: number }) {
  const [broken, setBroken] = useState(false);
  const initial = (entry.username || "?").charAt(0).toUpperCase();

  if (entry.avatar && !broken) {
    return (
      <img
        className="gwAvatar"
        src={entry.avatar}
        alt=""
        width={size}
        height={size}
        style={{ width: size, height: size }}
        onError={() => setBroken(true)}
      />
    );
  }
  return (
    <span
      className="gwAvatar gwAvatarInitial"
      aria-hidden="true"
      style={{ width: size, height: size, background: entry.colour, fontSize: size * 0.44 }}
    >
      {initial}
    </span>
  );
}

export function GiveawayClient() {
  const channel = KICK_SLUG;
  const [keyword, setKeyword] = useState(DEFAULT_KEYWORD);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [winner, setWinner] = useState<Entry | null>(null);
  const [winnerLines, setWinnerLines] = useState<ChatLine[]>([]);
  const [rolling, setRolling] = useState(false);
  const [reel, setReel] = useState<Entry[]>([]);

  const socket = useRef<WebSocket | null>(null);
  // The socket handler is created once but reads these on every message, so
  // they are refs — state captured in the closure would freeze at connect.
  const openRef = useRef(false);
  const keywordRef = useRef(DEFAULT_KEYWORD);
  const winnerRef = useRef<string | null>(null);
  useEffect(() => { openRef.current = open; }, [open]);
  useEffect(() => { keywordRef.current = keyword; }, [keyword]);
  useEffect(() => { winnerRef.current = winner?.username.toLowerCase() ?? null; }, [winner]);

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
          sender?: {
            username?: string;
            slug?: string;
            identity?: { color?: string };
            profile_pic?: string;
          };
          content?: string;
        };
        const username = (payload.sender?.username ?? payload.sender?.slug ?? "").trim();
        const text = (payload.content ?? "").trim();
        if (!username || !text) return;

        // Everything the winner says after being drawn, so the host can see
        // them react without leaving the page.
        if (winnerRef.current && username.toLowerCase() === winnerRef.current) {
          setWinnerLines((prev) => [{ text, at: Date.now() }, ...prev].slice(0, 12));
        }

        if (!openRef.current) return;
        if (text.toLowerCase() !== keywordRef.current.trim().toLowerCase()) return;

        setEntries((prev) =>
          // One entry per viewer, however many times they type it.
          prev.some((entry) => entry.username.toLowerCase() === username.toLowerCase())
            ? prev
            : [
                ...prev,
                {
                  username,
                  colour: payload.sender?.identity?.color || colourFor(username),
                  avatar: payload.sender?.profile_pic ?? null,
                  at: Date.now(),
                },
              ],
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
    // KICK_CHATROOM_ID in data.ts — so there is no server hop here at all.
    setError("");
    setStatus("connecting");
    connectChat(KICK_CHATROOM_ID);
  }

  function spin() {
    if (entries.length === 0 || rolling) return;
    setRolling(true);
    setWinner(null);
    setWinnerLines([]);
    // Entries stop counting the moment a draw starts, so nobody can join a
    // draw that is already running.
    setOpen(false);

    const pool = entries;
    const picked = pool[fairIndex(pool.length)];

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const land = () => {
      // The centre slot always shows the winner chosen above; the reel is
      // decoration and cannot change the result.
      setReel(reelRow(pool, picked, REEL_SLOTS, CENTRE));
      setWinner(picked);
      setRolling(false);
    };

    if (reduced || pool.length === 1) {
      land();
      return;
    }

    // Decelerating shuffle rather than a CSS translate: the winner is placed
    // in the centre slot on the final frame, so where it stops can never
    // disagree with who was drawn.
    let tick = 0;
    const total = 22;
    const step = () => {
      tick += 1;
      // Each frame is a distinct row too, so the spin reads as names flying
      // past rather than the same few flickering.
      setReel(reelRow(pool, pool[fairIndex(pool.length)], REEL_SLOTS, CENTRE));
      if (tick >= total) {
        land();
        return;
      }
      window.setTimeout(step, 45 + tick * 9);
    };
    step();
  }

  function clearAll() {
    setEntries([]);
    setWinner(null);
    setWinnerLines([]);
    setReel([]);
  }

  const connected = status === "connected";
  const statusLabel = {
    idle: "Not connected",
    connecting: "Connecting…",
    // Deliberately not "live": we read the chat socket, which says nothing
    // about whether the stream itself is broadcasting.
    connected: "Connected",
    error: "Connection error",
  }[status];

  return (
    <main className="lbPage gwPage">
      <MotionObserver />

      <header className="gwBar">
        <span className="gwBarChannel">
          <SiKick aria-hidden="true" />
          kick.com/<strong>{channel}</strong>
        </span>
        <span className="gwBarRight">
          <span className={`gwPill gwPill-${status}`}>
            <span className="gwDot" aria-hidden="true" />
            <span role="status">{statusLabel}</span>
          </span>
          {connected ? (
            <button type="button" className="gwGhost" onClick={disconnect}>
              Disconnect
            </button>
          ) : (
            <button
              type="button"
              className="gwGhost"
              onClick={connect}
              disabled={status === "connecting"}
            >
              {status === "connecting" ? "Connecting…" : "Connect"}
            </button>
          )}
        </span>
      </header>

      <div className="gwGrid">
        <aside className="gwCol">
          <section className="gwCard">
            <h2 className="gwCardTitle">Controls</h2>
            <label className="gwField">
              <span>Entry keyword</span>
              <input
                value={keyword}
                onChange={(event) => setKeyword(event.target.value)}
                spellCheck={false}
                autoComplete="off"
              />
            </label>
            <button
              type="button"
              className={`gwAction${open ? " isStop" : ""}`}
              onClick={() => setOpen((value) => !value)}
              disabled={!connected}
            >
              {open ? "■ Stop collecting" : "● Start collecting"}
            </button>
            <button
              type="button"
              className="gwAction isSpin"
              onClick={spin}
              disabled={entries.length === 0 || rolling}
            >
              {rolling ? "Spinning…" : `Spin (${entries.length} ${entries.length === 1 ? "entry" : "entries"})`}
            </button>
            <button
              type="button"
              className="gwAction isGhost"
              onClick={clearAll}
              disabled={entries.length === 0 && !winner}
            >
              Clear all
            </button>
            {error && (
              <p className="gwError" role="alert">
                {error}
              </p>
            )}
          </section>

          <section className="gwCard">
            <h2 className="gwCardTitle">
              Entries <span className="gwCount">{entries.length}</span>
            </h2>
            {entries.length === 0 ? (
              <p className="gwMuted">
                {connected
                  ? open
                    ? `Waiting for “${keyword}” in chat…`
                    : "Start collecting to gather entries."
                  : "Connect to read chat."}
              </p>
            ) : (
              <ul className="gwEntryList">
                {entries.map((entry) => (
                  <li
                    className={`gwEntry${winner?.username === entry.username ? " isWinner" : ""}`}
                    key={entry.username.toLowerCase()}
                  >
                    <Avatar entry={entry} size={22} />
                    {entry.username}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </aside>

        <div className="gwCol">
          <section className="gwCard gwReelCard" aria-live="polite">
            {reel.length === 0 ? (
              <p className="gwMuted gwReelIdle">
                {entries.length === 0
                  ? "Entries appear here as viewers type the keyword."
                  : `Ready to spin ${entries.length} ${entries.length === 1 ? "entry" : "entries"}.`}
              </p>
            ) : (
              <div className="gwReel">
                <span className="gwPointer gwPointerTop" aria-hidden="true" />
                <span className="gwPointer gwPointerBottom" aria-hidden="true" />
                {reel.map((entry, slot) => (
                  <div
                    className={`gwSlot${slot === CENTRE ? " isCentre" : ""}`}
                    key={`${slot}-${entry.username}`}
                  >
                    <Avatar entry={entry} size={44} />
                    <span className="gwSlotName">{entry.username}</span>
                  </div>
                ))}
              </div>
            )}
          </section>

          {winner && !rolling && (
            <section className="gwCard gwWinnerCard" data-reveal="card">
              <Avatar entry={winner} size={56} />
              <div className="gwWinnerText">
                <span className="gwWinnerLabel">🎉 Winner</span>
                <strong className="gwWinnerName">{winner.username}</strong>
              </div>
              <a
                className="gwGhost"
                href={`https://kick.com/${encodeURIComponent(winner.username.toLowerCase())}`}
                target="_blank"
                rel="noreferrer"
              >
                View profile ↗
              </a>
            </section>
          )}

          {winner && (
            <section className="gwCard">
              <h2 className="gwCardTitle">{winner.username}&apos;s recent messages</h2>
              {winnerLines.length === 0 ? (
                <p className="gwMuted">Waiting for {winner.username} to chat…</p>
              ) : (
                <ul className="gwChatList">
                  {winnerLines.map((line) => (
                    <li key={line.at + line.text}>{line.text}</li>
                  ))}
                </ul>
              )}
            </section>
          )}
        </div>
      </div>

      <p className="maskNote gwNote">
        Reads {brand.name}&apos;s Kick chat over Kick&apos;s public WebSocket. No Kick login is
        used and nothing is stored — entries live in this browser tab only, and reloading clears
        them.
      </p>
    </main>
  );
}
