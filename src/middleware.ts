import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

// Keeps Supabase auth cookies fresh on every request. Without this, the
// session can expire mid-flight and `server.ts` ends up reading stale cookies.
export async function middleware(req: NextRequest) {
  const res = NextResponse.next({ request: req });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return res;

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return req.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          res.cookies.set(name, value, options);
        });
      },
    },
  });

  // Touching getUser() triggers the SSR helper to refresh tokens if needed
  // and write the rotated cookies back onto `res`.
  await supabase.auth.getUser();
  return res;
}

export const config = {
  // Skip static assets and noisy polling routes — no auth needed there.
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|api/stats|.*\\.(?:svg|png|jpg|jpeg|gif|webp|woff2?)$).*)',
  ],
};
