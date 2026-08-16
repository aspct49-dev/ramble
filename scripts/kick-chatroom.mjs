/**
 * Prints the Kick chatroom id for a channel, for app/data.ts.
 *
 *   pnpm kick:chatroom [slug]
 *
 * Shells out to curl on purpose. Cloudflare fingerprints the TLS handshake,
 * so Node's own fetch gets a 403 from kick.com regardless of headers, while
 * curl's handshake passes. This is also why the id is configured in data.ts
 * rather than resolved at runtime — neither the server nor the browser can
 * read that endpoint.
 */
import { execFileSync } from "node:child_process";

const slug = (process.argv[2] ?? "ramblegamble").trim().toLowerCase();

if (!/^[a-z0-9_-]{1,32}$/.test(slug)) {
  console.error(`Not a Kick channel slug: ${slug}`);
  process.exit(1);
}

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

let body;
try {
  body = execFileSync(
    "curl",
    ["-sS", "-H", "Accept: application/json", "-H", `User-Agent: ${UA}`,
     `https://kick.com/api/v2/channels/${slug}`],
    { encoding: "utf8", timeout: 20000 },
  );
} catch (error) {
  console.error("curl failed — is it on PATH?");
  console.error(String(error).slice(0, 300));
  process.exit(1);
}

let data;
try {
  data = JSON.parse(body);
} catch {
  console.error("Kick did not return JSON. First 200 bytes:");
  console.error(body.slice(0, 200));
  process.exit(1);
}

const chatroomId = data?.chatroom?.id;
if (!chatroomId) {
  console.error(`No chatroom found for "${slug}".`);
  process.exit(1);
}

console.log(`channel:     ${data.slug ?? slug}`);
console.log(`chatroom id: ${chatroomId}`);
console.log(`live:        ${data.livestream ? "yes" : "no"}`);
console.log(`\nSet in app/data.ts:  export const KICK_CHATROOM_ID = ${chatroomId};`);
