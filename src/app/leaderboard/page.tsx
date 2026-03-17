'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import Button from '@/components/ui/Button';
import { createClient } from '@/lib/supabase/client';
import type { SupabaseClient } from '@supabase/supabase-js';

type LeaderboardEntry = {
  readonly id: string;
  readonly username: string;
  readonly elo: number;
  readonly wins: number;
  readonly losses: number;
  readonly draws: number;
};

function useSupabase() {
  const ref = useRef<SupabaseClient | null>(null);
  if (!ref.current && typeof window !== 'undefined') {
    ref.current = createClient();
  }
  return ref.current;
}

function getRankDisplay(rank: number): { label: string; style: string } {
  if (rank === 1) return { label: '01', style: 'text-neon-green glow-green' };
  if (rank === 2) return { label: '02', style: 'text-neon-cyan' };
  if (rank === 3) return { label: '03', style: 'text-neon-magenta' };
  return { label: String(rank).padStart(2, '0'), style: 'text-zinc-600' };
}

function getWinRate(wins: number, losses: number): string {
  const total = wins + losses;
  if (total === 0) return '—';
  return `${Math.round((wins / total) * 100)}%`;
}

export default function Leaderboard() {
  const supabase = useSupabase();
  const [players, setPlayers] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!supabase) return;

    const sb = supabase;
    async function load() {
      const { data } = await sb
        .from('players')
        .select('id, username, elo, wins, losses, draws')
        .order('elo', { ascending: false })
        .limit(50);

      if (data) {
        setPlayers(data as LeaderboardEntry[]);
      }
      setLoading(false);
    }

    load();
  }, [supabase]);

  return (
    <main className="min-h-screen px-4 py-12 noise">
      {/* Background */}
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
        {/* Header */}
        <div className="flex items-end justify-between mb-10">
          <div>
            <Link
              href="/"
              className="inline-block text-2xl font-black text-neon-green glow-green mb-3 uppercase tracking-tight"
            >
              VibeDuel
            </Link>
            <h1 className="text-4xl sm:text-5xl font-black text-white uppercase tracking-tight">
              RANKINGS
            </h1>
            <p className="text-xs text-zinc-700 font-mono uppercase tracking-[0.2em] mt-2">
              Top vibecoding duelers &middot; {players.length} players
            </p>
          </div>
          <Link href="/duel">
            <Button size="sm">DUEL NOW</Button>
          </Link>
        </div>

        {/* Table */}
        <div className="border border-arena-line bg-arena-dark">
          {/* Header row */}
          <div className="grid grid-cols-[3rem_1fr_5rem_3.5rem_3.5rem_3.5rem] gap-2 px-4 py-3 border-b border-arena-line text-[10px] text-zinc-700 font-mono uppercase tracking-[0.15em]">
            <span>Rank</span>
            <span>Player</span>
            <span className="text-right">ELO</span>
            <span className="text-right">W</span>
            <span className="text-right">L</span>
            <span className="text-right">WR%</span>
          </div>

          {loading ? (
            <div className="px-4 py-8 text-center">
              <p className="text-zinc-700 font-mono text-xs uppercase tracking-wider animate-pulse">
                Loading rankings...
              </p>
            </div>
          ) : players.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <p className="text-zinc-700 font-mono text-xs uppercase tracking-wider">
                No players yet. Be the first to duel!
              </p>
            </div>
          ) : (
            players.map((entry, index) => {
              const rankNum = index + 1;
              const rank = getRankDisplay(rankNum);
              const isTopThree = rankNum <= 3;

              return (
                <div
                  key={entry.id}
                  className={`grid grid-cols-[3rem_1fr_5rem_3.5rem_3.5rem_3.5rem] gap-2 px-4 py-3 border-b border-arena-line/50 last:border-b-0 hover:bg-arena-mid/30 transition-colors ${
                    isTopThree ? 'bg-arena-mid/20' : ''
                  }`}
                >
                  <span
                    className={`text-sm font-mono font-bold ${rank.style}`}
                  >
                    {rank.label}
                  </span>

                  <div className="flex items-center gap-2.5">
                    <div
                      className={`w-6 h-6 flex items-center justify-center text-[10px] font-mono font-bold border ${
                        rankNum === 1
                          ? 'border-neon-green/40 text-neon-green'
                          : rankNum === 2
                            ? 'border-neon-cyan/40 text-neon-cyan'
                            : rankNum === 3
                              ? 'border-neon-magenta/40 text-neon-magenta'
                              : 'border-arena-line text-zinc-600'
                      }`}
                    >
                      {entry.username.charAt(0).toUpperCase()}
                    </div>
                    <span
                      className={`text-sm font-mono ${isTopThree ? 'text-white font-bold' : 'text-zinc-400'}`}
                    >
                      {entry.username}
                    </span>
                  </div>

                  <span className="text-sm text-right font-mono text-neon-green tabular-nums">
                    {entry.elo}
                  </span>

                  <span className="text-sm text-right font-mono text-zinc-400 tabular-nums">
                    {entry.wins}
                  </span>

                  <span className="text-sm text-right font-mono text-zinc-600 tabular-nums">
                    {entry.losses}
                  </span>

                  <span className="text-sm text-right font-mono text-zinc-500 tabular-nums">
                    {getWinRate(entry.wins, entry.losses)}
                  </span>
                </div>
              );
            })
          )}
        </div>

        <p className="text-center text-[10px] text-zinc-800 mt-6 font-mono uppercase tracking-wider">
          Rankings update after each duel. ELO-based matchmaking active.
        </p>
      </div>
    </main>
  );
}
