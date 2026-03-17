import type { SupabaseClient } from '@supabase/supabase-js';
import type { Challenge } from '@/types';

export type ScoreBreakdown = {
  readonly functionality: number;
  readonly visual_design: number;
  readonly creativity: number;
  readonly code_quality: number;
  readonly completeness: number;
  readonly total: number;
  readonly feedback: string;
};

export type ScoringResult = {
  readonly player1: ScoreBreakdown;
  readonly player2: ScoreBreakdown;
  readonly winner: 'player1' | 'player2' | 'draw';
  readonly commentary: string;
};

export async function triggerScoring(
  supabase: SupabaseClient,
  duelId: string,
  challenge: Challenge,
): Promise<ScoringResult | null> {
  // 1. Fetch both submissions
  const { data: submissions, error: subError } = await supabase
    .from('submissions')
    .select('*')
    .eq('duel_id', duelId)
    .order('submitted_at', { ascending: true });

  console.log('[VibeDuel:scoring] Submissions found:', submissions?.length ?? 0, subError ? `Error: ${subError.message}` : '');

  if (!submissions || submissions.length === 0) return null;

  // Only one player submitted — they win by default
  if (submissions.length < 2) {
    const submitter = submissions[0];
    await supabase
      .from('submissions')
      .update({
        score: 100,
        score_breakdown: { forfeit_win: true, total: 100, feedback: 'Win by forfeit.' },
      })
      .eq('id', submitter.id);

    await supabase
      .from('duels')
      .update({
        status: 'complete',
        winner_id: submitter.player_id,
        ended_at: new Date().toISOString(),
      })
      .eq('id', duelId);

    return {
      player1: {
        functionality: 20, visual_design: 20, creativity: 20,
        code_quality: 20, completeness: 20, total: 100,
        feedback: 'Win by forfeit — opponent did not submit.',
      },
      player2: {
        functionality: 0, visual_design: 0, creativity: 0,
        code_quality: 0, completeness: 0, total: 0,
        feedback: 'No code submitted.',
      },
      winner: 'player1',
      commentary: 'Victory by forfeit! The opponent failed to submit.',
    };
  }

  // 2. Call the scoring API
  console.log('[VibeDuel:scoring] Calling /api/score...');
  const response = await fetch('/api/score', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      challenge,
      submission1: { code: submissions[0].code, player_id: submissions[0].player_id },
      submission2: { code: submissions[1].code, player_id: submissions[1].player_id },
    }),
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => 'unknown');
    console.error('[VibeDuel:scoring] API error:', response.status, errText);
    return null;
  }

  const scores = (await response.json()) as ScoringResult;
  console.log('[VibeDuel:scoring] Scores received:', scores.winner, scores.player1.total, 'vs', scores.player2.total);

  // 3. Save scores to submissions
  await supabase
    .from('submissions')
    .update({ score: scores.player1.total, score_breakdown: scores.player1 })
    .eq('id', submissions[0].id);

  await supabase
    .from('submissions')
    .update({ score: scores.player2.total, score_breakdown: scores.player2 })
    .eq('id', submissions[1].id);

  // 4. Determine winner
  let winnerId: string | null = null;
  if (scores.winner === 'player1') winnerId = submissions[0].player_id;
  else if (scores.winner === 'player2') winnerId = submissions[1].player_id;

  // 5. Update duel as complete
  await supabase
    .from('duels')
    .update({
      status: 'complete',
      winner_id: winnerId,
      ended_at: new Date().toISOString(),
    })
    .eq('id', duelId);

  // 6. Update ELO ratings
  await updateElo(
    supabase,
    submissions[0].player_id,
    submissions[1].player_id,
    scores.winner,
  );

  return scores;
}

const K_FACTOR = 32;

async function updateElo(
  supabase: SupabaseClient,
  player1Id: string,
  player2Id: string,
  winner: 'player1' | 'player2' | 'draw',
): Promise<void> {
  const { data: p1 } = await supabase
    .from('players')
    .select('*')
    .eq('id', player1Id)
    .single();
  const { data: p2 } = await supabase
    .from('players')
    .select('*')
    .eq('id', player2Id)
    .single();

  if (!p1 || !p2) return;

  const expected1 = 1 / (1 + Math.pow(10, (p2.elo - p1.elo) / 400));
  const expected2 = 1 / (1 + Math.pow(10, (p1.elo - p2.elo) / 400));

  const score1 = winner === 'player1' ? 1 : winner === 'draw' ? 0.5 : 0;
  const score2 = winner === 'player2' ? 1 : winner === 'draw' ? 0.5 : 0;

  const newElo1 = Math.round(p1.elo + K_FACTOR * (score1 - expected1));
  const newElo2 = Math.round(p2.elo + K_FACTOR * (score2 - expected2));

  await supabase
    .from('players')
    .update({
      elo: newElo1,
      wins: p1.wins + (winner === 'player1' ? 1 : 0),
      losses: p1.losses + (winner === 'player2' ? 1 : 0),
      draws: p1.draws + (winner === 'draw' ? 1 : 0),
    })
    .eq('id', player1Id);

  await supabase
    .from('players')
    .update({
      elo: newElo2,
      wins: p2.wins + (winner === 'player2' ? 1 : 0),
      losses: p2.losses + (winner === 'player1' ? 1 : 0),
      draws: p2.draws + (winner === 'draw' ? 1 : 0),
    })
    .eq('id', player2Id);
}
