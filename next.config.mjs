/** @type {import('next').NextConfig} */
const securityHeaders = [
  // Disallow embedding the app in iframes (clickjacking).
  { key: 'X-Frame-Options', value: 'DENY' },
  // Stop browsers from sniffing content-type away from declared values.
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  // Send a short referrer for cross-origin navigation; full path stays
  // inside the same origin.
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  // No camera / mic / geolocation needed; turn them off everywhere.
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
  },
];

const nextConfig = {
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
};

export default nextConfig;
