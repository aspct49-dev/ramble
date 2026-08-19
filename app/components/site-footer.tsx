import Link from "next/link";
import { FaDiscord } from "react-icons/fa";
import { FaXTwitter } from "react-icons/fa6";
import { SiKick } from "react-icons/si";
import { primaryBoard, brand, socials } from "../data";

const socialList = [
  { href: socials.kick, label: "Kick", Icon: SiKick },
  { href: socials.x, label: "X / Twitter", Icon: FaXTwitter },
  { href: socials.discord, label: "Discord", Icon: FaDiscord },
];

const socialCards = [
  { href: socials.kick, name: "Kick", blurb: "Watch live streams", action: "Watch", Icon: SiKick },
  { href: socials.x, name: "X / Twitter", blurb: "Stay in touch", action: "Follow", Icon: FaXTwitter },
  { href: socials.discord, name: "Discord", blurb: "Join the community", action: "Join", Icon: FaDiscord },
];

function SocialLinks({ footer = false }: { footer?: boolean }) {
  return (
    <div className={footer ? "footerSocialLinks" : "socialLinkList"}>
      {socialList.map(({ href, label, Icon }) => (
        <a
          href={href}
          key={label}
          target="_blank"
          rel="noreferrer"
          aria-label={`Follow ${brand.name} on ${label}`}
        >
          <Icon aria-hidden="true" focusable="false" />
          <span>{label}</span>
        </a>
      ))}
    </div>
  );
}

export function SiteFooter() {
  const board = primaryBoard;

  return (
    <>
      <div className="band bandNight bandSocials">
        <section className="socialBand" aria-labelledby="social-band-title">
          <div className="socialBandInner">
            <div className="centerHeading" data-reveal="heading">
              <h2 id="social-band-title">Keep Up With {brand.name}</h2>
            </div>

            <div className="socialCards">
              {socialCards.map(({ href, name, blurb, action, Icon }) => (
                <article className="socialCard" data-reveal="card" key={name}>
                  <span className="socialCardIcon" aria-hidden="true"><Icon /></span>
                  <h3>{name}</h3>
                  <p>{blurb}</p>
                  <a
                    className="perkAction socialCardAction"
                    href={href}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={`${action} ${brand.name} on ${name}`}
                  >
                    {action}
                  </a>
                </article>
              ))}
            </div>
          </div>
        </section>
      </div>

      <div className="band bandFooter">
        <footer className="siteFooter">
          <div className="footerGrid">
            <div className="footerBrandCol">
              <Link className="footerBrand" href="/" aria-label={`${brand.name} home`}>
                <img src={brand.wordmark} alt={brand.name} />
              </Link>
              <p>
                The official home of the {brand.name} bi-weekly {primaryBoard.name} leaderboard,
                rewards, and live streams.
              </p>
            </div>

            <div className="footerCol">
              <span>Navigate</span>
              <Link href="/">Home</Link>
              <Link href="/raffle">Raffle</Link>
              <Link href="/wheel">Wheel</Link>
              <Link href="/#rewards">Rewards</Link>
              <Link href="/#stream">Stream</Link>
            </div>

            <div className="footerCol">
              <span>Partners</span>
              <a href={board.url} target="_blank" rel="noreferrer">
                {board.name} - code {board.code}
              </a>
            </div>

            <div className="footerCol footerSocialCol">
              <span>Socials</span>
              <SocialLinks footer />
            </div>
          </div>

          <div className="footerNotice">
            <span className="agePill">18+</span>
            <p>
              Play responsibly. Gambling can be addictive - always play within your limits and
              never wager more than you can afford to lose. Visit{" "}
              <a href="https://www.begambleaware.org" target="_blank" rel="noreferrer">
                BeGambleAware.org
              </a>{" "}
              for support. You must be 18+ or the legal age in your jurisdiction to participate.
            </p>
          </div>

          <p className="footerDisclaimer">
            {brand.name} is an independent affiliate and is not owned or operated by its partners.
            We may earn a commission when you sign up or play using code {board.code}. Nothing here
            is a guarantee of winnings; gambling involves real financial risk.
          </p>

          <div className="footerBottom">
            <span>&copy; 2026 {brand.name}. All rights reserved.</span>
            <a href={socials.kick} target="_blank" rel="noreferrer">Watch live on Kick</a>
          </div>
        </footer>
      </div>
    </>
  );
}
