import { NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { rateLimit, clientKey } from '@/lib/rateLimit';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Bind an authenticated user to a player row.
// - If a player is already bound to this auth_user_id, return it.
// - Else if guest_player_id is provided AND that player has no auth binding,
//   upgrade it (preserves their ELO/stats from guest play).
// - Else create a fresh player.
export async function POST(req: Request) {
  const limit = rateLimit(clientKey(req, 'player-bind'), {
    capacity: 5,
    refillPerSecond: 0.5,
  });
  if (!limit.allowed) {
    return NextResponse.json({ error: 'Rate limit' }, { status: 429 });
  }

  let body: {
    auth_user_id?: unknown;
    email?: unknown;
    guest_player_id?: unknown;
    fallback_username?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { auth_user_id, email, guest_player_id, fallback_username } = body;
  if (typeof auth_user_id !== 'string' || !auth_user_id) {
    return NextResponse.json({ error: 'auth_user_id required' }, { status: 400 });
  }

  const sb = getAdminClient();

  // Already bound?
  const { data: bound } = await sb
    .from('players')
    .select('*')
    .eq('auth_user_id', auth_user_id)
    .maybeSingle();
  if (bound) {
    return NextResponse.json({ player: bound });
  }

  // Try to upgrade guest
  if (typeof guest_player_id === 'string' && guest_player_id) {
    const { data: guest } = await sb
      .from('players')
      .select('*')
      .eq('id', guest_player_id)
      .is('auth_user_id', null)
      .maybeSingle();
    if (guest) {
      const { data: upgraded, error } = await sb
        .from('players')
        .update({
          auth_user_id,
          email: typeof email === 'string' ? email : null,
        })
        .eq('id', guest_player_id)
        .select()
        .single();
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      return NextResponse.json({ player: upgraded });
    }
  }

  // Create new
  const username =
    (typeof fallback_username === 'string' && fallback_username.trim()) ||
    'Player';
  const { data: created, error } = await sb
    .from('players')
    .insert({
      username,
      auth_user_id,
      email: typeof email === 'string' ? email : null,
    })
    .select()
    .single();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ player: created });
}
