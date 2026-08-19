"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { SiKick } from "react-icons/si";
import { MotionObserver } from "../components/motion-observer";
import { KICK_CHATROOM_ID, KICK_SLUG, brand } from "../data";

/** Kick's public Pusher app. No credentials, no account, read-only. */
const PUSHER_KEY = "32cbd69e4b950bf97679";
const CHAT_EVENT = "App\\Events\\ChatMessageEvent";

const DEFAULT_KEYWORD = "!enter";

/**
 * Reel geometry. Card and gap are fixed here and in the CSS together, so the
 * landing offset can be computed exactly rather than measured mid-animation.
 */
const CARD_W = 132;
const CARD_GAP = 8;
const PITCH = CARD_W + CARD_GAP;
/** Cards in the strip, and where the winner sits in it. */
const STRIP_LEN = 44;
const WINNER_AT = 38;
const SPIN_MS = 3400;

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
 * The strip the reel scrolls through, with `winner` at WINNER_AT.
 *
 * Neighbours are drawn without repeating back-to-back: independent picks
 * put the same face beside itself often enough at small entry counts that
 * the reel stops looking like it is moving.
 */
function buildStrip(pool: Entry[], winner: Entry): Entry[] {
  const strip: Entry[] = [];
  for (let i = 0; i < STRIP_LEN; i += 1) {
    if (i === WINNER_AT) {
      strip.push(winner);
      continue;
    }
    let pick = pool[fairIndex(pool.length)];
    if (pool.length > 1) {
      let guard = 0;
      while (strip.length && pick.username === strip[strip.length - 1].username && guard < 8) {
        pick = pool[fairIndex(pool.length)];
        guard += 1;
      }
    }
    strip.push(pick);
  }
  return strip;
}

const CHANNEL_API = "https://kick.com/api/v2/channels";

type KickChannel = { chatroomId: number | null; avatar: string | null; live: boolean };

/**
 * Reads a Kick channel straight from the browser.
 *
 * kick.com answers a real browser cross-origin, with CORS headers. It refuses
 * automated clients — a server fetch or a headless browser gets a Cloudflare
 * block page, and that 403 has no CORS headers, which is easily mistaken for
 * the endpoint having no CORS at all. Real visitors are fine.
 */
async function fetchChannel(slug: string): Promise<KickChannel | null> {
  try {
    const response = await fetch(`${CHANNEL_API}/${encodeURIComponent(slug)}`, {
      headers: { accept: "application/json" },
    });
    if (!response.ok) return null;
    const data = (await response.json()) as {
      chatroom?: { id?: number };
      livestream?: unknown;
      user?: { profile_pic?: string };
    };
    return {
      chatroomId: data.chatroom?.id ?? null,
      avatar: data.user?.profile_pic ?? null,
      live: Boolean(data.livestream),
    };
  } catch {
    return null;
  }
}

async function fetchAvatar(username: string): Promise<string | null> {
  const channel = await fetchChannel(username.toLowerCase());
  return channel?.avatar ?? null;
}

/** Splits work into small batches so lookups do not all fire at once. */
function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

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
  // Editable again: the chatroom is resolved live, so any channel works.
  const [slug, setSlug] = useState(KICK_SLUG);
  const [live, setLive] = useState(false);
  const [keyword, setKeyword] = useState(DEFAULT_KEYWORD);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [winner, setWinner] = useState<Entry | null>(null);
  const [winnerLines, setWinnerLines] = useState<ChatLine[]>([]);
  const [rolling, setRolling] = useState(false);
  const [strip, setStrip] = useState<Entry[]>([]);
  const [offset, setOffset] = useState(0);
  const [gliding, setGliding] = useState(false);
  const viewport = useRef<HTMLDivElement>(null);

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

  /**
   * Fill in each entrant's real Kick profile picture.
   *
   * Straight from the browser to kick.com, with no server and no credentials:
   * that endpoint does send CORS headers to a real browser. (It refuses
   * automated clients — a headless browser or a server fetch gets a
   * Cloudflare block page, whose 403 carries no CORS headers and so looks
   * like a CORS policy. It isn't.)
   *
   * Asked once per name, a few at a time, so a busy giveaway does not open
   * a hundred parallel requests the moment entries land.
   */
  const asked = useRef(new Set<string>());
  useEffect(() => {
    const missing = entries
      .filter((entry) => !entry.avatar && !asked.current.has(entry.username.toLowerCase()))
      .map((entry) => entry.username);
    if (missing.length === 0) return;
    for (const name of missing) asked.current.add(name.toLowerCase());

    let cancelled = false;

    const apply = (found: Array<readonly [string, string | null]>) => {
      const map = new Map(found.filter(([, url]) => url) as Array<[string, string]>);
      if (map.size === 0) return;
      setEntries((prev) =>
        prev.map((entry) => {
          const url = map.get(entry.username.toLowerCase());
          return url && !entry.avatar ? { ...entry, avatar: url } : entry;
        }),
      );
    };

    (async () => {
      const failed: string[] = [];
      // Two at a time with a breath between: Kick throttles bursts, and a
      // whole giveaway's worth of entrants asked at once comes back empty.
      for (const batch of chunk(missing, 2)) {
        if (cancelled) return;
        const found = await Promise.all(
          batch.map(async (name) => [name.toLowerCase(), await fetchAvatar(name)] as const),
        );
        if (cancelled) return;
        apply(found);
        for (const [name, url] of found) if (!url) failed.push(name);
        await wait(280);
      }

      // One slower retry. Entries usually trickle in, so this only matters
      // when a batch of viewers enters at once — exactly when throttling hits.
      if (cancelled || failed.length === 0) return;
      await wait(1500);
      for (const name of failed) {
        if (cancelled) return;
        apply([[name, await fetchAvatar(name)] as const]);
        await wait(320);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [entries]);

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

  async function connect() {
    setError("");
    setStatus("connecting");

    // Resolved live, so the id cannot go stale. KICK_CHATROOM_ID is the
    // fallback for our own channel if the lookup is blocked — by an ad
    // blocker, say — since a wrong or missing id subscribes successfully
    // and then sits silent, which looks like nobody is chatting.
    const channel = await fetchChannel(slug);
    const chatroomId =
      channel?.chatroomId ?? (slug === KICK_SLUG ? KICK_CHATROOM_ID : null);

    if (!chatroomId) {
      setError(`Could not find a Kick chatroom for “${slug}”.`);
      setStatus("idle");
      return;
    }
    setLive(Boolean(channel?.live));
    connectChat(chatroomId);
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
    const built = buildStrip(pool, picked);
    setStrip(built);

    const finish = () => {
      setWinner(picked);
      setRolling(false);
    };

    // Where the strip must end up for card WINNER_AT to sit under the
    // pointer. Computed from fixed geometry rather than measured mid-flight,
    // so the card the reel stops on is always the one that was drawn.
    const centreOn = (width: number) => -(WINNER_AT * PITCH) + width / 2 - CARD_W / 2;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setGliding(false);
      setOffset(centreOn(viewport.current?.clientWidth ?? 0));
      finish();
      return;
    }

    // Snap to the start with no transition, then let the browser paint before
    // turning it on — setting both in one frame animates from wherever the
    // previous spin ended instead of from the beginning.
    setGliding(false);
    setOffset(0);
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        setGliding(true);
        setOffset(centreOn(viewport.current?.clientWidth ?? 0));
      }),
    );
    window.setTimeout(finish, SPIN_MS);
  }

  function clearAll() {
    setEntries([]);
    setWinner(null);
    setWinnerLines([]);
    setStrip([]);
    setGliding(false);
    setOffset(0);
  }

  const connected = status === "connected";
  const statusLabel = {
    idle: "Not connected",
    connecting: "Connecting…",
    // Deliberately not "live": we read the chat socket, which says nothing
    // about whether the stream itself is broadcasting.
    // "Live" is the stream; "connected" is only our socket. Both are worth
    // showing, because a quiet board on an offline channel is expected.
    connected: live ? "Connected · live" : "Connected",
    error: "Connection error",
  }[status];

  return (
    <main className="lbPage gwPage">
      <MotionObserver />

      <header className="gwBar">
        <span className="gwBarChannel">
          <SiKick aria-hidden="true" />
          kick.com/<strong>{slug}</strong>
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
              <span>Kick channel</span>
              <input
                value={slug}
                onChange={(event) => setSlug(event.target.value.trim().toLowerCase())}
                disabled={connected || status === "connecting"}
                spellCheck={false}
                autoComplete="off"
              />
            </label>
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
          <section className="gwCard gwReelCard">
            {strip.length === 0 ? (
              <p className="gwMuted gwReelIdle">
                {entries.length === 0
                  ? "Entries appear here as viewers type the keyword."
                  : `Ready to spin ${entries.length} ${entries.length === 1 ? "entry" : "entries"}.`}
              </p>
            ) : (
              <div className="gwReel" ref={viewport}>
                <span className="gwPointer gwPointerTop" aria-hidden="true" />
                <span className="gwPointer gwPointerBottom" aria-hidden="true" />
                <span className="gwReelWindow" aria-hidden="true" />
                <div
                  className={`gwStrip${gliding ? " isGliding" : ""}`}
                  style={{ transform: `translate3d(${offset}px, 0, 0)` }}
                >
                  {strip.map((entry, index) => (
                    <div
                      className={`gwSlot${!rolling && index === WINNER_AT ? " isCentre" : ""}`}
                      key={index}
                    >
                      <Avatar entry={entry} size={44} />
                      <span className="gwSlotName">{entry.username}</span>
                    </div>
                  ))}
                </div>
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
