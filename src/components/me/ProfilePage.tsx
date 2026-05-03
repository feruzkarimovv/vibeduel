'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import Link from 'next/link';
import Button from '@/components/ui/Button';
import { createClient } from '@/lib/supabase/client';
import { getOrCreatePlayer, getSession, signOut } from '@/lib/auth';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Player } from '@/types';

function useSupabase() {
  const ref = useRef<SupabaseClient | null>(null);
  if (!ref.current && typeof window !== 'undefined') {
    ref.current = createClient();
  }
  return ref.current;
}

type DuelPoint = {
  readonly id: string;
  readonly endedAt: string;
  readonly eloAfter: number;
  readonly outcome: 'W' | 'L' | 'D';
};

export default function ProfilePage() {
  const supabase = useSupabase();
  const [player, setPlayer] = useState<Player | null>(null);
  const [history, setHistory] = useState<DuelPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAuthed, setIsAuthed] = useState(false);

  useEffect(() => {
    if (!supabase) return;
    const sb = supabase;
    (async () => {
      const session = await getSession(sb);
      setIsAuthed(!!session);

      const p = await getOrCreatePlayer(sb);
      if (!p) {
        setLoading(false);
        return;
      }
      setPlayer(p);

      // ELO history: query completed duels involving this player, oldest → newest.
      const { data: rows } = await sb
        .from('duels')
        .select(
          'id, ended_at, winner_id, player1_id, player2_id, player1_elo_after, player2_elo_after',
        )
        .or(`player1_id.eq.${p.id},player2_id.eq.${p.id}`)
        .eq('status', 'complete')
        .not('ended_at', 'is', null)
        .order('ended_at', { ascending: true });

      const points: DuelPoint[] = (rows ?? [])
        .map((r) => {
          const isP1 = r.player1_id === p.id;
          const eloAfter = isP1 ? r.player1_elo_after : r.player2_elo_after;
          if (eloAfter == null) return null;
          const outcome: 'W' | 'L' | 'D' =
            r.winner_id == null
              ? 'D'
              : r.winner_id === p.id
                ? 'W'
                : 'L';
          return {
            id: r.id,
            endedAt: r.ended_at!,
            eloAfter,
            outcome,
          };
        })
        .filter((x): x is DuelPoint => x !== null);

      setHistory(points);
      setLoading(false);
    })();
  }, [supabase]);

  const stats = useMemo(() => {
    if (!player) return null;
    const wins = player.wins ?? 0;
    const losses = player.losses ?? 0;
    const draws = player.draws ?? 0;
    const total = wins + losses + draws;
    const winRate = total > 0 ? Math.round((wins / total) * 100) : 0;
    return { total, winRate };
  }, [player]);

  return (
    <main className="min-h-screen px-4 py-12 noise bg-arena-black">
      <div className="fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-arena-black" />
        <div
          className="absolute inset-0 opacity-[0.02]"
          style={{
            backgroundImage:
              'linear-gradient(rgba(15,244,122,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(15,244,122,0.5) 1px, transparent 1px)',
            backgroundSize: '80px 80px',
          }}
        />
      </div>

      <div className="max-w-3xl mx-auto">
        <div className="flex items-end justify-between mb-10">
          <div>
            <Link
              href="/"
              className="inline-block text-2xl font-black text-neon-green glow-green mb-3 uppercase tracking-tight"
            >
              VibeDuel
            </Link>
            <h1 className="text-4xl sm:text-5xl font-black text-white uppercase tracking-tight">
              PROFILE
            </h1>
            {!isAuthed && (
              <p className="text-xs text-amber-400 font-mono uppercase tracking-wider mt-2">
                Playing as guest. Stats may be lost if you clear browser data.
              </p>
            )}
          </div>
          <div className="flex gap-2">
            <Link href="/duel">
              <Button size="sm">DUEL</Button>
            </Link>
            {isAuthed ? (
              <Button
                size="sm"
                variant="ghost"
                onClick={async () => {
                  if (!supabase) return;
                  await signOut(supabase);
                  window.location.href = '/';
                }}
              >
                SIGN OUT
              </Button>
            ) : (
              <Link href="/auth?mode=signup">
                <Button size="sm" variant="ghost">SIGN UP</Button>
              </Link>
            )}
          </div>
        </div>

        {loading ? (
          <p className="text-zinc-700 font-mono text-xs uppercase tracking-wider animate-pulse">
            Loading...
          </p>
        ) : !player ? (
          <p className="text-zinc-600 font-mono text-xs">No player found.</p>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-10">
              <Stat label="Username" value={player.username} accent="white" />
              <Stat label="ELO" value={String(player.elo)} accent="green" />
              <Stat label="Record" value={`${player.wins ?? 0}-${player.losses ?? 0}-${player.draws ?? 0}`} />
              <Stat label="Win Rate" value={`${stats?.winRate ?? 0}%`} />
            </div>

            <div className="border border-arena-line bg-arena-dark p-6 mb-6">
              <div className="flex items-center justify-between mb-4">
                <p className="text-[10px] text-zinc-600 font-mono uppercase tracking-[0.2em]">
                  ELO History
                </p>
                <p className="text-[10px] text-zinc-700 font-mono">
                  {history.length} duel{history.length === 1 ? '' : 's'}
                </p>
              </div>
              {history.length === 0 ? (
                <p className="text-zinc-700 font-mono text-xs uppercase tracking-wider py-12 text-center">
                  No completed duels yet
                </p>
              ) : (
                <EloChart points={history} startElo={1200} />
              )}
            </div>

            {history.length > 0 && (
              <div className="border border-arena-line bg-arena-dark">
                <div className="grid grid-cols-[3rem_1fr_4rem_5rem] gap-2 px-4 py-3 border-b border-arena-line text-[10px] text-zinc-700 font-mono uppercase tracking-[0.15em]">
                  <span>#</span>
                  <span>Date</span>
                  <span>Result</span>
                  <span className="text-right">ELO</span>
                </div>
                {history
                  .slice()
                  .reverse()
                  .slice(0, 20)
                  .map((p, i) => (
                    <div
                      key={p.id}
                      className="grid grid-cols-[3rem_1fr_4rem_5rem] gap-2 px-4 py-2.5 border-b border-arena-line/50 last:border-b-0 text-xs font-mono"
                    >
                      <span className="text-zinc-700">{history.length - i}</span>
                      <span className="text-zinc-500">
                        {new Date(p.endedAt).toLocaleDateString()}
                      </span>
                      <span
                        className={
                          p.outcome === 'W'
                            ? 'text-neon-green'
                            : p.outcome === 'L'
                              ? 'text-neon-magenta'
                              : 'text-zinc-500'
                        }
                      >
                        {p.outcome}
                      </span>
                      <span className="text-right text-neon-green tabular-nums">
                        {p.eloAfter}
                      </span>
                    </div>
                  ))}
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}

function Stat({
  label,
  value,
  accent = 'zinc',
}: {
  readonly label: string;
  readonly value: string;
  readonly accent?: 'green' | 'white' | 'zinc';
}) {
  const color =
    accent === 'green'
      ? 'text-neon-green glow-green'
      : accent === 'white'
        ? 'text-white'
        : 'text-zinc-300';
  return (
    <div className="border border-arena-line bg-arena-dark p-4">
      <p className="text-[10px] text-zinc-700 font-mono uppercase tracking-[0.2em] mb-2">
        {label}
      </p>
      <p className={`text-xl sm:text-2xl font-black tabular-nums ${color}`}>
        {value}
      </p>
    </div>
  );
}

function EloChart({
  points,
  startElo,
}: {
  readonly points: readonly DuelPoint[];
  readonly startElo: number;
}) {
  if (points.length === 0) return null;
  const all = [startElo, ...points.map((p) => p.eloAfter)];
  const min = Math.min(...all) - 20;
  const max = Math.max(...all) + 20;
  const W = 600;
  const H = 200;
  const PAD = 24;
  const xStep = (W - PAD * 2) / Math.max(all.length - 1, 1);
  const yScale = (v: number) =>
    PAD + (H - PAD * 2) * (1 - (v - min) / Math.max(max - min, 1));
  const xAt = (i: number) => PAD + i * xStep;

  const path = all
    .map((v, i) => `${i === 0 ? 'M' : 'L'}${xAt(i).toFixed(1)} ${yScale(v).toFixed(1)}`)
    .join(' ');

  return (
    <div className="overflow-x-auto">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full h-[200px]"
        preserveAspectRatio="none"
      >
        {/* horizontal grid */}
        {[0.25, 0.5, 0.75].map((f) => (
          <line
            key={f}
            x1={PAD}
            x2={W - PAD}
            y1={PAD + (H - PAD * 2) * f}
            y2={PAD + (H - PAD * 2) * f}
            stroke="rgba(255,255,255,0.05)"
            strokeWidth={1}
          />
        ))}
        {/* min/max labels */}
        <text x={4} y={yScale(max) + 4} fill="#666" fontSize={10} fontFamily="monospace">
          {max}
        </text>
        <text x={4} y={yScale(min) + 4} fill="#666" fontSize={10} fontFamily="monospace">
          {min}
        </text>

        {/* line */}
        <path d={path} fill="none" stroke="#0ff47a" strokeWidth={2} />

        {/* dots */}
        {points.map((p, i) => {
          const x = xAt(i + 1);
          const y = yScale(p.eloAfter);
          const fill =
            p.outcome === 'W' ? '#0ff47a' : p.outcome === 'L' ? '#ff3366' : '#888';
          return (
            <circle key={p.id} cx={x} cy={y} r={3} fill={fill}>
              <title>{`${new Date(p.endedAt).toLocaleString()} — ${p.outcome} — ${p.eloAfter}`}</title>
            </circle>
          );
        })}
      </svg>
    </div>
  );
}
