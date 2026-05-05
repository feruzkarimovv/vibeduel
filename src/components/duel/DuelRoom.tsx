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
import ChallengeCard from '@/components/duel/ChallengeCard';
import Badge from '@/components/ui/Badge';
import { getChallengeById } from '@/lib/challenges';
import { createClient } from '@/lib/supabase/client';
import { getOrCreatePlayer } from '@/lib/player';
import { fetchDuel, fetchDuelPlayers, joinDuelById } from '@/lib/matchmaking';
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
  | 'invite'
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
const STREAM_ERROR_SENTINEL = '\n\n__VIBEDUEL_STREAM_ERROR__:';

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
  // Live snapshot of code/iteration for the progress broadcaster — avoids
  // re-running the effect on every keystroke.
  const codeRef = useRef('');
  const iterationRef = useRef(0);

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

      const ch = getChallengeById(duelData.challenge_id);
      if (!ch) {
        setPhase('not_found');
        return;
      }
      setChallenge(ch);

      // If the current player isn't in the duel, don't auto-claim P2 — show
      // an explicit prejoin confirm screen so a stranger who guesses a UUID
      // can't slip into someone else's invite link uninvited.
      if (
        duelData.player1_id !== player.id &&
        duelData.player2_id !== player.id
      ) {
        if (duelData.status === 'waiting' && !duelData.player2_id) {
          setDuel(duelData);
          const { player1 } = await fetchDuelPlayers(sb, duelData);
          setOpponent(player1);
          setPhase('invite');
          return;
        }
        // Duel is full or already started and we're not in it
        setPhase('not_found');
        return;
      }

      setDuel(duelData);
      isPlayer1Ref.current = duelData.player1_id === player.id;

      const { player1, player2 } = await fetchDuelPlayers(sb, duelData);
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
      setPhase(statusToPhase[duelData.status] ?? 'loading');
    }

    init();
  }, [supabase, duelId]);

  const handleConfirmJoin = useCallback(async () => {
    if (!currentPlayer || !supabase) return;
    setPhase('loading');
    const joined = await joinDuelById(currentPlayer.id, duelId);
    if (!joined) {
      setPhase('not_found');
      return;
    }
    setDuel(joined);
    isPlayer1Ref.current = joined.player1_id === currentPlayer.id;
    const { player1, player2 } = await fetchDuelPlayers(supabase, joined);
    setOpponent(isPlayer1Ref.current ? player2 : player1);
    setPhase(joined.status === 'countdown' ? 'countdown' : 'waiting');
  }, [currentPlayer, supabase, duelId]);

  // ---------- SCORING ----------
  const doScoring = useCallback(async () => {
    if (!currentPlayer) return;
    if (scoringTriggeredRef.current) return;
    scoringTriggeredRef.current = true;
    setPhase('judging');
    try {
      const result = await triggerScoring(duelId, currentPlayer.id);
      if (result) {
        setScoringResult(result);
      } else {
        setPhase('complete');
      }
    } catch {
      setPhase('complete');
    }
  }, [duelId, currentPlayer]);

  // ---------- POLL: ensure scoring proceeds even if realtime fails ----------
  // Both players run this. P1 is the primary scoring trigger (30s); P2 takes
  // over after 60s if P1 has ghosted. doScoring uses scoringTriggeredRef as a
  // per-client lock and atomically claims the duel via status='judging'.
  useEffect(() => {
    if (!supabase || (phase !== 'submitted' && phase !== 'judging')) return;

    let active = true;

    const reconstructFromCompletedDuel = async () => {
      const { data: d } = await supabase
        .from('duels')
        .select('status, winner_id, player1_id, player2_id')
        .eq('id', duelId)
        .single();
      if (!active || !d || d.status !== 'complete') return false;

      const { data: subs } = await supabase
        .from('submissions')
        .select('*')
        .eq('duel_id', duelId);
      if (!active || !subs) {
        setPhase('complete');
        return true;
      }

      const sub1 = subs.find((s) => s.player_id === d.player1_id) ?? null;
      const sub2 = subs.find((s) => s.player_id === d.player2_id) ?? null;
      const empty = {
        functionality: 0,
        visual_design: 0,
        creativity: 0,
        code_quality: 0,
        completeness: 0,
        total: 0,
        feedback: 'No submission.',
      };
      const winner: 'player1' | 'player2' | 'draw' =
        d.winner_id === d.player1_id
          ? 'player1'
          : d.winner_id === d.player2_id
            ? 'player2'
            : 'draw';
      setScoringResult({
        player1: sub1?.score_breakdown ?? empty,
        player2: sub2?.score_breakdown ?? empty,
        winner,
        commentary: '',
      } as ScoringResult);
      setPhase('complete');
      return true;
    };

    const poll = async () => {
      if (!active || scoringResult) return;

      // Already done — sync from DB.
      if (await reconstructFromCompletedDuel()) return;

      // P1 path: if both submissions exist, finalize immediately.
      if (isPlayer1Ref.current && !scoringTriggeredRef.current) {
        const { data: subs } = await supabase
          .from('submissions')
          .select('id')
          .eq('duel_id', duelId);

        if (subs && subs.length >= 2) {
          await doScoring();
        }
      }
    };

    poll();
    const interval = setInterval(poll, 3000);

    // Safety net: P1 force-triggers after 30s, P2 after 60s. The /finalize
    // route is idempotent, so a duplicate call from both players is harmless.
    const forceDelay = isPlayer1Ref.current ? 30000 : 60000;
    const forceTimer = setTimeout(async () => {
      if (!active || scoringTriggeredRef.current) return;
      if (await reconstructFromCompletedDuel()) return;
      await doScoring();
    }, forceDelay);

    return () => {
      active = false;
      clearInterval(interval);
      clearTimeout(forceTimer);
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
            // The other player needs the scores — fetch from DB and align by
            // duel.player1_id / player2_id (NOT submission order).
            if (!scoringTriggeredRef.current) {
              const { data: subs } = await supabase
                .from('submissions')
                .select('*')
                .eq('duel_id', duelId);
              const empty = {
                functionality: 0, visual_design: 0, creativity: 0,
                code_quality: 0, completeness: 0, total: 0,
                feedback: 'No submission.',
              };
              const sub1 = subs?.find((s) => s.player_id === updated.player1_id) ?? null;
              const sub2 = subs?.find((s) => s.player_id === updated.player2_id) ?? null;
              const winner: 'player1' | 'player2' | 'draw' =
                updated.winner_id === updated.player1_id
                  ? 'player1'
                  : updated.winner_id === updated.player2_id
                    ? 'player2'
                    : 'draw';
              setScoringResult({
                player1: sub1?.score_breakdown ?? empty,
                player2: sub2?.score_breakdown ?? empty,
                winner,
                commentary: '',
              } as ScoringResult);
            }
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [duel, duelId, supabase, phase, currentPlayer, opponent, challenge, doScoring]);

  // Keep refs in sync so the broadcaster can read latest values without the
  // effect re-mounting on every keystroke.
  useEffect(() => {
    codeRef.current = code;
  }, [code]);
  useEffect(() => {
    iterationRef.current = iterationCount;
  }, [iterationCount]);

  // ---------- REALTIME: subscribe + broadcast progress on one channel ----------
  // Single channel subscribed once per (currentPlayer, duelId, phase) triplet.
  // Listens for opponent updates and broadcasts our own progress on a timer.
  // Reads latest code/iteration via refs to avoid re-subscribing each keystroke.
  useEffect(() => {
    if (!supabase || !currentPlayer || phase !== 'active') return;

    const channel = supabase
      .channel(`progress:${duelId}`)
      .on('broadcast', { event: 'progress' }, ({ payload }) => {
        if (payload.playerId !== currentPlayer.id) {
          setOpponentProgress(payload as OpponentProgress);
        }
      });

    let interval: ReturnType<typeof setInterval> | undefined;
    channel.subscribe((status) => {
      if (status !== 'SUBSCRIBED' || interval) return;
      interval = setInterval(() => {
        const liveCode = codeRef.current;
        channel.send({
          type: 'broadcast',
          event: 'progress',
          payload: {
            playerId: currentPlayer.id,
            lineCount: liveCode.split('\n').length,
            charCount: liveCode.length,
            iterationCount: iterationRef.current,
            hasPreview: liveCode.length > 100,
            status: hasSubmittedRef.current
              ? 'submitted'
              : liveCode.length > 0
                ? 'coding'
                : 'idle',
          },
        });
      }, PROGRESS_BROADCAST_INTERVAL);
      progressIntervalRef.current = interval;
    });

    return () => {
      if (interval) clearInterval(interval);
      progressIntervalRef.current = undefined;
      supabase.removeChannel(channel);
    };
  }, [currentPlayer, duelId, supabase, phase]);

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
    // Either player can drive the transition; the server endpoint is
    // idempotent and only flips countdown→active. We still let player1 be the
    // primary so the server clock anchor (started_at) is set predictably.
    if (currentPlayer) {
      try {
        await fetch(`/api/duel/${duelId}/start`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ player_id: currentPlayer.id }),
        });
      } catch {
        // Idempotent: a missed start call is recovered by the realtime UPDATE
        // when the other player's start succeeds.
      }
    }
    setPhase('active');
  }, [duelId, currentPlayer]);

  const handleGenerate = useCallback(
    async (prompt: string) => {
      if (!challenge || iterationCount >= MAX_ITERATIONS || isGenerating) return;
      if (!currentPlayer || !duel) return;

      setIsGenerating(true);

      const isRefining = iterationCount > 0 && code.trim().length > 0;
      const codeBeforeGeneration = code;
      if (!isRefining) setCode('');

      // Track whether we successfully consumed any code from the stream.
      // We only burn an iteration if the user actually got something usable —
      // pure errors (auth, network, validation) don't count.
      let producedAnyCode = false;

      try {
        const response = await fetch('/api/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt,
            duel_id: duel.id,
            player_id: currentPlayer.id,
            existingCode: isRefining ? codeBeforeGeneration : undefined,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => null);
          const msg = errorData?.error ?? `API error ${response.status}`;
          setCode(`// Error: ${msg}\n// Please try again.`);
          if (isRefining) setCode(codeBeforeGeneration);
          return;
        }

        const reader = response.body?.getReader();
        if (!reader) {
          setCode('// Error: No response stream');
          if (isRefining) setCode(codeBeforeGeneration);
          return;
        }

        const decoder = new TextDecoder();
        let accumulated = '';
        let hadStreamError = false;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          accumulated += decoder.decode(value, { stream: true });

          // Detect mid-stream error sentinel from the server (C-1 fix path)
          const errIdx = accumulated.indexOf(STREAM_ERROR_SENTINEL);
          if (errIdx !== -1) {
            const errMsg = accumulated.slice(
              errIdx + STREAM_ERROR_SENTINEL.length,
            );
            const usefulSoFar = accumulated.slice(0, errIdx);
            hadStreamError = true;

            // max_tokens truncation — partial code will SyntaxError in
            // Sandpack. Don't burn the iteration; show a warning and keep the
            // pre-attempt code so the user can retry with a simpler prompt.
            if (errMsg.trim() === 'max_tokens_truncation') {
              const warning =
                '// ⚠ Generation hit token limit and was cut off.\n// Try a simpler prompt or break it into steps. Iteration was NOT consumed.';
              if (isRefining) {
                setCode(`${warning}\n\n${codeBeforeGeneration}`);
              } else {
                setCode(`${warning}\n\n${usefulSoFar}`);
              }
              // producedAnyCode stays false → no iteration spent
              break;
            }

            if (usefulSoFar.length > 100) {
              // We got partial code before the error — keep it but warn.
              setCode(
                `${usefulSoFar}\n\n// Stream interrupted: ${errMsg.trim()}`,
              );
              producedAnyCode = true;
            } else {
              setCode(`// Error: ${errMsg.trim()}\n// Please try again.`);
              if (isRefining) setCode(codeBeforeGeneration);
            }
            break;
          }

          setCode(accumulated);
        }

        if (!hadStreamError && accumulated.length > 100) {
          producedAnyCode = true;
        } else if (!hadStreamError && accumulated.length <= 100) {
          // Empty/tiny stream — treat as failure
          setCode('// Error: Empty response from AI\n// Please try again.');
          if (isRefining) setCode(codeBeforeGeneration);
        }
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Unknown error';
        setCode(`// Error: ${message}\n// Please try again.`);
        if (isRefining) setCode(codeBeforeGeneration);
      } finally {
        setIsGenerating(false);
        if (producedAnyCode) {
          setIterationCount((prev) => prev + 1);
        }
      }
    },
    [challenge, iterationCount, isGenerating, code, currentPlayer, duel],
  );

  const handleSubmit = useCallback(async () => {
    if (!supabase || !currentPlayer || phase !== 'active' || hasSubmittedRef.current) return;
    hasSubmittedRef.current = true;
    setPhase('submitted');

    // Submit code via server route (server validates player + duel state).
    await fetch('/api/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        duel_id: duelId,
        player_id: currentPlayer.id,
        code,
      }),
    });

    // Check if opponent already submitted via SELECT (which is allowed by RLS).
    const { data: allSubs } = await supabase
      .from('submissions')
      .select('id')
      .eq('duel_id', duelId);

    const bothSubmitted = allSubs && allSubs.length >= 2;
    const hasNoOpponent = !duel?.player2_id;
    const shouldScore = bothSubmitted || hasNoOpponent;

    if (shouldScore) {
      // Either player can call finalize; the route is idempotent.
      // Prefer P1 to keep determinism; P2 sets local 'judging' and lets the
      // realtime listener pick up the completed status.
      if (isPlayer1Ref.current) {
        await doScoring();
      } else {
        setPhase('judging');
      }
    }
    // Otherwise: waiting for opponent's submission — stay at 'submitted'
  }, [phase, supabase, duelId, currentPlayer, code, doScoring, duel]);

  const handleTimeUp = useCallback(async () => {
    if (hasSubmittedRef.current) return;
    hasSubmittedRef.current = true;

    if (currentPlayer) {
      await fetch('/api/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          duel_id: duelId,
          player_id: currentPlayer.id,
          code,
        }),
      });
    }

    setPhase('timesup');
    setTimeout(async () => {
      if (isPlayer1Ref.current || !duel?.player2_id) {
        await doScoring();
      } else {
        setPhase('judging');
      }
    }, 1600);
  }, [currentPlayer, duelId, code, doScoring, duel]);

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
            Duel Not Found Or Already Started
          </h2>
          <p className="text-zinc-600 text-xs font-mono">
            You can still watch as a spectator.
          </p>
          <div className="flex items-center gap-3 justify-center">
            <Link href={`/duel/${duelId}/watch`}>
              <Button>WATCH</Button>
            </Link>
            <Link href="/duel">
              <Button variant="ghost">BACK TO LOBBY</Button>
            </Link>
          </div>
        </div>
      </main>
    );
  }

  if (phase === 'invite' && challenge) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-arena-black px-4 py-12 noise">
        <div className="w-full max-w-md space-y-5 text-center">
          <p className="text-[10px] text-zinc-700 font-mono uppercase tracking-[0.3em]">
            You&apos;ve been invited to a duel
          </p>
          <h2 className="text-2xl font-black text-white uppercase tracking-tight">
            {opponent?.username ?? 'A challenger'} is waiting
          </h2>
          {opponent && (
            <p className="text-[10px] text-zinc-600 font-mono uppercase tracking-wider">
              ELO {opponent.elo}
            </p>
          )}
          <div className="text-left">
            <ChallengeCard challenge={challenge} />
          </div>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Button onClick={handleConfirmJoin}>JOIN DUEL</Button>
            <Link href={`/duel/${duelId}/watch`}>
              <Button variant="ghost">WATCH INSTEAD</Button>
            </Link>
          </div>
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
          startedAt={duel?.started_at ?? null}
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
