'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import LivePreview from '@/components/duel/LivePreview';
import DuelTimer from '@/components/duel/DuelTimer';
import { createClient } from '@/lib/supabase/client';
import { fetchDuel, fetchDuelPlayers } from '@/lib/matchmaking';
import { getChallengeById } from '@/lib/challenges';
import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  Challenge,
  Player,
  DuelRow,
  SubmissionRow,
  OpponentProgress,
} from '@/types';

function useSupabase() {
  const ref = useRef<SupabaseClient | null>(null);
  if (!ref.current && typeof window !== 'undefined') {
    ref.current = createClient();
  }
  return ref.current;
}

export default function SpectatorView() {
  const params = useParams();
  const duelId = params.id as string;
  const supabase = useSupabase();

  const [duel, setDuel] = useState<DuelRow | null>(null);
  const [players, setPlayers] = useState<{ p1: Player | null; p2: Player | null }>({
    p1: null,
    p2: null,
  });
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [submissions, setSubmissions] = useState<{
    s1: SubmissionRow | null;
    s2: SubmissionRow | null;
  }>({ s1: null, s2: null });
  const [progress, setProgress] = useState<Record<string, OpponentProgress>>({});
  const [notFound, setNotFound] = useState(false);

  // Load
  useEffect(() => {
    if (!supabase) return;
    const sb = supabase;
    (async () => {
      const d = await fetchDuel(sb, duelId);
      if (!d) {
        setNotFound(true);
        return;
      }
      setDuel(d);
      const ch = getChallengeById(d.challenge_id);
      setChallenge(ch ?? null);
      const { player1, player2 } = await fetchDuelPlayers(sb, d);
      setPlayers({ p1: player1, p2: player2 });
      const { data: subs } = await sb
        .from('submissions')
        .select('*')
        .eq('duel_id', duelId);
      const s1 = (subs ?? []).find((s) => s.player_id === d.player1_id) ?? null;
      const s2 = (subs ?? []).find((s) => s.player_id === d.player2_id) ?? null;
      setSubmissions({ s1, s2 });
    })();
  }, [supabase, duelId]);

  // Realtime — duel + submissions
  useEffect(() => {
    if (!supabase || !duel) return;
    const sb = supabase;
    const channel = sb
      .channel(`spectate:${duelId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'duels',
          filter: `id=eq.${duelId}`,
        },
        (payload) => setDuel(payload.new as DuelRow),
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'submissions',
          filter: `duel_id=eq.${duelId}`,
        },
        async () => {
          const { data: subs } = await sb
            .from('submissions')
            .select('*')
            .eq('duel_id', duelId);
          const s1 =
            (subs ?? []).find((s) => s.player_id === duel.player1_id) ?? null;
          const s2 =
            (subs ?? []).find((s) => s.player_id === duel.player2_id) ?? null;
          setSubmissions({ s1, s2 });
        },
      )
      .subscribe();

    // Same broadcast channel the duel room itself uses for live progress.
    // We listen but never send — spectators are read-only.
    const progressChannel = sb
      .channel(`progress:${duelId}`)
      .on('broadcast', { event: 'progress' }, ({ payload }) => {
        const p = payload as OpponentProgress;
        if (!p?.playerId) return;
        setProgress((prev) => ({ ...prev, [p.playerId]: p }));
      })
      .subscribe();

    return () => {
      sb.removeChannel(channel);
      sb.removeChannel(progressChannel);
    };
  }, [supabase, duel, duelId]);

  if (notFound) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-arena-black px-4">
        <div className="text-center space-y-4">
          <h2 className="text-xl font-black text-white uppercase tracking-tight">
            Duel Not Found
          </h2>
          <Link href="/duel">
            <Button>BACK TO LOBBY</Button>
          </Link>
        </div>
      </main>
    );
  }

  if (!duel || !challenge) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-arena-black">
        <div className="text-zinc-700 font-mono text-sm uppercase tracking-wider animate-pulse">
          Loading duel...
        </div>
      </main>
    );
  }

  const isActive = duel.status === 'active';
  const isComplete = duel.status === 'complete';

  return (
    <main className="h-screen flex flex-col bg-arena-black overflow-hidden">
      <header className="flex-shrink-0 flex items-center justify-between px-4 py-2 border-b border-arena-line bg-arena-dark/80">
        <div className="flex items-center gap-3 min-w-0">
          <Link
            href="/"
            className="text-sm font-black text-neon-green uppercase tracking-tight"
          >
            VD
          </Link>
          <div className="w-px h-4 bg-arena-line" />
          <div className="flex items-center gap-2">
            <Badge variant="default">SPECTATING</Badge>
            <h1 className="text-xs font-mono font-bold text-white uppercase">
              {challenge.title}
            </h1>
            <Badge variant={challenge.difficulty}>{challenge.difficulty}</Badge>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {isActive ? (
            <DuelTimer
              seconds={challenge.timeLimit}
              startedAt={duel.started_at ?? null}
              isRunning
            />
          ) : (
            <span className="text-[10px] text-zinc-600 font-mono uppercase tracking-wider">
              {duel.status}
            </span>
          )}
        </div>
      </header>

      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        <PlayerPane
          side="left"
          player={players.p1}
          submission={submissions.s1}
          progress={players.p1 ? progress[players.p1.id] ?? null : null}
          isWinner={isComplete && duel.winner_id === duel.player1_id}
          isLive={isActive}
        />
        <div className="hidden lg:block w-px bg-arena-line" />
        <PlayerPane
          side="right"
          player={players.p2}
          submission={submissions.s2}
          progress={players.p2 ? progress[players.p2.id] ?? null : null}
          isWinner={isComplete && duel.winner_id === duel.player2_id}
          isLive={isActive}
        />
      </div>
    </main>
  );
}

function PlayerPane({
  side,
  player,
  submission,
  progress,
  isWinner,
  isLive,
}: {
  readonly side: 'left' | 'right';
  readonly player: Player | null;
  readonly submission: SubmissionRow | null;
  readonly progress: OpponentProgress | null;
  readonly isWinner: boolean;
  readonly isLive: boolean;
}) {
  // Static class names — Tailwind's JIT won't compile interpolated tokens
  // like `border-${accent}/40`, so the avatar's color was silently missing.
  const avatarClass =
    side === 'left'
      ? 'border-neon-green/40 text-neon-green'
      : 'border-neon-magenta/40 text-neon-magenta';
  const status = progress?.status ?? 'idle';
  return (
    <div className="flex-1 flex flex-col min-h-0 p-3 gap-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div
            className={`w-7 h-7 border ${avatarClass} bg-arena-mid flex items-center justify-center text-[10px] font-mono font-bold`}
          >
            {player?.username.charAt(0).toUpperCase() ?? '?'}
          </div>
          <div>
            <p className="text-xs font-mono font-bold text-white">
              {player?.username ?? 'Waiting…'}
            </p>
            {player && (
              <p className="text-[9px] text-zinc-700 font-mono">
                ELO {player.elo}
              </p>
            )}
          </div>
          {isWinner && (
            <span className="text-[10px] text-neon-green font-mono font-bold border border-neon-green/40 px-2 py-0.5">
              WINNER
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {isLive && progress && (
            <span
              className={`text-[10px] font-mono tabular-nums ${
                status === 'submitted'
                  ? 'text-neon-green'
                  : status === 'coding'
                    ? 'text-amber-400'
                    : 'text-zinc-700'
              }`}
            >
              {status === 'submitted'
                ? 'DONE'
                : `ITR ${progress.iterationCount}/5`}
            </span>
          )}
          {submission?.score != null && (
            <span className="text-sm font-black text-neon-green tabular-nums font-mono">
              {submission.score}
            </span>
          )}
        </div>
      </div>
      <div className="flex-1 min-h-0 border border-arena-line bg-arena-dark overflow-hidden">
        <LivePreview code={submission?.code ?? ''} />
      </div>
    </div>
  );
}
