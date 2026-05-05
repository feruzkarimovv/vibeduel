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

// Client-side helper. All scoring + ELO + status writes happen on the server
// in /api/duel/[id]/finalize using the service_role key. The client just asks
// for the result.
export async function triggerScoring(
  duelId: string,
  playerId: string,
): Promise<ScoringResult | null> {
  const res = await fetch(`/api/duel/${duelId}/finalize`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ player_id: playerId }),
  });
  if (!res.ok) return null;
  const body = await res.json();
  if (body?.error) return null;
  return body as ScoringResult;
}
