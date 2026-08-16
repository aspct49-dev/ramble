import { NextResponse } from "next/server";

/**
 * Resolves Kick usernames to profile picture URLs.
 *
 * Uses Kick's official API, because the one their own site uses is closed to
 * us from both sides: kick.com/api/v2/channels sends no CORS headers, and
 * Cloudflare blocks non-browser TLS fingerprints there — a browser
 * navigation to it is refused too, so this is not something a proxy can fix.
 * api.kick.com is reachable from a server and answers with a bearer token.
 *
 * Requires KICK_CLIENT_ID and KICK_CLIENT_SECRET from a Kick developer app.
 * Without them this returns an empty map and the picker falls back to its
 * colour-initial tiles, which is a degraded look rather than a broken page.
 */
const TOKEN_URL = "https://id.kick.com/oauth/token";
const CHANNELS_URL = "https://api.kick.com/public/v1/channels";

/** Kick caps the batch; keep well under it and under our own render count. */
const MAX_NAMES = 24;

type Token = { value: string; expiresAt: number };
let token: Token | null = null;

/**
 * App access token, cached until shortly before it expires.
 *
 * A module-level cache is per-instance on serverless, which is the wrong
 * choice for data but the right one here: a token is interchangeable, so a
 * second instance simply mints its own.
 */
async function getToken(): Promise<string | null> {
  const clientId = process.env.KICK_CLIENT_ID?.trim();
  const clientSecret = process.env.KICK_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) return null;

  if (token && Date.now() < token.expiresAt) return token.value;

  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: clientId,
      client_secret: clientSecret,
    }),
    cache: "no-store",
  });
  if (!response.ok) {
    console.error("Kick token request failed:", response.status);
    return null;
  }

  const data = (await response.json()) as { access_token?: string; expires_in?: number };
  if (!data.access_token) return null;

  token = {
    value: data.access_token,
    // Renew a minute early so a request never races the expiry.
    expiresAt: Date.now() + Math.max(60, (data.expires_in ?? 3600) - 60) * 1000,
  };
  return token.value;
}

export async function POST(request: Request) {
  let names: string[] = [];
  try {
    const body = (await request.json()) as { usernames?: unknown };
    if (Array.isArray(body.usernames)) {
      names = body.usernames
        .filter((n): n is string => typeof n === "string")
        .map((n) => n.trim().toLowerCase())
        // Validated before being put in an outbound query string.
        .filter((n) => /^[a-z0-9_-]{1,32}$/.test(n))
        .slice(0, MAX_NAMES);
    }
  } catch {
    return NextResponse.json({ avatars: {} });
  }
  if (names.length === 0) return NextResponse.json({ avatars: {} });

  const bearer = await getToken();
  // Not configured is a normal state, not an error: the picker still works,
  // it just shows initials.
  if (!bearer) return NextResponse.json({ avatars: {}, configured: false });

  try {
    const url = new URL(CHANNELS_URL);
    for (const name of names) url.searchParams.append("slug", name);

    const response = await fetch(url, {
      headers: { authorization: `Bearer ${bearer}`, accept: "application/json" },
      next: { revalidate: 600 },
    });
    if (!response.ok) {
      // A stale token is the likely cause; drop it so the next call re-mints.
      if (response.status === 401) token = null;
      console.error("Kick channels lookup failed:", response.status);
      return NextResponse.json({ avatars: {} });
    }

    const payload = (await response.json()) as {
      data?: Array<{ slug?: string; banner_picture?: string; user?: { profile_picture?: string } }>;
    };

    const avatars: Record<string, string> = {};
    for (const channel of payload.data ?? []) {
      const slug = channel.slug?.toLowerCase();
      const picture = channel.user?.profile_picture;
      if (slug && picture) avatars[slug] = picture;
    }
    return NextResponse.json({ avatars, configured: true });
  } catch (error) {
    console.error("Kick avatar lookup failed:", error);
    return NextResponse.json({ avatars: {} });
  }
}
