import type { Metadata } from 'next';
import { Syne, Space_Mono } from 'next/font/google';
import './globals.css';

const syne = Syne({
  subsets: ['latin'],
  variable: '--font-syne',
  display: 'swap',
});

const spaceMono = Space_Mono({
  weight: ['400', '700'],
  subsets: ['latin'],
  variable: '--font-space-mono',
  display: 'swap',
});

// Resolves OG / Twitter image URLs to absolute. Vercel sets VERCEL_URL on
// every deploy; locally it falls back to localhost.
const baseUrl =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');

export const metadata: Metadata = {
  metadataBase: new URL(baseUrl),
  title: 'VibeDuel — The Competitive Arena for AI-Powered Coding',
  description:
    'Race head-to-head in timed coding challenges. Vibecode faster. Ship or get shipped.',
  keywords: ['vibecoding', 'coding duel', 'AI coding', 'competitive programming'],
  openGraph: {
    title: 'VibeDuel — Ship or Get Shipped',
    description:
      'The competitive arena for AI-powered coding. Race head-to-head in timed challenges.',
    siteName: 'VibeDuel',
    type: 'website',
    locale: 'en_US',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'VibeDuel — Ship or Get Shipped',
    description:
      'The competitive arena for AI-powered coding. Race head-to-head in timed challenges.',
  },
  // Icons (icon.tsx) and OG image (opengraph-image.tsx) are auto-detected
  // by Next.js from the app/ directory.
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${syne.variable} ${spaceMono.variable} font-sans antialiased bg-arena-black text-white`}
      >
        {children}
      </body>
    </html>
  );
}
