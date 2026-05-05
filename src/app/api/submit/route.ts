import { NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { rateLimit, clientKey } from '@/lib/rateLimit';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const MAX_CODE_LEN = 50000;

export async function POST(req: Request) {
  const limit = rateLimit(clientKey(req, 'submit'), {
    capacity: 5,
    refillPerSecond: 0.5,
  });
  if (!limit.allowed) {
    return NextResponse.json({ error: 'Rate limit' }, { status: 429 });
  }

  let body: { duel_id?: unknown; player_id?: unknown; code?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  const { duel_id, player_id, code } = body;
  if (typeof duel_id !== 'string' || typeof player_id !== 'string') {
    return NextResponse.json(
      { error: 'duel_id and player_id required' },
      { status: 400 },
    );
  }
  if (typeof code !== 'string') {
    return NextResponse.json({ error: 'code must be a string' }, { status: 400 });
  }
  const safeCode = code.slice(0, MAX_CODE_LEN);

  const sb = getAdminClient();
  const { data: duel } = await sb
    .from('duels')
    .select('player1_id, player2_id, status')
    .eq('id', duel_id)
    .single();
  if (!duel) {
    return NextResponse.json({ error: 'duel not found' }, { status: 404 });
  }
  if (duel.player1_id !== player_id && duel.player2_id !== player_id) {
    return NextResponse.json({ error: 'not in this duel' }, { status: 403 });
  }
  // Submissions are accepted while active or judging — auto-submit on time-up
  // and force-finalize race may both write here.
  if (duel.status !== 'active' && duel.status !== 'judging') {
    return NextResponse.json(
      { error: `cannot submit while duel is ${duel.status}` },
      { status: 409 },
    );
  }

  const { error } = await sb.from('submissions').upsert(
    {
      duel_id,
      player_id,
      code: safeCode,
      submitted_at: new Date().toISOString(),
    },
    { onConflict: 'duel_id,player_id' },
  );
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
