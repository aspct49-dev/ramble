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
 * changed. Node strips the TypeScript, so these are the same values the
 * pages render from.
 */
const { boards, brand, periodName, primaryBoard, totalPool } = await import("../app/data.ts");

const poolText = `$${totalPool.toLocaleString("en-US")}`;

/**
 * Literal text as a regex.
 *
 * Hand-escaping "$" inside a template literal is how two of these assertions
 * silently became /$50/ — an end-anchor followed by "50", which matches
 * nothing — instead of /\$50/.
 */
const literal = (text) => new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));

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
  const html = await response.text();
  // React writes <!-- --> between literal text and an interpolated value, so
  // "$30,000" ships as "$<!-- -->30,000". They carry no meaning for these
  // assertions and silently break any match that spans the boundary.
  return html.replaceAll("<!-- -->", "");
}

/** For non-HTML routes: robots.txt, sitemap.xml. */
async function fetchText(path) {
  const response = await fetch(`${BASE_URL}${path}`);
  assert.equal(response.status, 200, `${path} should respond`);
  return response.text();
}

test("home is a focused RambleGamble hub", async () => {
  const html = await htmlFor("/");
  // Asserted from the config, not restated: the tagline changed with the
  // partner and a hardcoded copy of it just fails for the wrong reason.
  assert.match(html, literal(brand.tagline));
  assert.match(html, literal(brand.summary));
  assert.match(html, new RegExp(literal(poolText).source + ".*Leaderboard", "is"));
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
  // Dicey and the raffle were both retired for the Kingz leaderboard.
  assert.doesNotMatch(html, /dicey/i, "no Dicey anywhere");
  assert.doesNotMatch(html, /raffle/i, "no raffle anywhere");
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
  assert.ok(boards.length >= 1, "at least one partner is configured");
  for (const board of boards) {
    assert.ok(board.url.startsWith("https://"), `${board.name} links over https`);
  }
  assert.match(data, /export const brand/);
  assert.match(countdown, /countValue/);
  assert.doesNotMatch(leaderboards, /node:fs/, "the leaderboard logic stays runtime-agnostic");
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
  for (const file of ["../app/lib/kingz-affiliate.ts", "../app/lib/leaderboards.ts"]) {
    const text = await readFile(new URL(file, import.meta.url), "utf8");
    const calls = [...text.matchAll(/\bfetch\(/g)].length;
    const declared = [...text.matchAll(/next: \{ revalidate: \d+ \}/g)].length;
    assert.equal(declared, calls, `${file}: ${calls} fetch calls but ${declared} revalidates`);
  }

  // Module-level caches are per-instance on serverless: two visitors routed to
  // different lambdas would see different standings, unpurgeable.
  const affiliate = await readFile(
    new URL("../app/lib/kingz-affiliate.ts", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(affiliate, /^(let|const) cache\b/m, "no module-level cache");
});



test("the leaderboard has its own page, and old raffle links land on it", async () => {
  const html = await htmlFor("/leaderboard");

  assert.match(html, literal(poolText), "pool is rendered");
  assert.match(html, literal(`${periodName(primaryBoard)} Leaderboard`));
  assert.match(html, literal(primaryBoard.logo), "partner logo is shown");
  assert.match(html, literal(primaryBoard.url), "referral link is used");
  assert.match(html, /Player names are masked/i);

  // Masking only the rendered text is not enough: the standings are props to
  // a client component, so a raw name would still ship in the RSC payload.
  const leaderboards = await readFile(new URL("../app/lib/leaderboards.ts", import.meta.url), "utf8");
  assert.match(leaderboards, /name: maskedName\(entry\.name\)/, "names are masked server-side");

  // /raffle was the previous home of the prize pool; its links must not 404.
  const redirect = await fetch(`${BASE_URL}/raffle`, { redirect: "manual" });
  assert.ok(
    [301, 308].includes(redirect.status),
    `/raffle should redirect permanently, got ${redirect.status}`,
  );
  assert.match(redirect.headers.get("location") ?? "", /\/leaderboard$/);
});

test("the advertised pool is exactly what the ladder pays", async () => {
  for (const board of boards) {
    const laddered = board.prizes.reduce((sum, prize) => sum + prize, 0);
    assert.equal(
      `$${laddered.toLocaleString("en-US")}`,
      board.pool,
      `${board.name} advertises ${board.pool} but the ladder pays $${laddered}`,
    );

    // A ladder paying a lower place more than a higher one is always a typo.
    for (let i = 1; i < board.prizes.length; i += 1) {
      assert.ok(
        board.prizes[i] <= board.prizes[i - 1],
        `${board.name}: place ${i + 1} pays $${board.prizes[i]}, more than place ${i}`,
      );
    }
  }
});

test("the Kingz key stays server-side and never ships committed", async () => {
  const client = await readFile(
    new URL("../app/lib/kingz-affiliate.ts", import.meta.url),
    "utf8",
  );

  assert.match(client, /https:\/\/leaderboard\.kingz\.win\/v1\/external\/affiliates/);
  assert.match(client, /env\("KINGZ_API_KEY"\)/, "the key is read from the environment");
  assert.doesNotMatch(client, /NEXT_PUBLIC_/, "the key must never reach the client bundle");
  // The key rides in the query string, so logging the URL would leak it.
  assert.doesNotMatch(client, /console\.\w+\([^)]*\burl\b/, "the request URL is never logged");
  // The feed is raw and includes our own account, so it must be filterable.
  assert.match(client, /KINGZ_EXCLUDE_USERNAMES/);

  const example = await readFile(new URL("../.env.example", import.meta.url), "utf8");
  assert.match(example, /^KINGZ_API_KEY=$/m, "the example ships the name, not a value");
  assert.doesNotMatch(example, /^\s*[A-Z_][A-Z0-9_]*=.+$/m, "no committed values");
  assert.doesNotMatch(example, /DICEY/, "retired partner's config is gone");
});

test("the race runs 30 days from 27 September, then repeats", async () => {
  const { periodWindow } = await import("../app/lib/race-period.ts");
  const iso = (ms) => new Date(ms).toISOString().slice(0, 10);

  const first = periodWindow(Date.UTC(2026, 8, 27, 12), "30day");
  assert.equal(iso(first.start), "2026-09-27");
  assert.equal(iso(first.end), "2026-10-27", "the countdown ends 30 days after the start");

  // The next race picks up exactly where the last ended, with no gap.
  const second = periodWindow(Date.UTC(2026, 9, 27, 0, 0, 1), "30day");
  assert.equal(second.start, first.end);
  assert.equal(iso(second.end), "2026-11-26");

  assert.equal(primaryBoard.period, "30day");
});
