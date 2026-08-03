// Absolute origin for canonical URLs, OG tags, robots.txt and sitemap.xml.
//
// Vercel 308-redirects the apex to www, so www is the host that actually
// serves the site. Canonical tags must name it exactly — pointing them at the
// apex would canonicalise every page to a URL that immediately redirects.
const PRODUCTION_ORIGIN = "https://www.ramblespins.com";

/**
 * Deliberately NOT derived from VERCEL_PROJECT_PRODUCTION_URL.
 *
 * That variable is documented as the shortest production custom domain, but it
 * kept resolving to the project's *.vercel.app hostname after ramblespins.com
 * was attached — which shipped a live site whose canonical, og:url and
 * og:image all credited ramble-delta-five.vercel.app. The production domain is
 * stable, so it is pinned here and SITE_URL remains the escape hatch.
 */
function normalise(value: string | undefined, bareHostname = false): string | null {
  const raw = value?.trim();
  if (!raw) return null;

  // VERCEL_URL is a bare hostname ("foo.vercel.app"), not a URL.
  const candidate = bareHostname && !/^https?:\/\//i.test(raw) ? `https://${raw}` : raw;

  try {
    const url = new URL(candidate);
    const scheme = url.protocol === "https:" || url.protocol === "http:";
    if (scheme && !url.username && !url.password) return url.origin;
  } catch {
    // Fall through to the next candidate.
  }
  return null;
}

/** True on Vercel preview and local builds — anything not the live site. */
export function isPreviewDeployment(): boolean {
  const environment = process.env.VERCEL_ENV;
  return Boolean(environment) && environment !== "production";
}

export function requestOrigin(): string {
  return (
    // An explicit override always wins, e.g. when the domain moves.
    normalise(process.env.SITE_URL) ??
    // A preview build should describe itself, not claim to be production.
    (isPreviewDeployment() ? normalise(process.env.VERCEL_URL, true) : null) ??
    PRODUCTION_ORIGIN
  );
}
