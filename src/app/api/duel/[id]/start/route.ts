import { NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { rateLimit, clientKey } from '@/lib/rateLimit';

export async function POST(
  req: Request,
  { params }: { params: { id: string } },
) {
  const limit = rateLimit(clientKey(req, 'duel-start'), {
    capacity: 5,
    refillPerSecond: 0.5,
  });
  if (!limit.allowed) {
    return NextResponse.json({ error: 'Rate limit' }, { status: 429 });
  }

  let body: { player_id?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  const { player_id } = body;
  if (typeof player_id !== 'string' || !player_id) {
    return NextResponse.json({ error: 'player_id required' }, { status: 400 });
  }

  const sb = getAdminClient();
  // Atomic transition: countdown → active. Only the duel's actual players can
  // trigger it. Idempotent: if already active, returns the current state.
  const { data: duel } = await sb
    .from('duels')
    .select('player1_id, player2_id, status')
    .eq('id', params.id)
    .single();
  if (!duel) {
    return NextResponse.json({ error: 'duel not found' }, { status: 404 });
  }
  if (duel.player1_id !== player_id && duel.player2_id !== player_id) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  if (duel.status === 'active' || duel.status === 'judging' || duel.status === 'complete') {
    return NextResponse.json({ ok: true });
  }

  const { error } = await sb
    .from('duels')
    .update({ status: 'active', started_at: new Date().toISOString() })
    .eq('id', params.id)
    .eq('status', 'countdown');
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
