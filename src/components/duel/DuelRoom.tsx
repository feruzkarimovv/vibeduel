'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import Button from '@/components/ui/Button';
import CodeEditor from '@/components/duel/CodeEditor';
import LivePreview from '@/components/duel/LivePreview';
import OpponentView from '@/components/duel/OpponentView';
import DuelTimer from '@/components/duel/DuelTimer';
import PromptBar from '@/components/duel/PromptBar';
import Countdown from '@/components/duel/Countdown';
import Badge from '@/components/ui/Badge';
import { getChallengeById } from '@/lib/challenges';
import { createClient } from '@/lib/supabase/client';
import { getOrCreatePlayer } from '@/lib/player';
import { fetchDuel, fetchDuelPlayers } from '@/lib/matchmaking';
import { triggerScoring } from '@/lib/scoring';
import type { ScoringResult } from '@/lib/scoring';
import ResultsScreen from '@/components/duel/ResultsScreen';
import type { Challenge, Player, DuelRow, OpponentProgress } from '@/types';
import type { SupabaseClient } from '@supabase/supabase-js';

function useSupabase() {
  const ref = useRef<SupabaseClient | null>(null);
  if (!ref.current && typeof window !== 'undefined') {
    ref.current = createClient();
  }
  return ref.current;
}

type DuelPhase =
  | 'loading'
  | 'waiting'
  | 'countdown'
  | 'active'
  | 'submitted'
  | 'timesup'
  | 'judging'
  | 'complete'
  | 'not_found';

const MAX_ITERATIONS = 5;
const PROGRESS_BROADCAST_INTERVAL = 2000;

export default function DuelRoom() {
  const params = useParams();
  const duelId = params.id as string;

  const supabase = useSupabase();
  const [currentPlayer, setCurrentPlayer] = useState<Player | null>(null);
  const [opponent, setOpponent] = useState<Player | null>(null);
  const [duel, setDuel] = useState<DuelRow | null>(null);
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [phase, setPhase] = useState<DuelPhase>('loading');
  const [code, setCode] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [iterationCount, setIterationCount] = useState(0);
  const [opponentProgress, setOpponentProgress] =
    useState<OpponentProgress | null>(null);
  const [scoringResult, setScoringResult] = useState<ScoringResult | null>(null);

  const isPlayer1Ref = useRef(false);
  const scoringTriggeredRef = useRef(false);
  const progressIntervalRef = useRef<ReturnType<typeof setInterval>>();
  const hasSubmittedRef = useRef(false);

  // ---------- INIT: load player, duel, challenge ----------
  useEffect(() => {
    if (!supabase) return;
    const sb = supabase;
    async function init() {
      const player = await getOrCreatePlayer(sb);
      if (!player) {
        setPhase('not_found');
        return;
      }
      setCurrentPlayer(player);

      const duelData = await fetchDuel(sb, duelId);
      if (!duelData) {
        setPhase('not_found');
        return;
      }

      // If this player isn't in the duel yet, try to join as player2
      if (
        duelData.player1_id !== player.id &&
        duelData.player2_id !== player.id
      ) {
        if (duelData.status === 'waiting' && !duelData.player2_id) {
          const { data: updated } = await sb
            .from('duels')
            .update({ player2_id: player.id, status: 'countdown' })
            .eq('id', duelId)
            .eq('status', 'waiting')
            .select()
            .single();

          if (!updated) {
            setPhase('not_found');
            return;
          }
          setDuel(updated as DuelRow);
        } else {
          // Duel is full or already started and we're not in it
          setPhase('not_found');
          return;
        }
      } else {
        setDuel(duelData);
      }

      const resolvedDuel =
        duelData.player1_id === player.id || duelData.player2_id === player.id
          ? duelData
          : ((await fetchDuel(sb, duelId)) as DuelRow);

      isPlayer1Ref.current = resolvedDuel.player1_id === player.id;

      const ch = getChallengeById(resolvedDuel.challenge_id);
      if (!ch) {
        setPhase('not_found');
        return;
      }
      setChallenge(ch);

      // Load players
      const { player1, player2 } = await fetchDuelPlayers(
        sb,
        resolvedDuel,
      );
      const opp = isPlayer1Ref.current ? player2 : player1;
      setOpponent(opp);

      // Set initial phase based on duel status
      const statusToPhase: Record<string, DuelPhase> = {
        waiting: 'waiting',
        countdown: 'countdown',
        active: 'active',
        judging: 'judging',
        complete: 'complete',
      };
      setPhase(statusToPhase[resolvedDuel.status] ?? 'loading');
    }

    init();
  }, [supabase, duelId]);

  // ---------- SCORING ----------
  const doScoring = useCallback(async () => {
    if (!supabase || !challenge) return;
    if (scoringTriggeredRef.current) {
      console.log('[VibeDuel] Scoring already triggered, skipping');
      return;
    }
    scoringTriggeredRef.current = true;
    setPhase('judging');
    console.log('[VibeDuel] Starting AI scoring...');
    try {
      const result = await triggerScoring(supabase, duelId, challenge);
      console.log('[VibeDuel] Scoring complete:', result ? 'got result' : 'null result');
      if (result) {
        setScoringResult(result);
      } else {
        // Null result — mark complete to avoid hanging
        console.error('[VibeDuel] triggerScoring returned null');
        setPhase('complete');
      }
    } catch (err) {
      console.error('[VibeDuel] Scoring failed:', err);
      await supabase
        .from('duels')
        .update({ status: 'complete', ended_at: new Date().toISOString() })
        .eq('id', duelId);
      setPhase('complete');
    }
  }, [supabase, challenge, duelId]);

  // ---------- POLL: ensure scoring proceeds even if realtime fails ----------
  useEffect(() => {
    if (!supabase || (phase !== 'submitted' && phase !== 'judging')) return;

    let active = true;

    const poll = async () => {
      if (!active || scoringResult) return;

      // Check current duel status in DB
      const { data: d } = await supabase
        .from('duels')
        .select('status, winner_id')
        .eq('id', duelId)
        .single();

      if (!active || !d) return;

      // If duel is already complete in DB, fetch scores
      if (d.status === 'complete') {
        const { data: subs } = await supabase
          .from('submissions')
          .select('*')
          .eq('duel_id', duelId)
          .order('submitted_at', { ascending: true });

        if (subs && subs.length >= 1 && subs[0].score_breakdown) {
          setScoringResult({
            player1: subs[0].score_breakdown,
            player2: subs[1]?.score_breakdown ?? {
              functionality: 0, visual_design: 0, creativity: 0,
              code_quality: 0, completeness: 0, total: 0,
              feedback: 'No submission.',
            },
            winner:
              d.winner_id === subs[0].player_id
                ? 'player1'
                : d.winner_id === subs[1]?.player_id
                  ? 'player2'
                  : 'draw',
            commentary: '',
          } as ScoringResult);
        }
        setPhase('complete');
        return;
      }

      // Player1: if both submissions exist, trigger scoring now
      if (isPlayer1Ref.current && !scoringTriggeredRef.current) {
        const { data: subs } = await supabase
          .from('submissions')
          .select('id')
          .eq('duel_id', duelId);

        if (subs && subs.length >= 2) {
          console.log('[VibeDuel:poll] Both submitted — triggering scoring');
          await supabase
            .from('duels')
            .update({ status: 'judging' })
            .eq('id', duelId);
          await doScoring();
        }
      }
    };

    // Poll immediately then every 3 seconds
    poll();
    const interval = setInterval(poll, 3000);

    // Safety: Player1 forces scoring after 30s regardless (handles opponent disconnect)
    let forceTimer: ReturnType<typeof setTimeout> | undefined;
    if (isPlayer1Ref.current) {
      forceTimer = setTimeout(async () => {
        if (active && !scoringTriggeredRef.current && supabase) {
          console.log('[VibeDuel:poll] Force-triggering scoring after timeout');
          await supabase
            .from('duels')
            .update({ status: 'judging' })
            .eq('id', duelId);
          await doScoring();
        }
      }, 30000);
    }

    return () => {
      active = false;
      clearInterval(interval);
      if (forceTimer) clearTimeout(forceTimer);
    };
  }, [phase, supabase, duelId, doScoring, scoringResult]);

  // ---------- REALTIME: duel status changes ----------
  useEffect(() => {
    if (!supabase || !duel) return;

    const channel = supabase
      .channel(`duel-room:${duelId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'duels',
          filter: `id=eq.${duelId}`,
        },
        async (payload) => {
          const updated = payload.new as DuelRow;
          setDuel(updated);

          if (updated.status === 'countdown' && phase === 'waiting') {
            // Opponent joined — load their info
            const { player1, player2 } = await fetchDuelPlayers(
              supabase,
              updated,
            );
            setOpponent(isPlayer1Ref.current ? player2 : player1);
            setPhase('countdown');
          }

          if (updated.status === 'active') {
            setPhase('active');
          }

          if (updated.status === 'judging') {
            hasSubmittedRef.current = true;
            // Player1 triggers AI scoring if not already triggered
            if (isPlayer1Ref.current && !scoringTriggeredRef.current) {
              await doScoring();
            } else {
              setPhase('judging');
            }
          }

          if (updated.status === 'complete') {
            setPhase('complete');
            // Player2 fetches the scores if they don't have them yet
            if (!scoringTriggeredRef.current) {
              const { data: subs } = await supabase
                .from('submissions')
                .select('*')
                .eq('duel_id', duelId)
                .order('submitted_at', { ascending: true });
              if (subs && subs.length >= 2) {
                setScoringResult({
                  player1: subs[0].score_breakdown ?? { total: subs[0].score ?? 0, feedback: '' },
                  player2: subs[1].score_breakdown ?? { total: subs[1].score ?? 0, feedback: '' },
                  winner: updated.winner_id === subs[0].player_id ? 'player1'
                    : updated.winner_id === subs[1].player_id ? 'player2' : 'draw',
                  commentary: '',
                } as ScoringResult);
              }
            }
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [duel, duelId, supabase, phase, currentPlayer, opponent, challenge, doScoring]);

  // ---------- REALTIME: broadcast progress ----------
  useEffect(() => {
    if (!supabase || !currentPlayer || phase !== 'active') return;

    const channel = supabase.channel(`progress:${duelId}`);

    // Listen for opponent progress
    channel
      .on('broadcast', { event: 'progress' }, ({ payload }) => {
        if (payload.playerId !== currentPlayer.id) {
          setOpponentProgress(payload as OpponentProgress);
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentPlayer, duelId, supabase, phase]);

  // Broadcast own progress every 2s
  useEffect(() => {
    if (!supabase || phase !== 'active' || !currentPlayer) return;

    const broadcast = () => {
      const channel = supabase.channel(`progress:${duelId}`);
      channel.send({
        type: 'broadcast',
        event: 'progress',
        payload: {
          playerId: currentPlayer.id,
          lineCount: code.split('\n').length,
          charCount: code.length,
          iterationCount,
          hasPreview: code.length > 100,
          status: hasSubmittedRef.current
            ? 'submitted'
            : code.length > 0
              ? 'coding'
              : 'idle',
        },
      });
    };

    progressIntervalRef.current = setInterval(
      broadcast,
      PROGRESS_BROADCAST_INTERVAL,
    );

    return () => clearInterval(progressIntervalRef.current);
  }, [phase, currentPlayer, duelId, supabase, code, iterationCount]);

  // ---------- PRESENCE: track online players ----------
  useEffect(() => {
    if (!supabase || !currentPlayer || !duel) return;

    const channel = supabase.channel(`presence:${duelId}`);
    channel
      .on('presence', { event: 'leave' }, () => {
        // Could implement forfeit timer here
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({ player_id: currentPlayer.id, online: true });
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentPlayer, duel, duelId, supabase]);

  // ---------- HANDLERS ----------
  const handleCountdownComplete = useCallback(async () => {
    if (isPlayer1Ref.current && duel && supabase) {
      await supabase
        .from('duels')
        .update({ status: 'active', started_at: new Date().toISOString() })
        .eq('id', duelId);
    }
    setPhase('active');
  }, [duel, duelId, supabase]);

  const handleGenerate = useCallback(
    async (prompt: string) => {
      if (!challenge || iterationCount >= MAX_ITERATIONS || isGenerating) return;

      setIsGenerating(true);
      setIterationCount((prev) => prev + 1);

      const isRefining = iterationCount > 0 && code.trim().length > 0;
      if (!isRefining) setCode('');

      try {
        const response = await fetch('/api/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt,
            challenge,
            existingCode: isRefining ? code : undefined,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => null);
          const msg = errorData?.error ?? `API error ${response.status}`;
          setCode(`// Error: ${msg}\n// Please try again.`);
          setIsGenerating(false);
          return;
        }

        const reader = response.body?.getReader();
        if (!reader) {
          setCode('// Error: No response stream');
          setIsGenerating(false);
          return;
        }

        const decoder = new TextDecoder();
        let accumulated = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          accumulated += decoder.decode(value, { stream: true });
          setCode(accumulated);
        }
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Unknown error';
        setCode(`// Error: ${message}\n// Please try again.`);
      } finally {
        setIsGenerating(false);
      }
    },
    [challenge, iterationCount, isGenerating, code],
  );

  const handleSubmit = useCallback(async () => {
    if (!supabase || phase !== 'active' || hasSubmittedRef.current) return;
    hasSubmittedRef.current = true;
    setPhase('submitted');

    // Upsert submission
    await supabase.from('submissions').upsert(
      {
        duel_id: duelId,
        player_id: currentPlayer!.id,
        code,
        submitted_at: new Date().toISOString(),
      },
      { onConflict: 'duel_id,player_id' },
    );

    // Check if opponent already submitted
    const { data: allSubs } = await supabase
      .from('submissions')
      .select('id')
      .eq('duel_id', duelId);

    const bothSubmitted = allSubs && allSubs.length >= 2;
    const hasNoOpponent = !duel?.player2_id;

    // Trigger scoring if: both submitted, OR solo (no opponent)
    const shouldScore = bothSubmitted || hasNoOpponent;

    if (shouldScore && isPlayer1Ref.current) {
      await supabase
        .from('duels')
        .update({ status: 'judging' })
        .eq('id', duelId);
      await doScoring();
    } else if (shouldScore && !isPlayer1Ref.current) {
      // Player2 submitted last — set judging, player1's realtime handler will score
      await supabase
        .from('duels')
        .update({ status: 'judging' })
        .eq('id', duelId);
      setPhase('judging');
    }
    // Otherwise: waiting for opponent's submission — stay at 'submitted'
  }, [phase, supabase, duelId, currentPlayer, code, doScoring, duel]);

  const handleTimeUp = useCallback(async () => {
    if (!supabase || hasSubmittedRef.current) return;
    hasSubmittedRef.current = true;

    // Auto-submit whatever code exists
    if (currentPlayer) {
      await supabase.from('submissions').upsert(
        {
          duel_id: duelId,
          player_id: currentPlayer.id,
          code,
          submitted_at: new Date().toISOString(),
        },
        { onConflict: 'duel_id,player_id' },
      );
    }

    setPhase('timesup');
    setTimeout(async () => {
      if (!supabase) return;
      // Player1 (or solo) triggers scoring
      if (isPlayer1Ref.current || !duel?.player2_id) {
        await supabase
          .from('duels')
          .update({ status: 'judging' })
          .eq('id', duelId);
        await doScoring();
      } else {
        setPhase('judging');
      }
    }, 1600);
  }, [currentPlayer, supabase, duelId, code, doScoring, duel]);

  const handleClearRestart = useCallback(() => {
    if (iterationCount >= MAX_ITERATIONS || isGenerating) return;
    setCode('');
    setIterationCount((prev) => prev + 1);
  }, [iterationCount, isGenerating]);

  // ---------- RENDER ----------
  if (phase === 'loading') {
    return (
      <main className="min-h-screen flex items-center justify-center bg-arena-black">
        <div className="text-zinc-700 font-mono text-sm uppercase tracking-wider animate-pulse">
          Loading duel...
        </div>
      </main>
    );
  }

  if (phase === 'not_found') {
    return (
      <main className="min-h-screen flex items-center justify-center bg-arena-black px-4 noise">
        <div className="text-center space-y-5">
          <div className="w-16 h-16 border-2 border-neon-magenta/30 mx-auto flex items-center justify-center">
            <span className="text-neon-magenta font-mono text-2xl font-bold">
              ?
            </span>
          </div>
          <h2 className="text-xl font-black text-white uppercase tracking-tight">
            Duel Not Found
          </h2>
          <p className="text-zinc-600 text-xs font-mono">
            This duel doesn&apos;t exist or has already ended.
          </p>
          <Link href="/duel">
            <Button>BACK TO LOBBY</Button>
          </Link>
        </div>
      </main>
    );
  }

  if (phase === 'waiting') {
    return (
      <main className="min-h-screen flex items-center justify-center bg-arena-black px-4 noise">
        <div className="text-center space-y-6">
          <div className="relative inline-block">
            <div className="w-16 h-16 border-2 border-neon-green/20 animate-ping absolute inset-0" />
            <div className="w-16 h-16 border border-neon-green/40 flex items-center justify-center relative">
              <div className="w-3 h-3 bg-neon-green animate-pulse" />
            </div>
          </div>
          <h2 className="text-xl font-black text-white uppercase tracking-tight">
            Waiting for Opponent
          </h2>
          <p className="text-zinc-600 text-xs font-mono uppercase tracking-wider">
            Share this page&apos;s URL to invite someone
          </p>
          {challenge && (
            <p className="text-[10px] text-zinc-700 font-mono">
              Challenge: {challenge.title}
            </p>
          )}
        </div>
      </main>
    );
  }

  if (!challenge) return null;

  if (phase === 'countdown') {
    return (
      <Countdown
        onComplete={handleCountdownComplete}
        challengeTitle={challenge.title}
      />
    );
  }

  // Judging / complete — show results screen
  if (phase === 'judging' || phase === 'submitted' || phase === 'complete') {
    if (currentPlayer) {
      return (
        <ResultsScreen
          currentPlayer={currentPlayer}
          opponent={opponent}
          scores={scoringResult}
          isPlayer1={isPlayer1Ref.current}
        />
      );
    }
  }

  const isActive = phase === 'active';

  return (
    <main className="h-screen flex flex-col bg-arena-black overflow-hidden">
      {/* Top bar */}
      <header className="flex-shrink-0 flex items-center justify-between px-4 py-2 border-b border-arena-line bg-arena-dark/80">
        <div className="flex items-center gap-3 min-w-0">
          <Link
            href="/"
            className="text-sm font-black text-neon-green uppercase tracking-tight flex-shrink-0"
          >
            VD
          </Link>
          <div className="w-px h-4 bg-arena-line flex-shrink-0" />
          <div className="flex items-center gap-2 min-w-0">
            <h1 className="text-xs font-mono font-bold text-white truncate uppercase">
              {challenge.title}
            </h1>
            <Badge variant={challenge.difficulty}>{challenge.difficulty}</Badge>
          </div>
        </div>

        <DuelTimer
          seconds={challenge.timeLimit}
          isRunning={isActive}
          onComplete={handleTimeUp}
        />

        <OpponentView opponent={opponent} progress={opponentProgress} />
      </header>

      {/* Main duel area */}
      <div
        style={{
          display: 'flex',
          flex: 1,
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        {/* Left: editor + prompt */}
        <div
          style={{
            width: '50%',
            display: 'flex',
            flexDirection: 'column',
            padding: '12px',
            gap: '8px',
            minHeight: 0,
          }}
        >
          <div className="text-[10px] text-zinc-600 font-mono uppercase tracking-wider flex items-center justify-between flex-shrink-0">
            <span>Your Solution</span>
            {code.trim() &&
              !isGenerating &&
              iterationCount < MAX_ITERATIONS && (
                <button
                  onClick={handleClearRestart}
                  className="text-zinc-700 hover:text-neon-magenta transition-colors text-[10px] font-mono"
                >
                  [CLEAR &amp; RESTART]
                </button>
              )}
          </div>
          <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
            <CodeEditor
              code={code}
              onChange={setCode}
              isStreaming={isGenerating}
              readOnly={!isActive}
            />
          </div>
          <div className="flex-shrink-0">
            <PromptBar
              onGenerate={handleGenerate}
              isGenerating={isGenerating}
              iterationCount={iterationCount}
              maxIterations={MAX_ITERATIONS}
              disabled={!isActive}
            />
          </div>
        </div>

        {/* Divider */}
        <div className="hidden lg:block absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-px z-10">
          <div className="h-full w-full bg-gradient-to-b from-neon-green/20 via-arena-line to-neon-magenta/20" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-6 h-6 bg-arena-black border border-arena-line flex items-center justify-center rotate-45">
            <div className="w-1.5 h-1.5 bg-neon-green animate-pulse -rotate-45" />
          </div>
        </div>

        {/* Right: live preview */}
        <div
          style={{
            width: '50%',
            display: 'flex',
            flexDirection: 'column',
            padding: '12px',
            minHeight: 0,
          }}
        >
          <div className="text-[10px] text-zinc-600 mb-2 font-mono uppercase tracking-wider flex-shrink-0">
            Live Preview
          </div>
          <div
            style={{
              flex: 1,
              minHeight: 0,
              overflow: 'hidden',
              border: '1px solid var(--arena-line)',
              background: 'rgba(10,10,10,0.8)',
            }}
          >
            <LivePreview code={code} isStreaming={isGenerating} />
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <footer className="flex-shrink-0 flex items-center justify-between px-4 py-2 border-t border-arena-line bg-arena-dark/80">
        <div className="text-[10px] text-zinc-700 tabular-nums font-mono">
          {code ? code.split('\n').length : 0} ln &middot;{' '}
          {code.length.toLocaleString()} ch
        </div>
        <Button
          onClick={handleSubmit}
          disabled={!isActive || code.trim().length === 0}
        >
          SUBMIT SOLUTION
        </Button>
      </footer>
    </main>
  );
}
