import type { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  const base =
    process.env.NEXT_PUBLIC_SITE_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');

  const now = new Date();
  // Only the durable, public pages. /duel/* and /me are excluded by robots.ts
  // (transient or personalised).
  return [
    { url: `${base}/`, lastModified: now, changeFrequency: 'weekly', priority: 1.0 },
    { url: `${base}/leaderboard`, lastModified: now, changeFrequency: 'hourly', priority: 0.8 },
    { url: `${base}/auth`, lastModified: now, changeFrequency: 'monthly', priority: 0.4 },
  ];
}
