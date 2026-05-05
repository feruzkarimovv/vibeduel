import { NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const CACHE_TTL_MS = 30_000;
let cached: { value: { active: number }; expiresAt: number } | null = null;

export async function GET() {
  if (cached && cached.expiresAt > Date.now()) {
    return NextResponse.json(cached.value);
  }

  const sb = getAdminClient();
  const { count } = await sb
    .from('duels')
    .select('id', { count: 'exact', head: true })
    .in('status', ['countdown', 'active']);

  const value = { active: count ?? 0 };
  cached = { value, expiresAt: Date.now() + CACHE_TTL_MS };
  return NextResponse.json(value);
}
