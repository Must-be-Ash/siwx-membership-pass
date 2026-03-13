import type { Metadata } from "next";
import { Geist_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Membership Pass | NFT-Gated Free Access via x402",
  description:
    "A payment-gated API using x402 and SIWX where NFT holders get free access. Hold a membership pass NFT on Base and skip payment entirely.",
  metadataBase: new URL("https://siwx-membership-pass.vercel.app"),
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
  },
  manifest: "/site.webmanifest",
  openGraph: {
    title: "Membership Pass | NFT-Gated Free Access via x402",
    description:
      "A payment-gated API using x402 and SIWX where NFT holders get free access. Hold a membership pass NFT on Base and skip payment entirely.",
    type: "website",
    url: "https://siwx-membership-pass.vercel.app",
    images: [
      {
        url: "https://siwx-membership-pass.vercel.app/og.png",
        width: 1200,
        height: 630,
        alt: "Membership Pass",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Membership Pass | NFT-Gated Free Access via x402",
    description:
      "A payment-gated API using x402 and SIWX where NFT holders get free access. Hold a membership pass NFT on Base and skip payment entirely.",
    images: ["https://siwx-membership-pass.vercel.app/og.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Jersey+25&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className={geistMono.variable}>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
