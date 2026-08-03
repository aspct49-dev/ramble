import { SiKick } from "react-icons/si";
import { brand, KICK_EMBED_URL, KICK_SLUG, socials } from "../data";

/**
 * Embedded Kick player.
 *
 * Deliberately no live/offline status fetch: Kick sits behind Cloudflare and
 * returns 403 to anything that isn't a real browser, so a server-side probe
 * would always fail, and a client-side one is blocked by CORS. The embed
 * already renders its own "<channel> is offline" card plus the last stream, so
 * it communicates state without us guessing at it.
 */
export function StreamSection() {
  return (
    <section className="streamSection" id="stream" aria-label={`${brand.name} live on Kick`}>
      <div className="centerHeading" data-reveal="heading">
        <h2>
          <span className="kickBadge" aria-hidden="true"><SiKick /></span>
          Kick <span className="headingAccent">Stream</span>
        </h2>
        <p className="underCode">Watch {brand.name} live at kick.com/{KICK_SLUG}</p>
      </div>

      <div className="streamFrame" data-reveal="section">
        <iframe
          src={KICK_EMBED_URL}
          title={`${brand.name} live stream on Kick`}
          allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
          allowFullScreen
          loading="lazy"
          referrerPolicy="strict-origin-when-cross-origin"
        />
      </div>

      <div className="streamActions">
        <a className="primaryAction" href={socials.kick} target="_blank" rel="noreferrer">
          Watch on Kick ↗
        </a>
        <a className="secondaryAction" href={socials.discord} target="_blank" rel="noreferrer">
          Join the Discord
        </a>
      </div>
    </section>
  );
}
