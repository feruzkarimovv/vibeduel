import { NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { rateLimit, clientKey } from '@/lib/rateLimit';

// Direct join: a player visits /duel/[id] (e.g. via shared invite link) and
// claims the open player2 slot for that specific duel.
export async function POST(req: Request) {
  const limit = rateLimit(clientKey(req, 'join'), {
    capacity: 5,
    refillPerSecond: 0.5,
  });
  if (!limit.allowed) {
    return NextResponse.json({ error: 'Rate limit' }, { status: 429 });
  }

  let body: { player_id?: unknown; duel_id?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  const { player_id, duel_id } = body;
  if (typeof player_id !== 'string' || typeof duel_id !== 'string') {
    return NextResponse.json(
      { error: 'player_id and duel_id required' },
      { status: 400 },
    );
  }

  const sb = getAdminClient();
  const { data: existing } = await sb
    .from('duels')
    .select('*')
    .eq('id', duel_id)
    .single();
  if (!existing) {
    return NextResponse.json({ error: 'duel not found' }, { status: 404 });
  }

  // Already in the duel — return as-is.
  if (existing.player1_id === player_id || existing.player2_id === player_id) {
    return NextResponse.json({ duel: existing });
  }

  if (existing.status !== 'waiting' || existing.player2_id) {
    return NextResponse.json({ error: 'duel is full or started' }, { status: 409 });
  }

  const { data: claimed, error } = await sb
    .from('duels')
    .update({ player2_id: player_id, status: 'countdown' })
    .eq('id', duel_id)
    .eq('status', 'waiting')
    .is('player2_id', null)
    .select()
    .single();
  if (error || !claimed) {
    return NextResponse.json({ error: 'failed to join (race)' }, { status: 409 });
  }
  return NextResponse.json({ duel: claimed });
}
