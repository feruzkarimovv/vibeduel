import { SupabaseClient } from '@supabase/supabase-js';
import type { DuelRow, Player } from '@/types';

// Matchmaking now goes through server routes that use the service_role key.
// The client only does SELECT operations directly.

export async function findOrCreateDuel(
  _supabase: SupabaseClient,
  playerId: string,
  challengeId: string,
  options?: { private?: boolean },
): Promise<DuelRow | null> {
  const res = await fetch('/api/match', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      player_id: playerId,
      challenge_id: challengeId,
      private: options?.private ?? false,
    }),
  });
  if (!res.ok) {
    console.error('findOrCreateDuel failed:', res.status, await res.text().catch(() => ''));
    return null;
  }
  const { duel } = await res.json();
  return duel as DuelRow;
}

export async function joinDuelById(
  playerId: string,
  duelId: string,
): Promise<DuelRow | null> {
  const res = await fetch('/api/match/join', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ player_id: playerId, duel_id: duelId }),
  });
  if (!res.ok) return null;
  const { duel } = await res.json();
  return duel as DuelRow;
}

export async function cancelDuel(
  _supabase: SupabaseClient,
  duelId: string,
  playerId: string,
): Promise<void> {
  await fetch('/api/match/cancel', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ duel_id: duelId, player_id: playerId }),
  });
}

export async function fetchDuel(
  supabase: SupabaseClient,
  duelId: string,
): Promise<DuelRow | null> {
  const { data } = await supabase
    .from('duels')
    .select('*')
    .eq('id', duelId)
    .maybeSingle();
  return data as DuelRow | null;
}

export async function fetchDuelPlayers(
  supabase: SupabaseClient,
  duel: DuelRow,
): Promise<{ player1: Player | null; player2: Player | null }> {
  const ids = [duel.player1_id, duel.player2_id].filter(Boolean) as string[];

  const { data } = await supabase
    .from('players')
    .select('*')
    .in('id', ids);

  const players = (data ?? []) as Player[];

  return {
    player1: players.find((p) => p.id === duel.player1_id) ?? null,
    player2: duel.player2_id
      ? players.find((p) => p.id === duel.player2_id) ?? null
      : null,
  };
}
