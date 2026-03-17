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

export const metadata: Metadata = {
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
  icons: {
    icon: '/favicon.ico',
  },
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
