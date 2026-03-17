import { SupabaseClient } from '@supabase/supabase-js';
import type { DuelRow } from '@/types';

export async function findOrCreateDuel(
  supabase: SupabaseClient,
  playerId: string,
  challengeId: string,
): Promise<DuelRow | null> {
  // Try to find an existing waiting duel (not our own)
  const { data: existingDuel } = await supabase
    .from('duels')
    .select('*')
    .eq('status', 'waiting')
    .neq('player1_id', playerId)
    .limit(1)
    .single();

  if (existingDuel) {
    // Join as player 2 and move to countdown
    const { data } = await supabase
      .from('duels')
      .update({
        player2_id: playerId,
        status: 'countdown',
      })
      .eq('id', existingDuel.id)
      .eq('status', 'waiting') // optimistic lock
      .select()
      .single();

    return data as DuelRow | null;
  }

  // No waiting duels — create a new one
  const { data, error } = await supabase
    .from('duels')
    .insert({
      challenge_id: challengeId,
      player1_id: playerId,
      status: 'waiting',
    })
    .select()
    .single();

  if (error) {
    console.error('Failed to create duel:', error.message);
    return null;
  }

  return data as DuelRow;
}

export async function cancelDuel(
  supabase: SupabaseClient,
  duelId: string,
): Promise<void> {
  await supabase.from('duels').delete().eq('id', duelId).eq('status', 'waiting');
}

export async function fetchDuel(
  supabase: SupabaseClient,
  duelId: string,
): Promise<DuelRow | null> {
  const { data } = await supabase
    .from('duels')
    .select('*')
    .eq('id', duelId)
    .single();

  return data as DuelRow | null;
}

export async function fetchDuelPlayers(
  supabase: SupabaseClient,
  duel: DuelRow,
): Promise<{ player1: import('@/types').Player | null; player2: import('@/types').Player | null }> {
  const ids = [duel.player1_id, duel.player2_id].filter(Boolean) as string[];

  const { data } = await supabase
    .from('players')
    .select('*')
    .in('id', ids);

  const players = (data ?? []) as import('@/types').Player[];

  return {
    player1: players.find((p) => p.id === duel.player1_id) ?? null,
    player2: duel.player2_id
      ? players.find((p) => p.id === duel.player2_id) ?? null
      : null,
  };
}
