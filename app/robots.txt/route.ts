import { isPreviewDeployment, requestOrigin } from "../lib/request-origin";

export async function GET() {
  const origin = requestOrigin();

  // A preview deploy turns crawlers away outright. The noindex meta tag only
  // helps on pages a crawler already fetched; this stops the fetch.
  const body = isPreviewDeployment()
    ? ["User-agent: *", "Disallow: /", ""].join("\n")
    : ["User-agent: *", "Allow: /", "", `Sitemap: ${origin}/sitemap.xml`, ""].join("\n");

  return new Response(body, {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "public, max-age=3600",
    },
  });
}
