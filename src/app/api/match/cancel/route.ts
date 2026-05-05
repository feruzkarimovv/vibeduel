import { NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { rateLimit, clientKey } from '@/lib/rateLimit';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: Request) {
  const limit = rateLimit(clientKey(req, 'cancel'), {
    capacity: 10,
    refillPerSecond: 1,
  });
  if (!limit.allowed) {
    return NextResponse.json({ error: 'Rate limit' }, { status: 429 });
  }

  let body: { duel_id?: unknown; player_id?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { duel_id, player_id } = body;
  if (typeof duel_id !== 'string' || typeof player_id !== 'string') {
    return NextResponse.json(
      { error: 'duel_id and player_id required' },
      { status: 400 },
    );
  }

  const sb = getAdminClient();
  // Only delete if the requesting player owns the duel and it's still waiting.
  const { error } = await sb
    .from('duels')
    .delete()
    .eq('id', duel_id)
    .eq('player1_id', player_id)
    .eq('status', 'waiting');

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
