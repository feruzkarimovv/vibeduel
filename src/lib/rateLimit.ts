// In-memory token-bucket rate limiter scoped to a single Next.js process.
// For multi-instance deployments, swap this for Upstash / Vercel KV. For an
// MVP on a single Vercel function this is enough to make casual abuse
// expensive without adding infra.

type Bucket = { tokens: number; lastRefill: number };

const BUCKETS = new Map<string, Bucket>();

export type RateLimitConfig = {
  /** Total tokens the bucket holds when full */
  readonly capacity: number;
  /** Tokens added per second */
  readonly refillPerSecond: number;
};

export type RateLimitResult = {
  readonly allowed: boolean;
  readonly remaining: number;
  readonly retryAfterSeconds: number;
};

export function rateLimit(
  key: string,
  config: RateLimitConfig,
): RateLimitResult {
  const now = Date.now();
  let bucket = BUCKETS.get(key);
  if (!bucket) {
    bucket = { tokens: config.capacity, lastRefill: now };
    BUCKETS.set(key, bucket);
  }

  const elapsed = (now - bucket.lastRefill) / 1000;
  bucket.tokens = Math.min(
    config.capacity,
    bucket.tokens + elapsed * config.refillPerSecond,
  );
  bucket.lastRefill = now;

  if (bucket.tokens >= 1) {
    bucket.tokens -= 1;
    return {
      allowed: true,
      remaining: Math.floor(bucket.tokens),
      retryAfterSeconds: 0,
    };
  }

  const tokensNeeded = 1 - bucket.tokens;
  return {
    allowed: false,
    remaining: 0,
    retryAfterSeconds: Math.ceil(tokensNeeded / config.refillPerSecond),
  };
}

export function clientKey(req: Request, suffix: string): string {
  const fwd = req.headers.get('x-forwarded-for');
  const ip = (fwd ? fwd.split(',')[0] : '') || req.headers.get('x-real-ip') || 'anon';
  return `${ip.trim()}:${suffix}`;
}
