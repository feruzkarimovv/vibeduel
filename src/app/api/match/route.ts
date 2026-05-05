import { NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { rateLimit, clientKey } from '@/lib/rateLimit';
import { getChallengeById } from '@/lib/challenges';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const STALE_DUEL_AGE_SECONDS = 120;

export async function POST(req: Request) {
  const limit = rateLimit(clientKey(req, 'match'), {
    capacity: 5,
    refillPerSecond: 0.2, // 1 every 5s
  });
  if (!limit.allowed) {
    return NextResponse.json(
      { error: 'Rate limit exceeded' },
      { status: 429, headers: { 'Retry-After': String(limit.retryAfterSeconds) } },
    );
  }

  let body: { player_id?: unknown; challenge_id?: unknown; private?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { player_id, challenge_id } = body;
  const wantPrivate = body.private === true;

  if (typeof player_id !== 'string' || !player_id) {
    return NextResponse.json({ error: 'player_id required' }, { status: 400 });
  }
  if (typeof challenge_id !== 'string' || !getChallengeById(challenge_id)) {
    return NextResponse.json({ error: 'invalid challenge_id' }, { status: 400 });
  }

  const sb = getAdminClient();

  // Verify the player exists.
  const { data: player } = await sb
    .from('players')
    .select('id')
    .eq('id', player_id)
    .single();
  if (!player) {
    return NextResponse.json({ error: 'player not found' }, { status: 404 });
  }

  // Cleanup stale waiting duels (M-6) — anything older than 2 minutes.
  const cutoff = new Date(Date.now() - STALE_DUEL_AGE_SECONDS * 1000).toISOString();
  await sb
    .from('duels')
    .delete()
    .eq('status', 'waiting')
    .lt('created_at', cutoff);

  if (wantPrivate) {
    const { data: created, error } = await sb
      .from('duels')
      .insert({
        challenge_id,
        player1_id: player_id,
        status: 'waiting',
        invited_only: true,
      })
      .select()
      .single();
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ duel: created, isNew: true });
  }

  // Try to claim a public waiting duel atomically.
  // Step 1: find candidate (not our own).
  const { data: candidates } = await sb
    .from('duels')
    .select('id')
    .eq('status', 'waiting')
    .eq('invited_only', false)
    .neq('player1_id', player_id)
    .limit(1);

  if (candidates && candidates.length > 0) {
    const candidate = candidates[0];
    const { data: claimed } = await sb
      .from('duels')
      .update({ player2_id: player_id, status: 'countdown' })
      .eq('id', candidate.id)
      .eq('status', 'waiting')
      .is('player2_id', null)
      .select()
      .single();
    if (claimed) {
      return NextResponse.json({ duel: claimed, isNew: false });
    }
    // Lost the race — fall through to create our own.
  }

  // Create new public waiting duel.
  const { data: created, error } = await sb
    .from('duels')
    .insert({
      challenge_id,
      player1_id: player_id,
      status: 'waiting',
      invited_only: false,
    })
    .select()
    .single();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ duel: created, isNew: true });
}
