import type { Metadata, Viewport } from "next";
import { AFFILIATE_CODE, brand, socials } from "./data";
import { SiteFooter } from "./components/site-footer";
import { SiteHeader } from "./components/site-header";
import { SplashScreen } from "./components/splash-screen";
import { requestOrigin } from "./lib/request-origin";
import "./globals.css";

const title = `${brand.name} | Bi-Weekly Leaderboard and Rewards`;
const description =
  `Join ${brand.name}'s $5,000 bi-weekly Dicey leaderboard under code ${AFFILIATE_CODE}, claim a 100% deposit match up to $5,000, 15% lossback and monthly wager prizes.`;

export async function generateMetadata(): Promise<Metadata> {
  const origin = requestOrigin();

  return {
    metadataBase: new URL(origin),
    title: {
      default: title,
      template: `%s | ${brand.name}`,
    },
    description,
    applicationName: brand.name,
    keywords: [
      brand.name,
      `${brand.name} leaderboard`,
      `${brand.name} Kick`,
      "bi-weekly leaderboard",
      "Dicey",
      `Dicey code ${AFFILIATE_CODE}`,
      "deposit match",
      "lossback",
      "wager prizes",
      "Kick stream",
    ],
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        "max-image-preview": "large",
        "max-snippet": -1,
      },
    },
    icons: {
      icon: [
        { url: "/favicon.ico", sizes: "any" },
        { url: "/icon-32.png", sizes: "32x32", type: "image/png" },
        { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
        { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
      ],
      shortcut: "/favicon.ico",
      apple: "/apple-touch-icon.png",
    },
    manifest: "/site.webmanifest",
    openGraph: {
      type: "website",
      locale: "en_US",
      title,
      description,
      siteName: brand.name,
      url: origin,
      images: [
        {
          url: `${origin}/og.png`,
          width: 1200,
          height: 630,
          alt: `${brand.name} $5,000 bi-weekly Dicey leaderboard`,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [`${origin}/og.png`],
    },
  };
}

export const viewport: Viewport = {
  themeColor: "#0B1430",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const origin = requestOrigin();
  const structuredData = [
    {
      "@context": "https://schema.org",
      "@type": "Organization",
      name: brand.name,
      url: origin,
      logo: `${origin}${brand.wordmark}`,
      sameAs: [socials.kick, socials.x, socials.discord],
    },
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: brand.name,
      url: origin,
      description,
    },
  ];
  const structuredDataJson = JSON.stringify(structuredData).replace(
    /</g,
    "\\u003c",
  );

  return (
    // `data-scroll-behavior` tells Next the smooth scrolling in globals.css is
    // deliberate, so it suppresses it during route transitions rather than
    // animating the jump between pages.
    <html lang="en" data-scroll-behavior="smooth">
      <body className="antialiased">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: structuredDataJson }}
        />
        <SplashScreen />
        <SiteHeader />
        <div className="appMain">
          {children}
          <SiteFooter />
        </div>
      </body>
    </html>
  );
}
