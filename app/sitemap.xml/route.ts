import { requestOrigin } from "../lib/request-origin";

const routes = [
  { path: "/", priority: "1.0", changefreq: "daily" },
  { path: "/leaderboard", priority: "0.9", changefreq: "hourly" },
  { path: "/wheel", priority: "0.7", changefreq: "monthly" },
];

export async function GET() {
  const origin = requestOrigin();
  const lastmod = new Date().toISOString().slice(0, 10);
  const urls = routes
    .map(
      (route) =>
        `  <url>\n    <loc>${origin}${route.path}</loc>\n    <lastmod>${lastmod}</lastmod>\n    <changefreq>${route.changefreq}</changefreq>\n    <priority>${route.priority}</priority>\n  </url>`,
    )
    .join("\n");

  const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;

  return new Response(body, {
    headers: {
      "content-type": "application/xml; charset=utf-8",
      "cache-control": "public, max-age=3600",
    },
  });
}
