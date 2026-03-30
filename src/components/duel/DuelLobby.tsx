'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Button from '@/components/ui/Button';
import ChallengeCard from '@/components/duel/ChallengeCard';
import { getRandomChallenge } from '@/lib/challenges';
import { createClient } from '@/lib/supabase/client';
import { getOrCreatePlayer } from '@/lib/player';
import { findOrCreateDuel, cancelDuel } from '@/lib/matchmaking';
import type { Challenge, Player, DuelRow } from '@/types';
import type { SupabaseClient } from '@supabase/supabase-js';

type LobbyState = 'loading' | 'selecting' | 'searching' | 'found';

function useSupabase() {
  const ref = useRef<SupabaseClient | null>(null);
  if (!ref.current && typeof window !== 'undefined') {
    ref.current = createClient();
  }
  return ref.current;
}

export default function DuelLobby() {
  const router = useRouter();
  const supabase = useSupabase();
  const [player, setPlayer] = useState<Player | null>(null);
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [lobbyState, setLobbyState] = useState<LobbyState>('loading');
  const [pendingDuel, setPendingDuel] = useState<DuelRow | null>(null);
  const [dots, setDots] = useState('');
  const [copied, setCopied] = useState(false);

  // Init player + challenge
  useEffect(() => {
    if (!supabase) return;
    async function init() {
      const p = await getOrCreatePlayer(supabase!);
      setPlayer(p);
      setChallenge(getRandomChallenge());
      setLobbyState('selecting');
    }
    init();
  }, [supabase]);

  // Animate dots while searching
  useEffect(() => {
    if (lobbyState !== 'searching') return;
    const interval = setInterval(() => {
      setDots((prev) => (prev.length >= 3 ? '' : prev + '.'));
    }, 500);
    return () => clearInterval(interval);
  }, [lobbyState]);

  // Subscribe to duel updates when waiting
  useEffect(() => {
    if (!supabase || !pendingDuel || lobbyState !== 'searching') return;

    const channel = supabase
      .channel(`duel-lobby:${pendingDuel.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'duels',
          filter: `id=eq.${pendingDuel.id}`,
        },
        (payload) => {
          const updated = payload.new as DuelRow;
          if (updated.status === 'countdown' || updated.status === 'active') {
            setLobbyState('found');
            setTimeout(() => {
              router.push(`/duel/${pendingDuel.id}`);
            }, 1000);
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [pendingDuel, lobbyState, supabase, router]);

  const handleReady = useCallback(async () => {
    if (!supabase || !player || !challenge) return;
    setLobbyState('searching');

    const duel = await findOrCreateDuel(supabase, player.id, challenge.id);
    if (!duel) {
      setLobbyState('selecting');
      return;
    }

    setPendingDuel(duel);

    // If we joined an existing duel (status is countdown), go directly
    if (duel.status === 'countdown') {
      setLobbyState('found');
      setTimeout(() => {
        router.push(`/duel/${duel.id}`);
      }, 1000);
    }
    // Otherwise we created a new duel and are waiting — realtime subscription handles it
  }, [player, challenge, supabase, router]);

  const handleCancel = useCallback(async () => {
    if (supabase && pendingDuel) {
      await cancelDuel(supabase, pendingDuel.id);
      setPendingDuel(null);
    }
    setLobbyState('selecting');
  }, [pendingDuel, supabase]);

  const handleNewChallenge = () => {
    setChallenge(getRandomChallenge());
  };

  const handleCopyLink = useCallback(async () => {
    if (!pendingDuel) return;
    const url = `${window.location.origin}/duel/${pendingDuel.id}`;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [pendingDuel]);

  if (lobbyState === 'loading') {
    return (
      <main className="min-h-screen flex items-center justify-center bg-arena-black">
        <div className="text-zinc-700 font-mono text-sm uppercase tracking-wider animate-pulse">
          Initializing...
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-4 py-12 noise">
      {/* Background */}
      <div className="fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-arena-black" />
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage:
              'linear-gradient(rgba(15,244,122,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(15,244,122,0.5) 1px, transparent 1px)',
            backgroundSize: '80px 80px',
          }}
        />
        {/* Corner accents */}
        <div className="absolute top-0 left-0 w-24 h-24 border-l-2 border-t-2 border-neon-green/15" />
        <div className="absolute bottom-0 right-0 w-24 h-24 border-r-2 border-b-2 border-neon-magenta/15" />
      </div>

      <div className="w-full max-w-lg space-y-6">
        {/* Header */}
        <div className="text-center">
          <Link
            href="/"
            className="inline-block text-2xl font-black text-neon-green glow-green uppercase tracking-tight mb-3"
          >
            VibeDuel
          </Link>

          {player && (
            <p className="text-[10px] text-zinc-700 font-mono uppercase tracking-[0.2em] mb-4">
              Player:{' '}
              <span className="text-zinc-400">
                {player.username}
              </span>{' '}
              / ELO {player.elo}
            </p>
          )}

          {lobbyState === 'selecting' && (
            <h1 className="text-2xl font-black text-white uppercase tracking-tight">
              SELECT CHALLENGE
            </h1>
          )}
          {lobbyState === 'searching' && (
            <h1 className="text-2xl font-black text-neon-green uppercase tracking-tight">
              MATCHMAKING{dots}
            </h1>
          )}
          {lobbyState === 'found' && (
            <h1 className="text-2xl font-black text-neon-green glow-green uppercase tracking-tight">
              OPPONENT FOUND
            </h1>
          )}
        </div>

        {/* Challenge card */}
        {challenge && <ChallengeCard challenge={challenge} />}

        {/* Actions */}
        <div className="space-y-3">
          {lobbyState === 'selecting' && (
            <>
              <Button className="w-full" onClick={handleReady}>
                READY — FIND OPPONENT
              </Button>
              <Button
                variant="ghost"
                className="w-full"
                onClick={handleNewChallenge}
              >
                SHUFFLE CHALLENGE
              </Button>
            </>
          )}

          {lobbyState === 'searching' && (
            <div className="flex flex-col items-center gap-5 py-6">
              {/* Scanning animation */}
              <div className="relative w-16 h-16">
                <div className="absolute inset-0 border-2 border-neon-green/20 animate-ping" />
                <div className="absolute inset-0 border border-neon-green/40 flex items-center justify-center">
                  <div className="w-3 h-3 bg-neon-green animate-pulse" />
                </div>
              </div>

              <p className="text-xs text-zinc-600 font-mono uppercase tracking-wider">
                Scanning for opponents...
              </p>

              {/* Share link */}
              {pendingDuel && (
                <button
                  onClick={handleCopyLink}
                  className="text-[11px] text-neon-green/70 hover:text-neon-green transition-colors flex items-center gap-1.5 font-mono"
                >
                  <svg
                    className="w-3 h-3"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
                    />
                  </svg>
                  {copied ? 'LINK COPIED' : 'COPY INVITE LINK'}
                </button>
              )}

              <Button variant="ghost" size="sm" onClick={handleCancel}>
                CANCEL
              </Button>
            </div>
          )}

          {lobbyState === 'found' && (
            <div className="flex flex-col items-center gap-4 py-6">
              <div className="w-12 h-12 border-2 border-neon-green flex items-center justify-center box-glow-green">
                <svg
                  className="w-6 h-6 text-neon-green"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={3}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
              <p className="text-xs text-zinc-500 font-mono uppercase tracking-wider">
                Entering arena...
              </p>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
