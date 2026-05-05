import Anthropic from '@anthropic-ai/sdk';
import { NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { rateLimit, clientKey } from '@/lib/rateLimit';
import { getChallengeById } from '@/lib/challenges';
import type { ScoringResult, ScoreBreakdown } from '@/lib/scoring';
import type { DuelRow } from '@/types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const FORFEIT_WIN: ScoreBreakdown = {
  functionality: 20,
  visual_design: 20,
  creativity: 20,
  code_quality: 20,
  completeness: 20,
  total: 100,
  feedback: 'Win by forfeit — opponent did not submit.',
};
const EMPTY: ScoreBreakdown = {
  functionality: 0,
  visual_design: 0,
  creativity: 0,
  code_quality: 0,
  completeness: 0,
  total: 0,
  feedback: 'No submission.',
};
const K_FACTOR = 32;

export async function POST(
  req: Request,
  { params }: { params: { id: string } },
) {
  const limit = rateLimit(clientKey(req, 'finalize'), {
    capacity: 3,
    refillPerSecond: 0.1,
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
  const { data: duel } = await sb
    .from('duels')
    .select('*')
    .eq('id', params.id)
    .single<DuelRow>();
  if (!duel) {
    return NextResponse.json({ error: 'duel not found' }, { status: 404 });
  }
  if (duel.player1_id !== player_id && duel.player2_id !== player_id) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  // If already complete, just return the existing scores.
  if (duel.status === 'complete') {
    return NextResponse.json(await reconstruct(sb, duel));
  }

  const challenge = getChallengeById(duel.challenge_id);
  if (!challenge) {
    return NextResponse.json({ error: 'invalid challenge' }, { status: 500 });
  }

  // Atomically claim — only one finalize call wins. If already judging or
  // complete, we fall through to read the result anyway (race-tolerant).
  await sb
    .from('duels')
    .update({ status: 'judging' })
    .eq('id', params.id)
    .in('status', ['active', 'submitted', 'judging']);

  // Refetch in case another concurrent finalize already finished.
  const { data: latest } = await sb
    .from('duels')
    .select('*')
    .eq('id', params.id)
    .single<DuelRow>();
  if (latest?.status === 'complete') {
    return NextResponse.json(await reconstruct(sb, latest));
  }

  let { data: submissions } = await sb
    .from('submissions')
    .select('*')
    .eq('duel_id', params.id);
  if (!submissions || submissions.length === 0) {
    return NextResponse.json(
      { error: 'no submissions to finalize' },
      { status: 400 },
    );
  }

  // If we only see one submission, the opponent's POST may simply be in
  // flight — handleSubmit on both sides can race finalize. Wait briefly and
  // re-query before declaring forfeit, otherwise a fast-clicking P1 can
  // steal a 100/0 win from a P2 whose submit lands ~500ms later.
  if (submissions.length === 1 && duel.player2_id) {
    await new Promise((r) => setTimeout(r, 2500));
    const { data: again } = await sb
      .from('submissions')
      .select('*')
      .eq('duel_id', params.id);
    if (again && again.length >= 2) {
      submissions = again;
    }
  }

  // Forfeit branch
  if (submissions.length === 1) {
    const submitter = submissions[0];
    const submitterIsP1 = submitter.player_id === duel.player1_id;

    await sb
      .from('submissions')
      .update({ score: 100, score_breakdown: FORFEIT_WIN })
      .eq('id', submitter.id);

    await sb
      .from('duels')
      .update({
        status: 'complete',
        winner_id: submitter.player_id,
        ended_at: new Date().toISOString(),
      })
      .eq('id', params.id);

    if (duel.player2_id) {
      await updateElo(
        sb,
        duel.id,
        duel.player1_id,
        duel.player2_id,
        submitterIsP1 ? 'player1' : 'player2',
      );
    }

    const result: ScoringResult = {
      player1: submitterIsP1 ? FORFEIT_WIN : EMPTY,
      player2: submitterIsP1 ? EMPTY : FORFEIT_WIN,
      winner: submitterIsP1 ? 'player1' : 'player2',
      commentary: 'Victory by forfeit! The opponent failed to submit.',
    };
    return NextResponse.json(result);
  }

  // Both submitted — call AI judge.
  const sub1 = submissions.find((s) => s.player_id === duel.player1_id);
  const sub2 = submissions.find((s) => s.player_id === duel.player2_id);
  if (!sub1 || !sub2) {
    return NextResponse.json(
      { error: 'submission player_ids do not match duel' },
      { status: 500 },
    );
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: 'ANTHROPIC_API_KEY not configured' },
      { status: 500 },
    );
  }
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const systemPrompt = `You are the official judge of VibeDuel, a competitive vibecoding arena. You must evaluate two code submissions for the same challenge and score them fairly.

You MUST respond with ONLY valid JSON, no markdown, no code fences, no explanation outside the JSON. The response must be parseable by JSON.parse().

Score each submission on these categories (0-20 points each, total max 100):
1. "functionality" — Does it work? Does it do what the challenge asks?
2. "visual_design" — Is it visually polished? Good colors, layout, spacing?
3. "creativity" — Any clever or unexpected touches? Goes beyond minimum requirements?
4. "code_quality" — Clean structure, good patterns, readable code?
5. "completeness" — How many of the scoring criteria are met?

Response format:
{
  "player1": {"functionality": <0-20>, "visual_design": <0-20>, "creativity": <0-20>, "code_quality": <0-20>, "completeness": <0-20>, "total": <0-100>, "feedback": "<one sentence>"},
  "player2": {"functionality": <0-20>, "visual_design": <0-20>, "creativity": <0-20>, "code_quality": <0-20>, "completeness": <0-20>, "total": <0-100>, "feedback": "<one sentence>"},
  "winner": "player1" | "player2" | "draw",
  "commentary": "<one exciting sentence>"
}

Be fair, honest, and specific.`;

  const userMessage = `Challenge: ${challenge.title}
Description: ${challenge.description}
Scoring Criteria: ${challenge.criteria.join(', ')}

=== PLAYER 1 SUBMISSION ===
${sub1.code || '// No code submitted'}

=== PLAYER 2 SUBMISSION ===
${sub2.code || '// No code submitted'}`;

  let scores: ScoringResult;
  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2048,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    });
    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('')
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();
    scores = JSON.parse(text);
  } catch (error) {
    console.error('[finalize] AI judge failed:', error);
    scores = {
      player1: { ...EMPTY, total: 50, feedback: 'Score could not be evaluated.' },
      player2: { ...EMPTY, total: 50, feedback: 'Score could not be evaluated.' },
      winner: 'draw',
      commentary: 'The judge had trouble evaluating — calling it a draw!',
    };
  }

  await sb
    .from('submissions')
    .update({ score: scores.player1.total, score_breakdown: scores.player1 })
    .eq('id', sub1.id);
  await sb
    .from('submissions')
    .update({ score: scores.player2.total, score_breakdown: scores.player2 })
    .eq('id', sub2.id);

  const winnerId =
    scores.winner === 'player1'
      ? duel.player1_id
      : scores.winner === 'player2'
        ? duel.player2_id
        : null;

  await sb
    .from('duels')
    .update({
      status: 'complete',
      winner_id: winnerId,
      ended_at: new Date().toISOString(),
    })
    .eq('id', params.id);

  if (duel.player2_id) {
    await updateElo(sb, duel.id, duel.player1_id, duel.player2_id, scores.winner);
  }

  return NextResponse.json(scores);
}

async function reconstruct(
  sb: ReturnType<typeof getAdminClient>,
  duel: DuelRow,
): Promise<ScoringResult> {
  const { data: subs } = await sb
    .from('submissions')
    .select('*')
    .eq('duel_id', duel.id);
  const sub1 = subs?.find((s) => s.player_id === duel.player1_id) ?? null;
  const sub2 = subs?.find((s) => s.player_id === duel.player2_id) ?? null;
  const winner: 'player1' | 'player2' | 'draw' =
    duel.winner_id === duel.player1_id
      ? 'player1'
      : duel.winner_id === duel.player2_id
        ? 'player2'
        : 'draw';
  return {
    player1: sub1?.score_breakdown ?? EMPTY,
    player2: sub2?.score_breakdown ?? EMPTY,
    winner,
    commentary: '',
  };
}

async function updateElo(
  sb: ReturnType<typeof getAdminClient>,
  duelId: string,
  player1Id: string,
  player2Id: string,
  winner: 'player1' | 'player2' | 'draw',
): Promise<void> {
  const { data: p1 } = await sb
    .from('players')
    .select('*')
    .eq('id', player1Id)
    .single();
  const { data: p2 } = await sb
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

  await sb
    .from('players')
    .update({
      elo: newElo1,
      wins: p1.wins + (winner === 'player1' ? 1 : 0),
      losses: p1.losses + (winner === 'player2' ? 1 : 0),
      draws: p1.draws + (winner === 'draw' ? 1 : 0),
    })
    .eq('id', player1Id);

  await sb
    .from('players')
    .update({
      elo: newElo2,
      wins: p2.wins + (winner === 'player2' ? 1 : 0),
      losses: p2.losses + (winner === 'player1' ? 1 : 0),
      draws: p2.draws + (winner === 'draw' ? 1 : 0),
    })
    .eq('id', player2Id);

  // Snapshot ELO change on the duel row for the /me history graph.
  await sb
    .from('duels')
    .update({
      player1_elo_before: p1.elo,
      player1_elo_after: newElo1,
      player2_elo_before: p2.elo,
      player2_elo_after: newElo2,
    })
    .eq('id', duelId);
}
