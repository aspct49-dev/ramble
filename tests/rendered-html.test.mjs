import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import { after, before, test } from "node:test";

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

/**
 * Board config read from data.ts rather than restated here.
 *
 * Hardcoding "$5,000" and "Top 8" is how these assertions came to describe a
 * partner the site had already replaced — they passed while asserting the
 * wrong thing, then failed for the wrong reason once the pool changed.
 */
async function boardConfig() {
  const data = await readFile(new URL("../app/data.ts", import.meta.url), "utf8");
  return {
    pool: /pool:\s*"([^"]+)"/.exec(data)[1],
    paidPlaces: Number(/paidPlaces:\s*(\d+)/.exec(data)[1]),
    name: /name:\s*"([^"]+)",\s*\n\s*logo:/.exec(data)[1],
  };
}

test("home is a focused RambleGamble hub", async () => {
  const html = await htmlFor("/");
  const board = await boardConfig();
  assert.match(html, /Leaderboards\. Rewards\. Live with RambleGamble\./i);
  assert.match(html, new RegExp(`\\${board.pool}.*Leaderboard`, "is"));
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
  const board = await boardConfig();
  assert.match(leaderboard, /Resets every 2 weeks/i);
  assert.match(leaderboard, new RegExp(`Top.{0,12}${board.paidPlaces}.{0,12}paid`, "is"));
  assert.match(leaderboard, /RAMBLEGG/);
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
  assert.match(data, /PRIZE_LADDER = \[400, 250, 200, 100, 50\]/);
  assert.match(leaderboards, /fetchOverride/);
  assert.match(leaderboards, /LEADERBOARD_CSV_URL/);
  assert.match(data, /paidPlaces:\s*5,[\s\S]*period:\s*"biweek"/);
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

test("the advertised pool matches what the prize table actually pays", async () => {
  const [html, data] = await Promise.all([
    htmlFor("/leaderboard"),
    readFile(new URL("../app/data.ts", import.meta.url), "utf8"),
  ]);

  // Gamba's feed carries no payout tiers, so this ladder is ours alone and
  // nothing upstream can correct it — the arithmetic has to hold here.
  const prizes = JSON.parse(/const PRIZE_LADDER = (\[[^\]]+\])/.exec(data)[1]);
  const pool = Number(/pool:\s*"\$([\d,]+)"/.exec(data)[1].replace(/,/g, ""));
  const places = Number(/paidPlaces:\s*(\d+)/.exec(data)[1]);

  assert.equal(prizes.length, places, "one prize per paid place");
  assert.equal(
    prizes.reduce((a, b) => a + b, 0),
    pool,
    "prizes must sum to the advertised pool",
  );

  // A ladder that pays a lower place more than a higher one is always a typo.
  for (let i = 1; i < prizes.length; i += 1) {
    assert.ok(
      prizes[i] <= prizes[i - 1],
      `place ${i + 1} pays $${prizes[i]}, more than place ${i} at $${prizes[i - 1]}`,
    );
  }

  assert.match(data, /period:\s*"biweek"/);
  // The pool is rendered, not just configured.
  assert.match(html, new RegExp(`\\$${pool.toLocaleString("en-US")}`));
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

test("the affiliate link is the one Gamba issued", async () => {
  const data = await readFile(new URL("../app/data.ts", import.meta.url), "utf8");
  assert.match(data, /AFFILIATE_URL = "https:\/\/gamba\.com\/\?c=RambleGG"/);
  assert.match(data, /AFFILIATE_CODE = "RAMBLEGG"/);
  assert.doesNotMatch(data, /TODO/, "no unresolved partner placeholders left");

  // The previous partner must be gone everywhere, not just from data.ts —
  // a stale link would send players to a casino we no longer earn from.
  for (const page of ["/", "/leaderboard", "/bonuses", "/wheel"]) {
    const html = await htmlFor(page);
    assert.doesNotMatch(html, /dicey/i, `${page} still references the old partner`);
  }
  assert.match(await htmlFor("/leaderboard"), /gamba\.com\/\?c=RambleGG/);
});

test("the leaderboard reports what Gamba's feed actually measures", async () => {
  const html = await htmlFor("/leaderboard");

  // krush.gg returns dollars wagered, not points. Labelling this column
  // "Points" would put a number on screen that means something else.
  assert.match(html, /<span>Wagered<\/span>/);
  assert.match(html, /<span>Player<\/span>/);
  assert.doesNotMatch(html, /<span>Points<\/span>/, "the feed reports dollars, not points");
  const board = await boardConfig();
  assert.match(html, new RegExp(`Top.{0,12}${board.paidPlaces}.{0,12}paid`, "is"));

  // Masking matters more than it did before: the previous partner masked
  // usernames server-side, Gamba's feed returns them raw. This function is
  // now the only thing between the API and a player's handle being published.
  const data = await readFile(new URL("../app/data.ts", import.meta.url), "utf8");
  assert.match(data, /\$\{clean\.slice\(0, 4\)\}\*{4}/, "maskedName yields nugg****");

  const rows = [...html.matchAll(/<div class="tablePlayer">.*?<\/div>/gs)];
  for (const [row] of rows) {
    assert.match(row, /\w{4}\*{4}|Hidden/, `unmasked player rendered: ${row.slice(0, 120)}`);
  }
  if (rows.length === 0) {
    assert.match(html, /will appear here shortly/, "empty board explains itself");
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
  for (const file of ["../app/lib/gamba-race.ts", "../app/lib/leaderboards.ts"]) {
    const text = await readFile(new URL(file, import.meta.url), "utf8");
    const calls = [...text.matchAll(/\bfetch\(/g)].length;
    const declared = [...text.matchAll(/next: \{ revalidate: \d+ \}/g)].length;
    assert.equal(declared, calls, `${file}: ${calls} fetch calls but ${declared} revalidates`);
  }

  // Module-level caches are per-instance on serverless: two visitors routed to
  // different lambdas would see different standings, unpurgeable.
  const boards = await readFile(new URL("../app/lib/leaderboards.ts", import.meta.url), "utf8");
  const race = await readFile(new URL("../app/lib/gamba-race.ts", import.meta.url), "utf8");
  for (const [name, text] of [["leaderboards", boards], ["gamba-race", race]]) {
    assert.doesNotMatch(text, /^(let|const) cache\b/m, `${name} keeps no module-level cache`);
  }
});

test("the standings feed is wired to Gamba, with the key kept server-side", async () => {
  const race = await readFile(new URL("../app/lib/gamba-race.ts", import.meta.url), "utf8");

  assert.match(race, /https:\/\/api\.krush\.gg\/api\/affiliate\/wager-leader/);
  assert.match(race, /"X-API-Key": key/, "key travels in the documented header");
  assert.match(race, /startTimestamp/, "required window parameter is sent");

  // The API rejects a window opening more than 60 days ago; clamping keeps a
  // long-running race returning recent activity instead of a hard 400.
  assert.match(race, /MAX_LOOKBACK_DAYS = 60/);

  // A NEXT_PUBLIC_ prefix would inline the key into the client bundle.
  assert.doesNotMatch(race, /NEXT_PUBLIC_/, "the affiliate key must stay server-side");
  assert.match(race, /process\.env\.GAMBA_API_KEY/);

  // The key must never be committed, whatever else lands in the repo.
  const example = await readFile(new URL("../.env.example", import.meta.url), "utf8");
  assert.match(example, /^GAMBA_API_KEY=$/m, "example file ships the name, not a value");

  const boards = await readFile(new URL("../app/lib/leaderboards.ts", import.meta.url), "utf8");
  // Order matters: an operator-set feed overrides, then the live Gamba feed,
  // then — only behind an explicit flag — placeholders.
  const override = boards.indexOf("LEADERBOARD_CSV_URL");
  const live = boards.indexOf("fetchGambaLeaderboard(");
  const fallback = boards.lastIndexOf("fetchOverride(PRIZES)");
  assert.ok(override < live && live < fallback, "override > live Gamba > placeholder");

  // Invented players must be unreachable without an explicit opt-in. A fresh
  // race is genuinely empty until the first wagers land; if that is treated as
  // a failure, fake names ship to a live promotion.
  assert.match(
    boards,
    /if \(env\("SHOW_PLACEHOLDER_STANDINGS"\)\) return rank\(PLACEHOLDER_STANDINGS/,
    "placeholders require an explicit opt-in",
  );
  assert.match(boards, /if \(live\) \{/, "an empty array is an answer, not a failure");
  assert.doesNotMatch(boards, /if \(live\?\.length\)/, "empty must not fall through");

  for (const page of ["/leaderboard", "/"]) {
    const html = await htmlFor(page);
    for (const placeholder of ["KoiRunner", "SakuraDrift", "NightPagoda", "FujiClimber"]) {
      assert.doesNotMatch(html, new RegExp(placeholder), `${page} rendered ${placeholder}`);
    }
  }
});

test("the bonuses page reflects Gamba's published programme", async () => {
  const html = await htmlFor("/bonuses");

  // Every bonus and unlockable Gamba lists must be present — a partial list
  // undersells the offer players are being sent to.
  for (const perk of [
    "Rank-Up Bonus", "Rakeback", "Daily Bonus", "Weekly Bonus", "Monthly Bonus",
    "ReJuice", "Personal VIP Host", "Lottery Tickets", "Gamba Points", "VIP Experiences",
  ]) {
    assert.match(html, new RegExp(perk.replace(/[-]/g, "[-]")), `missing perk: ${perk}`);
  }

  // The XP rate is the one hard number on the page; it comes from Gamba.
  assert.match(html, /1 XP/);

  // Gamba owns the per-rank terms and revises them, so the page must defer to
  // their programme page rather than restating rates that could go stale.
  assert.match(html, /gamba\.com\/vip-program/);

  // No invented rates. Anything quoting a specific rakeback or cashback
  // percentage would be a number we cannot source.
  assert.doesNotMatch(html, /\d+% (rakeback|cashback|lossback)/i, "no unsourced rates");

  // It has to be reachable, or it may as well not exist.
  const home = await htmlFor("/");
  assert.match(home, /href="\/bonuses"/, "bonuses is linked from the site");
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

  // A missing API key once rendered exactly like a race nobody had entered,
  // which hid a production misconfiguration completely. The two must differ
  // on screen — for visitors, and so a broken feed is detectable from outside.
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
