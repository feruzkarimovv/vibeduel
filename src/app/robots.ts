import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        // Don't index transient duel rooms / spectator URLs — they're 404 once
        // ended. Keep the lobby & profile pages out of search too; they're
        // personalised per visitor and not useful as search results.
        disallow: ['/duel/', '/me', '/auth'],
      },
    ],
  };
}
