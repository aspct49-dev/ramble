// Absolute origin for canonical URLs, OG tags, robots.txt and sitemap.xml.
//
// Vercel exposes the deployment's own hostnames, so a deploy is correct with
// no configuration at all. SITE_URL still wins, since a custom domain should
// beat the *.vercel.app one in canonical tags.
const DEFAULT_SITE_ORIGIN = "https://ramblegamble.example";

function normalise(value: string | undefined, bareHostname = false): string | null {
  const raw = value?.trim();
  if (!raw) return null;

  // Vercel's system vars are bare hostnames ("foo.vercel.app"), not URLs.
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

export function requestOrigin(): string {
  return (
    // An explicitly configured production domain always wins.
    normalise(process.env.SITE_URL) ??
    // The project's stable production domain — the custom domain once one is
    // attached, otherwise <project>.vercel.app. Correct for canonical tags.
    normalise(process.env.VERCEL_PROJECT_PRODUCTION_URL, true) ??
    // Per-deployment URL. Only reached on previews, where a preview-specific
    // canonical beats pointing at a domain this build isn't serving.
    normalise(process.env.VERCEL_URL, true) ??
    DEFAULT_SITE_ORIGIN
  );
}
