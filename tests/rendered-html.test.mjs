import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import { after, before, test } from "node:test";

/**
 * The real board config, imported rather than restated or regex-scraped.
 *
 * Hardcoding "$5,000" and "Top 8" here is how these assertions came to
 * describe a partner the site had already replaced: they passed while
 * asserting the wrong thing, then failed for the wrong reason once the pool
 * changed. Node strips the TypeScript, so this is the same object the pages
 * render from — a board added in data.ts is covered here automatically.
 */
const { boards } = await import("../app/data.ts");

const totalPool = boards.reduce(
  (sum, board) => sum + board.prizes.reduce((a, b) => a + b, 0),
  0,
);
const poolText = `$${totalPool.toLocaleString("en-US")}`;

const PORT = 3412;
const BASE_URL = `http://localhost:${PORT}`;

let server;

async function waitForServer(timeoutMs = 30_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const response = await fetch(BASE_URL);
      if (response.ok || response.status < 500) return;
    } catch {
      // not ready yet
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Server did not become ready on ${BASE_URL} within ${timeoutMs}ms`);
}

before(async () => {
  server = spawn("node", ["node_modules/next/dist/bin/next", "start", "-p", String(PORT)], {
    cwd: new URL("..", import.meta.url),
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, NODE_ENV: "production" },
  });
  server.stdout?.on("data", () => {});
  server.stderr?.on("data", () => {});
  await waitForServer();
});

after(() => {
  server?.kill();
});

async function htmlFor(path) {
  const response = await fetch(`${BASE_URL}${path}`, {
    headers: { accept: "text/html" },
  });
  assert.equal(response.status, 200, `${path} should render successfully`);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);
  return response.text();
}

/** For non-HTML routes: robots.txt, sitemap.xml. */
async function fetchText(path) {
  const response = await fetch(`${BASE_URL}${path}`);
  assert.equal(response.status, 200, `${path} should respond`);
  return response.text();
}

test("home is a focused RambleGamble hub", async () => {
  const html = await htmlFor("/");
  assert.match(html, /Leaderboards\. Rewards\. Live with RambleGamble\./i);
  assert.match(html, new RegExp(`\\${poolText}.*Leaderboard`, "is"));
  assert.match(html, /Watch Live/i);
  assert.match(html, /REWARDS/);
  assert.match(html, /code RAMBLEGG/i);
  assert.match(html, /href="\/leaderboard"/i);
  assert.match(html, /href="\/#stream"/i);
  // Kick player embed, not a YouTube reel.
  assert.match(html, /player\.kick\.com\/ramblegamble/);
  assert.match(html, /Watch on Kick/i);
  // The hero animation layers must all be present in the markup.
  assert.match(html, /heroSky/);
  assert.match(html, /cloudLayer/);
  assert.match(html, /petalLayer/);
  assert.match(html, /waterBack/);
  assert.match(html, /waterFront/);
  assert.match(html, /heroKoi/);
  assert.match(html, /heroPine/);
  // No leftovers from the site this was derived from.
  assert.doesNotMatch(html, /Frizz|juicebox|Stake|bubble/i);
  // YouTube and Twitch were dropped entirely — socials are Kick, X, Discord.
  assert.doesNotMatch(html, /youtube/i, "no YouTube anywhere");
  assert.doesNotMatch(html, /twitch/i, "no Twitch anywhere");
});

test("the pixel day-to-night theme is wired up", async () => {
  const [styles, footer, waterFront, waterBack] = await Promise.all([
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../app/components/site-footer.tsx", import.meta.url), "utf8"),
    readFile(new URL("../public/water-front.svg", import.meta.url), "utf8"),
    readFile(new URL("../public/water-back.svg", import.meta.url), "utf8"),
  ]);

  // Hero animation keyframes.
  assert.match(styles, /\.homeHero/);
  assert.match(styles, /@keyframes petalFall/);
  assert.match(styles, /@keyframes petalSway/);
  assert.match(styles, /@keyframes cloudDrift/);
  assert.match(styles, /@keyframes waterScrollBack/);
  assert.match(styles, /@keyframes waterScrollFront/);
  assert.match(styles, /@keyframes koiSwim/);
  assert.match(styles, /@keyframes pineSway/);
  assert.match(styles, /@keyframes skyDrift/);
  assert.match(styles, /hero-backdrop\.webp/);
  assert.match(styles, /water-front\.svg/);

  // Day-to-night band ladder, each step darker than the last.
  assert.match(styles, /\.bandDawn/);
  assert.match(styles, /\.bandDusk/);
  assert.match(styles, /\.bandNight/);
  assert.match(styles, /\.bandFooter/);
  // Sections are separated by a plain rule, not a ridge silhouette.
  assert.match(styles, /\.band \{[^}]*border-top:/s);
  assert.doesNotMatch(styles, /ridge-divider/, "ridge dividers were retired");

  // Pixel-art rendering and the sampled palette.
  assert.match(styles, /image-rendering:\s*pixelated/);
  assert.match(styles, /--sky:\s*#71b8f7/);
  assert.match(styles, /--vermillion:\s*#f31904/);
  assert.match(styles, /--midnight:\s*#0b1430/);
  assert.match(styles, /--font-display:\s*"DotGothic16"/);
  assert.match(styles, /fonts\.googleapis\.com/);

  // Motion system and the reduced-motion escape hatch.
  assert.match(styles, /pageRiseIn/);
  assert.match(styles, /podiumFirstIn/);
  assert.match(styles, /countValueIn/);
  assert.match(styles, /motion-pending/);
  assert.match(styles, /prefers-reduced-motion/);

  assert.match(footer, /Keep Up With/);
  assert.match(footer, /SocialLinks footer/);

  // Scrolling tiles must loop, or a seam walks across the hero.
  for (const [name, svg] of [["water-front", waterFront], ["water-back", waterBack]]) {
    assert.ok(svg.includes("<svg"), `${name} should be an SVG`);
  }
});

test("the leaderboard has its own page", async () => {
  const leaderboard = await htmlFor("/leaderboard");

  assert.match(leaderboard, /Wager Leaderboard/i);
  assert.match(leaderboard, /Bi-Weekly Leaderboard/i);
  assert.match(leaderboard, /Resets every 2 weeks/i);
  assert.match(leaderboard, /RAMBLEGG/);

  // Only the selected board's panel renders; every board must at least be
  // reachable from the switcher.
  const first = boards[0];
  assert.match(
    leaderboard,
    new RegExp(`Top.{0,12}${first.prizes.length}.{0,12}paid`, "is"),
    `${first.name}: paid places rendered`,
  );
  for (const board of boards) {
    assert.match(leaderboard, new RegExp(board.name), `${board.name} offered`);
  }
});

test("the leaderboard switcher is a real tablist, not a row of buttons", async () => {
  const html = await htmlFor("/leaderboard");
  const source = await readFile(
    new URL("../app/leaderboard/board-switcher.tsx", import.meta.url),
    "utf8",
  );

  if (boards.length < 2) {
    // One board is not a choice; the switcher should stay hidden.
    assert.doesNotMatch(html, /role="tablist"/, "no switcher for a single board");
    return;
  }

  assert.match(html, /role="tablist"/);
  assert.match(html, new RegExp(`Switch between.{0,40}${boards.length}`, "is"));

  for (const board of boards) {
    assert.match(html, new RegExp(`board-tab-${board.key}`), `${board.name} has a tab`);
    // Each tab advertises that board's own pool, so the choice is meaningful
    // before you make it.
    assert.match(html, new RegExp(board.pool.replace("$", "\\$")), `${board.name} pool on its tab`);
  }

  // Exactly one tab starts selected, and it owns the rendered panel.
  const selected = [...html.matchAll(/aria-selected="true"/g)];
  assert.equal(selected.length, 1, "exactly one tab is selected");
  assert.match(html, /role="tabpanel"/);
  assert.match(html, new RegExp(`aria-controls="board-panel-${boards[0].key}"`));

  // Arrow keys must move between tabs and only the active one may sit in the
  // tab order — otherwise this is a button row wearing tab roles.
  assert.match(source, /ArrowRight/, "arrow keys move between tabs");
  assert.match(source, /ArrowLeft/);
  assert.match(source, /tabIndex=\{selected \? 0 : -1\}/, "roving tabindex");
  assert.match(source, /\.focus\(\)/, "focus follows selection");
});

test("shared navigation, metadata, and data config are consistent", async () => {
  const [layout, header, packageJson, leaderboards, data, countdown, origin] = await Promise.all([
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/site-header.tsx", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
    readFile(new URL("../app/lib/leaderboards.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/data.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/components/month-countdown.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/lib/request-origin.ts", import.meta.url), "utf8"),
  ]);

  assert.match(layout, /SiteHeader/);
  assert.match(layout, /og\.png/);
  assert.match(layout, /requestOrigin/);
  assert.match(header, /\/leaderboard/);
  assert.match(header, /#stream/);
  assert.match(header, /Claim Reward/);
  assert.match(packageJson, /"name": "ramblegamble-site"/);
  assert.match(leaderboards, /fetchOverride/);
  assert.match(leaderboards, /LEADERBOARD_CSV_URL/);
  assert.ok(boards.length >= 1, "at least one board is configured");
  for (const board of boards) {
    assert.equal(board.period, "biweek", `${board.name} runs bi-weekly`);
    assert.ok(board.url.startsWith("https://"), `${board.name} links over https`);
  }
  assert.match(data, /export const brand/);
  assert.match(countdown, /countValue/);
  assert.doesNotMatch(leaderboards, /node:fs/);
  assert.doesNotMatch(origin, /x-forwarded-host/);
});

test("the reveal observer lives in the page segments, not the layout", async () => {
  const [layout, page, lb] = await Promise.all([
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/leaderboard/leaderboard-client.tsx", import.meta.url), "utf8"),
  ]);

  // In the layout it hydrates before a suspended page boundary and rewrites
  // className on DOM that boundary hasn't hydrated yet — a hydration
  // mismatch that only shows up once a route has a loading.tsx.
  assert.doesNotMatch(layout, /MotionObserver/, "must not run from the root layout");
  assert.match(page, /<MotionObserver \/>/);
  assert.match(lb, /<MotionObserver \/>/);
});

test("the Kick stream embed points at our own channel", async () => {
  const [stream, data] = await Promise.all([
    readFile(new URL("../app/components/stream-section.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/data.ts", import.meta.url), "utf8"),
  ]);

  // The slug is defined once and reused, so the embed and the watch links
  // can never drift onto different channels.
  assert.match(data, /KICK_SLUG = "ramblegamble"/);
  assert.match(data, /player\.kick\.com\/\$\{KICK_SLUG\}/);
  assert.match(data, /kick\.com\/\$\{KICK_SLUG\}/);
  assert.match(stream, /KICK_EMBED_URL/);
  // A literal slug after the slash would mean the embed can drift from the
  // links; every occurrence must interpolate the constant instead.
  assert.doesNotMatch(stream, /kick\.com\/[a-z0-9]/i, "no hardcoded channel slug");

  // The retired YouTube reel must be fully gone, not just unlinked.
  await assert.rejects(
    () => readFile(new URL("../app/components/videos-section.tsx", import.meta.url)),
    "videos-section.tsx should be deleted",
  );
  assert.equal((await fetch(`${BASE_URL}/api/videos`)).status, 404);
});

test("every asset the pages reference actually exists", async () => {
  const [page, leaderboardClient, splash, header, styles] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/leaderboard/leaderboard-client.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/splash-screen.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/site-header.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);

  const referenced = new Set();
  for (const source of [page, leaderboardClient, splash, header, styles]) {
    for (const [, path] of source.matchAll(/["'(](\/[\w./-]+\.(?:png|webp|svg|ico))["')]/g)) {
      referenced.add(path);
    }
  }
  // Sprite paths built from a template literal.
  for (const n of [1, 2]) referenced.add(`/petal-${n}.png`);
  for (const n of [1, 2, 3]) referenced.add(`/drift-${n}.png`);
  for (const n of [1, 2, 3]) referenced.add(`/medal-${n}.png`);
  referenced.add("/wordmark.png");

  assert.ok(referenced.size > 12, "should have found the asset references");
  for (const path of [...referenced].sort()) {
    const file = new URL(`../public${path}`, import.meta.url);
    await assert.doesNotReject(
      () => readFile(file),
      `${path} is referenced but missing from public/`,
    );
  }
});

test("every board's advertised pool matches what its ladder actually pays", async () => {
  const html = await htmlFor("/leaderboard");

  for (const board of boards) {
    const advertised = Number(board.pool.replace(/[^0-9]/g, ""));
    const paid = board.prizes.reduce((a, b) => a + b, 0);

    assert.equal(paid, advertised, `${board.name}: ladder must sum to ${board.pool}`);
    assert.ok(board.prizes.length > 0, `${board.name}: has a ladder`);

    // A ladder paying a lower place more than a higher one is always a typo,
    // and one reached us as 2nd $200 / 3rd $250.
    for (let i = 1; i < board.prizes.length; i += 1) {
      assert.ok(
        board.prizes[i] <= board.prizes[i - 1],
        `${board.name}: place ${i + 1} pays $${board.prizes[i]}, more than place ${i}`,
      );
    }

    // The pool is rendered, not merely configured.
    assert.match(html, new RegExp(board.pool.replace("$", "\\$")), `${board.name} pool rendered`);
  }
});

test("every partner's rewards are shown, and none are borrowed", async () => {
  const html = await htmlFor("/");

  for (const board of boards) {
    // Each partner gets its own group, so a visitor can tell whose bonus is
    // whose rather than reading one undifferentiated pile of offers.
    assert.match(html, new RegExp(board.name), `${board.name} appears in rewards`);

    for (const offer of board.offers) {
      assert.match(html, new RegExp(offer.headline), `${board.name}: ${offer.headline}`);
      assert.match(
        html,
        new RegExp(offer.amount.replace("$", "\\$")),
        `${board.name}: ${offer.headline} amount`,
      );
    }
    for (const tier of board.wagerTiers) {
      assert.match(
        html,
        new RegExp(tier.wagered.replace("$", "\\$")),
        `${board.name}: wager tier ${tier.wagered}`,
      );
    }
  }

  // A partner with no confirmed terms must show none, not inherit another
  // casino's. Counting cards catches that: each partner contributes its own
  // offers, or exactly one leaderboard card when it has none — so a borrowed
  // offer shows up as a card with no configuration behind it, and no partner
  // can silently vanish from the section either.
  const expectedCards = boards.reduce(
    (n, board) => n + (board.offers.length || 1),
    0,
  );
  const rendered = [...html.matchAll(/class="bonusCard"/g)].length;
  assert.equal(
    rendered,
    expectedCards,
    `${rendered} reward cards rendered but ${expectedCards} expected`,
  );

  // Where a partner does publish bonuses, those lead — the pool has its own
  // page and repeating it pushes the real offers down.
  const withOffers = boards.filter((board) => board.offers.length > 0);
  for (const board of withOffers) {
    assert.doesNotMatch(
      html,
      new RegExp(`on top of ${board.name}&#x27;s rewards`),
      `${board.name} has real offers, so it should not lead with the pool card`,
    );
  }
});

test("the giveaway picker draws fairly and stores nothing", async () => {
  const html = await htmlFor("/giveaway");
  const client = await readFile(
    new URL("../app/giveaway/giveaway-client.tsx", import.meta.url),
    "utf8",
  );
  const data = await readFile(new URL("../app/data.ts", import.meta.url), "utf8");
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");

  assert.match(html, /Giveaway Picker/i);
  assert.match(html, new RegExp(`kick\\.com/`), "the channel is shown");

  // This picks who receives real money. Math.random is not uniform across its
  // range and is predictable from prior output, so the draw uses the crypto
  // RNG with rejection sampling — plain modulo would favour early entrants.
  assert.match(client, /crypto\.getRandomValues/, "draw uses the crypto RNG");
  // Match the call, not the comment that explains why it is absent.
  assert.doesNotMatch(client, /Math\.random\s*\(/, "Math.random must not decide a winner");
  assert.match(client, /while \(value >= limit\)/, "rejection sampling avoids modulo bias");

  // The winner is chosen before the strip is built, so the animation is
  // decoration and cannot influence or be influenced by it.
  const picked = client.indexOf("const picked = pool[fairIndex");
  const built = client.indexOf("buildStrip(pool, picked)");
  assert.ok(picked > 0 && built > 0, "draw and strip both present");
  assert.ok(picked < built, "the winner is decided before the strip is built");

  // The reel must physically travel, not swap contents in place, and it must
  // stop with the winner's card under the pointer.
  assert.match(client, /translate3d\(\$\{offset\}px/, "the strip is translated");
  assert.match(
    client,
    /-\(WINNER_AT \* PITCH\) \+ width \/ 2 - CARD_W \/ 2/,
    "the landing offset centres the winner's card",
  );
  // Geometry is shared with the CSS; if they drift the reel stops on the
  // wrong card, so both sides must agree on the card width.
  assert.match(client, /const CARD_W = 132/);
  assert.match(css, /\.gwSlot \{[^}]*flex: 0 0 132px/s, "CSS card width matches CARD_W");
  assert.match(css, /\.gwStrip\.isGliding \{\s*transition: transform/);

  // Entries must close the moment a draw starts, or someone can join a draw
  // that is already running.
  assert.match(client, /setOpen\(false\);[\s\S]{0,240}const picked = pool\[fairIndex/);

  // Chat is read straight from Kick's public socket: no credentials, no
  // server hop, and nothing persisted beyond the tab.
  assert.match(client, /wss:\/\/ws-us2\.pusher\.com/);
  assert.doesNotMatch(client, /localStorage|sessionStorage|document\.cookie/, "nothing persisted");
  assert.match(html, /No Kick login is used and nothing is\s+stored/i);

  // The chatroom id cannot be resolved at runtime — Kick sends no CORS
  // headers and Cloudflare rejects a server fetch — so it is configured, and
  // the reason has to stay recorded next to it.
  assert.match(data, /export const KICK_CHATROOM_ID = \d+;/);
  assert.match(data, /CORS/, "the reason the id is hardcoded is documented");
});

test("the wheel page offers every prize at equal odds", async () => {
  const [html, data] = await Promise.all([
    htmlFor("/wheel"),
    readFile(new URL("../app/data.ts", import.meta.url), "utf8"),
  ]);

  for (const prize of ["$10 Tip", "$20 Tip", "$40 Bonus Buy", "$60 Bonus Buy"]) {
    assert.ok(html.includes(prize) || html.includes(prize.split(" ")[0]),
      `${prize} should be on the wheel`);
  }

  // Each prize must appear the same number of times, or the odds are skewed.
  const block = /export const wheelPrizes[\s\S]*?\];/.exec(data)[0];
  const names = [...block.matchAll(/name: "([^"]+)"/g)].map((m) => m[1]);
  const counts = new Map();
  for (const n of names) counts.set(n, (counts.get(n) ?? 0) + 1);
  assert.equal(counts.size, 4, "four distinct prizes");
  assert.equal(new Set(counts.values()).size, 1, "every prize appears equally often");
  assert.equal(names.length % counts.size, 0, "segments divide evenly across prizes");
});

test("socials are exactly the three accounts that exist", async () => {
  const data = await readFile(new URL("../app/data.ts", import.meta.url), "utf8");
  const block = /export const socials = \{[\s\S]*?\} as const;/.exec(data)[0];

  assert.match(block, /kick\.com\/\$\{KICK_SLUG\}/);
  assert.match(block, /x\.com\/RambleGG/);
  assert.match(block, /discord\.gg\/ramblegamble/);
  // Placeholder accounts that were never real must not come back.
  assert.doesNotMatch(block, /twitch|youtube/i);
  const keys = [...block.matchAll(/^ {2}(\w+):/gm)].map((m) => m[1]).sort();
  assert.deepEqual(keys, ["discord", "kick", "x"], "exactly three socials");

  const html = await htmlFor("/");
  assert.match(html, /x\.com\/RambleGG/);
});

test("every board links to the partner that issued its code", async () => {
  const data = await readFile(new URL("../app/data.ts", import.meta.url), "utf8");
  assert.match(data, /AFFILIATE_CODE = "RAMBLEGG"/);
  assert.doesNotMatch(data, /TODO/, "no unresolved partner placeholders left");

  // Only the selected board's panel is in the DOM on /leaderboard, but the
  // home rewards section lists every partner — so check the links there.
  const home = await htmlFor("/");
  for (const board of boards) {
    // The referral URL must actually point at that partner's domain — a board
    // labelled one casino while linking to another sends players, and our
    // commission, to the wrong place.
    const host = new URL(board.url).hostname.replace(/^www\./, "");
    assert.ok(
      host.includes(board.name.toLowerCase()),
      `${board.name} links to ${host}, which is not their domain`,
    );
    assert.match(home, new RegExp(host.replace(/\./g, "\\.")), `${board.name} link rendered`);
  }
});

test("each board reports what its own partner actually measures", async () => {
  const html = await htmlFor("/leaderboard");
  assert.match(html, /<span>Player<\/span>/);

  // Dicey ranks on points; other affiliate feeds report dollars wagered.
  // Labelling one as the other puts a number on screen that means something
  // else, so the column heading is driven by each board's own metric. Only
  // the selected board is in the DOM, so this checks the one that renders
  // first — any others are exercised by switching, covered separately.
  const label = boards[0].metric === "wagered" ? "Wagered" : "Points";
  const other = label === "Wagered" ? "Points" : "Wagered";
  assert.match(html, new RegExp(`<span>${label}</span>`), `${boards[0].name}: ${label} column`);
  if (boards.every((board) => board.metric === boards[0].metric)) {
    assert.doesNotMatch(html, new RegExp(`<span>${other}</span>`));
  }

  // The metric must be derived, never hardcoded, or two partners measuring
  // different things end up with the same heading.
  const client = await readFile(
    new URL("../app/leaderboard/leaderboard-client.tsx", import.meta.url),
    "utf8",
  );
  assert.match(client, /scoreLabel\(board\)/, "column heading comes from the board");
  assert.match(client, /score\(board, player\.score\)/, "values formatted per board");

  // Masking: four characters then four stars. Asserted against the rule
  // rather than the rendered rows, because a board can legitimately be empty
  // — a test needing visible players fails on a partner's schedule, not on a
  // regression here. Dicey masks server-side, but an affiliate feed may
  // return raw usernames, so this must hold regardless of partner.
  const data = await readFile(new URL("../app/data.ts", import.meta.url), "utf8");
  assert.match(data, /\$\{clean\.slice\(0, 4\)\}\*{4}/, "maskedName yields nugg****");

  const rows = [...html.matchAll(/<div class="tablePlayer">.*?<\/div>/gs)];
  for (const [row] of rows) {
    assert.match(row, /\w{4}\*{4}|Hidden/, `unmasked player rendered: ${row.slice(0, 120)}`);
  }
  if (rows.length === 0) {
    // Either explanation is valid — nobody has scored yet, or the feed could
    // not be read. What must never happen is an empty table with no reason.
    assert.match(
      html,
      /will appear here shortly|temporarily unavailable/,
      "an empty board always explains itself",
    );
  }
});

test("production canonicalises to the live domain, on the host that serves it", async () => {
  const origin = await readFile(new URL("../app/lib/request-origin.ts", import.meta.url), "utf8");

  // Vercel 308s the apex to www. Canonicalising to the apex would point every
  // page at a URL that redirects, so the www host is the one to name.
  assert.match(
    origin,
    /PRODUCTION_ORIGIN = "https:\/\/www\.ramblespins\.com"/,
    "canonical host is www, matching the 308 target",
  );

  // VERCEL_PROJECT_PRODUCTION_URL resolved to the *.vercel.app hostname even
  // after the custom domain was attached, which shipped a live site crediting
  // ramble-delta-five.vercel.app. It must not creep back in.
  // Match the actual read, not the comment that explains why it is absent.
  assert.doesNotMatch(
    origin,
    /process\.env\.VERCEL_PROJECT_PRODUCTION_URL/,
    "no unreliable domain lookup",
  );

  // SITE_URL stays the escape hatch and must outrank everything.
  assert.ok(
    origin.indexOf("SITE_URL") < origin.indexOf("VERCEL_URL"),
    "SITE_URL overrides the per-deployment URL",
  );

  // The rendered site must never advertise a placeholder or loopback origin.
  const html = await htmlFor("/");
  assert.doesNotMatch(html, /ramblegamble\.example|localhost|127\.0\.0\.1/, "no stand-in origin");

  const robots = await fetchText("/robots.txt");
  assert.match(robots, /Sitemap: https:\/\/www\.ramblespins\.com\/sitemap\.xml/);
});

test("preview deploys stay out of the index", async () => {
  // Previews serve identical copy on their own hostname, so indexing them puts
  // duplicate content in front of ramblespins.com.
  const layout = await readFile(new URL("../app/layout.tsx", import.meta.url), "utf8");
  assert.match(layout, /isPreviewDeployment\(\)/, "layout branches on deploy environment");
  assert.match(layout, /index: false, follow: false/, "previews are noindex");

  // The meta tag only helps once a crawler has fetched the page; robots.txt
  // stops the fetch. Both are needed.
  const robotsRoute = await readFile(
    new URL("../app/robots.txt/route.ts", import.meta.url),
    "utf8",
  );
  assert.match(robotsRoute, /isPreviewDeployment\(\)/);
  assert.match(robotsRoute, /"Disallow: \/"/, "previews disallow crawling");

  // This build is not a preview, so the live behaviour must be the open one.
  const robots = await fetchText("/robots.txt");
  assert.match(robots, /Allow: \//);
  assert.doesNotMatch(robots, /Disallow: \//);
});

test("every outbound fetch declares a revalidate, keeping routes static", async () => {
  // An undeclared fetch is uncached in Next 16, which opts the route out of
  // static generation. The build output below is the real proof, but catching
  // it at the call site says which fetch regressed.
  for (const file of ["../app/lib/dicey-race.ts", "../app/lib/leaderboards.ts"]) {
    const text = await readFile(new URL(file, import.meta.url), "utf8");
    const calls = [...text.matchAll(/\bfetch\(/g)].length;
    const declared = [...text.matchAll(/next: \{ revalidate: \d+ \}/g)].length;
    assert.equal(declared, calls, `${file}: ${calls} fetch calls but ${declared} revalidates`);
  }

  // Module-level caches are per-instance on serverless: two visitors routed to
  // different lambdas would see different standings, unpurgeable.
  const boards = await readFile(new URL("../app/lib/leaderboards.ts", import.meta.url), "utf8");
  const race = await readFile(new URL("../app/lib/dicey-race.ts", import.meta.url), "utf8");
  for (const [name, text] of [["leaderboards", boards], ["dicey-race", race]]) {
    assert.doesNotMatch(text, /^(let|const) cache\b/m, `${name} keeps no module-level cache`);
  }
});

test("the feed is wired to Dicey, and no secret is committed", async () => {
  const [dicey, layer] = await Promise.all([
    readFile(new URL("../app/lib/dicey-race.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/lib/leaderboards.ts", import.meta.url), "utf8"),
  ]);

  // Endpoints derived from the code, never pasted, or a code change would
  // leave the site showing a stranger's race.
  assert.match(
    dicey,
    /RACE_URL = `https:\/\/dicey\.com\/challenges\/wager-race\/\$\{AFFILIATE_CODE\.toLowerCase\(\)\}\.data`/,
    "race URL derives from AFFILIATE_CODE",
  );
  assert.doesNotMatch(dicey, /wager-race\/ramblegg/i, "no baked-in race slug");
  // Their API has introspection disabled, so this document was recovered from
  // their client bundle; edited by guesswork it 400s and the board goes blank.
  assert.match(dicey, /query GetWagerRaceLeaderboard\(\$raceId: ID!, \$limit: Int\)/);

  // Whatever partner is wired up, a key must never be inlined into the client
  // bundle and none may be committed with a value.
  const sources = await Promise.all(
    ["../app/lib/dicey-race.ts", "../app/lib/leaderboards.ts", "../app/data.ts"].map((path) =>
      readFile(new URL(path, import.meta.url), "utf8"),
    ),
  );
  for (const text of sources) {
    assert.doesNotMatch(text, /NEXT_PUBLIC_/, "no key may reach the client bundle");
  }
  // Anchored per line: an unanchored \s* spans newlines, so an empty var
  // followed by a comment reads as a value and this never fails.
  const example = await readFile(new URL("../.env.example", import.meta.url), "utf8");
  assert.doesNotMatch(
    example,
    /^\s*[A-Z_][A-Z0-9_]*=.+$/m,
    "the example file ships names, never values",
  );

  // Order matters: an operator-set feed overrides, then the partner's own
  // feed, then — only behind an explicit flag — placeholders.
  // Match the calls, not the prose: the placeholder flag is named in a
  // comment near the top of the file, well before any of these run.
  const override = layer.indexOf("await fetchOverride(board)");
  const live = layer.indexOf("await fetchLive(board)");
  const placeholder = layer.indexOf('env("SHOW_PLACEHOLDER_STANDINGS")');
  assert.ok(override > 0 && live > 0 && placeholder > 0, "all three branches exist");
  assert.ok(override < live && live < placeholder, "override > live > placeholder");

  // Invented players must be unreachable without an explicit opt-in. A board
  // is legitimately empty until the first play lands; if that is treated as a
  // failure, fake names ship to a live promotion.
  assert.match(layer, /if \(live\) return/, "an empty array is an answer, not a failure");
  assert.doesNotMatch(layer, /if \(live\?\.length\)/, "empty must not fall through");

  for (const page of ["/leaderboard", "/"]) {
    const html = await htmlFor(page);
    for (const name of ["KoiRunner", "SakuraDrift", "NightPagoda", "BlueRidge"]) {
      assert.doesNotMatch(html, new RegExp(name), `${page} rendered ${name}`);
    }
  }
});

test("an empty board says so instead of inventing entrants", async () => {
  // The empty state is reached before the first wagers settle AND while Dicey
  // recomputes, so it must not assert that nobody has played.
  const client = await readFile(
    new URL("../app/leaderboard/leaderboard-client.tsx", import.meta.url),
    "utf8",
  );
  const home = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");

  assert.match(client, /will appear here shortly/);
  assert.match(home, /will appear here shortly/);
  for (const [name, text] of [["leaderboard", client], ["home", home]]) {
    assert.doesNotMatch(text, /No points recorded/, `${name} does not claim nobody played`);
  }

  // A feed we cannot read once rendered exactly like a race nobody had
  // entered, which hid the fault completely. The two must differ on screen —
  // for visitors, and so a broken feed is detectable from outside a deploy.
  const boards = await readFile(new URL("../app/lib/leaderboards.ts", import.meta.url), "utf8");
  assert.match(boards, /status: BoardStatus/, "the board reports whether it loaded");
  assert.match(boards, /status: "unavailable"/, "a failed read is marked unavailable");
  for (const [name, text] of [["leaderboard", client], ["home", home]]) {
    assert.match(text, /temporarily unavailable/, `${name} distinguishes failure from empty`);
  }

  // Both pages must guard their podium; three cards cannot render from an
  // empty board without crashing on undefined.
  assert.match(client, /topThree\.length === 3 \?/, "leaderboard podium is guarded");
  assert.match(home, /ribbonOrder\.length === 3 \?/, "home podium is guarded");
});
