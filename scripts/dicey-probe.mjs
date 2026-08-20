/**
 * Prints exactly what Dicey's affiliate API says when the raffle asks it for
 * wagering.
 *
 *   npm run dicey:probe
 *
 * The raffle renders "temporarily unavailable" for two completely different
 * reasons — credentials missing, or the call rejected — and in production both
 * happen inside a background revalidation where nobody reads the log. This
 * makes the same request app/lib/dicey-affiliate.ts makes and shows the status
 * and the body, so a wrong key, a wrong streamer id and a rejected window stop
 * looking identical.
 *
 * Reads .env.local so it can be run against the real credentials without
 * exporting them by hand. The key is never printed.
 *
 * On Windows, Node may print "Assertion failed: ... src\win\async.c" and exit
 * nonzero AFTER all output. That is a Node teardown bug, not a failed probe -
 * the report printed above it is the result.
 */
import { readFile } from "node:fs/promises";

const ENV_FILE = new URL("../.env.local", import.meta.url);

/** Minimal KEY=value reader — enough for the two names this needs. */
async function loadEnvLocal() {
  let text;
  try {
    text = await readFile(ENV_FILE, "utf8");
  } catch {
    return;
  }
  for (const line of text.split(/\r?\n/)) {
    const match = /^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/.exec(line);
    if (!match) continue;
    const value = match[2].trim().replace(/^["']|["']$/g, "");
    if (value && !process.env[match[1]]) process.env[match[1]] = value;
  }
}

await loadEnvLocal();

const key = process.env.DICEY_API_KEY?.trim();
const streamer = process.env.DICEY_STREAMER_ID?.trim();
const base = process.env.DICEY_API_BASE?.trim() || "https://api.dicey.com/v1";

if (!key || !streamer) {
  console.error("DICEY_API_KEY / DICEY_STREAMER_ID are not set.");
  console.error("Put them in .env.local, or export them, then run this again.");
  process.exit(1);
}

// Shown so a trailing newline or a pasted quote is visible as a length that
// does not match what the dashboard issued. The key itself stays secret.
console.log(`base        : ${base}`);
console.log(`streamer id : ${streamer}`);
console.log(`api key     : ${key.length} chars, ends ...${key.slice(-4)}`);

/** The window the site actually queries: the raffle so far, never the future. */
const { raffle } = await import("../app/data.ts");
const from = new Date(raffle.startsAt);
const to = new Date(Math.min(new Date(raffle.endsAt).getTime(), Date.now()));
console.log(`window      : ${from.toISOString()} -> ${to.toISOString()}`);
console.log(
  `span        : ${((to - from) / 86_400_000).toFixed(2)}d (their cap is 31d)\n`,
);

/**
 * Node keeps fetch's sockets pooled, and tearing that pool down implicitly at
 * exit trips a libuv assertion on Windows — printed after the output, which
 * reads like the probe failed when it did not. Closing it explicitly avoids
 * the whole thing.
 */
async function closeSockets() {
  const dispatcher = globalThis[Symbol.for("undici.globalDispatcher.1")];
  try {
    await dispatcher?.close?.();
  } catch {
    // Nothing to clean up, which is fine.
  }
}

async function attempt(label, { path, params, headers }) {
  const url = new URL(`${base}${path}`);
  for (const [name, value] of Object.entries(params)) url.searchParams.set(name, value);

  process.stdout.write(`${label}\n  GET ${url.pathname}${url.search}\n`);
  // An explicit controller rather than AbortSignal.timeout: the timer that
  // one creates outlives a completed request and trips a libuv assertion on
  // Windows as the process exits, right after the output you came for.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20_000);
  let response;
  try {
    response = await fetch(url, {
      headers: { accept: "application/json", ...headers },
      signal: controller.signal,
    });
  } catch (error) {
    console.log(`  NETWORK FAILURE: ${error.cause?.code ?? error.code ?? error.message}\n`);
    return false;
  } finally {
    clearTimeout(timer);
  }

  const body = await response.text().catch(() => "");
  console.log(`  ${response.status} ${response.statusText}  (${response.headers.get("content-type") ?? "no content-type"})`);
  console.log(`  ${body.slice(0, 700).trim() || "(empty body)"}\n`);

  if (!response.ok) return false;

  // Success is not just a 200 — the raffle empties just as silently when the
  // envelope parses to nothing, which is how it broke once already.
  try {
    const payload = JSON.parse(body);
    const entries = (payload.data ?? payload).entries ?? [];
    console.log(`  parsed ${entries.length} entries`);
    if (entries.length > 0) {
      console.log(`  first entry keys: ${Object.keys(entries[0]).join(", ")}`);
      const e = entries[0];
      // The three fields the raffle reads. A rename here empties the board
      // while every request still returns 200.
      for (const field of ["publicPseudoId", "username", "totalWageredUsd"]) {
        console.log(`    ${field}: ${field in e ? JSON.stringify(e[field]) : "*** MISSING ***"}`);
      }
    }
  } catch {
    console.log("  body is not JSON");
    return false;
  }
  console.log();
  return true;
}

const isoParams = {
  from: from.toISOString(),
  to: to.toISOString(),
  limit: "200",
  offset: "0",
};
const bearer = { authorization: `Bearer ${key}` };
const path = `/streamer-races/${streamer}/wagering`;

const ok = await attempt("[1] exactly what the site sends", {
  path,
  params: isoParams,
  headers: bearer,
});

if (ok) {
  console.log("The site's own request works. If /raffle is still empty, the");
  console.log("deployed build is stale or its env vars differ from these.");
  await closeSockets();
  process.exit(0);
}

console.log("--- that failed, so narrowing down what it dislikes ---\n");

// Each variant changes exactly one thing, so whichever succeeds names the
// cause rather than just producing a request that happens to work.
await attempt("[2] same call, date-only params (format?)", {
  path,
  params: { ...isoParams, from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) },
  headers: bearer,
});

await attempt("[3] same call, x-api-key instead of Bearer (auth scheme?)", {
  path,
  params: isoParams,
  headers: { "x-api-key": key },
});

await attempt("[4] no date filter at all (window rejected?)", {
  path,
  params: { limit: "200", offset: "0" },
  headers: bearer,
});

console.log("If [2], [3] or [4] returned 200, that one names the problem and");
console.log("app/lib/dicey-affiliate.ts should be changed to match it.");
console.log("If every attempt is 401/403, the key or the streamer id is wrong:");
console.log("the streamer id must be our own affiliate user id, or Dicey 403s.");

await closeSockets();
