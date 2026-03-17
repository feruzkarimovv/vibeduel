'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import Button from '@/components/ui/Button';
import type { Player } from '@/types';
import type { ScoringResult, ScoreBreakdown } from '@/lib/scoring';

type ResultsScreenProps = {
  readonly currentPlayer: Player;
  readonly opponent: Player | null;
  readonly scores: ScoringResult | null;
  readonly isPlayer1: boolean;
};

type RevealPhase = 'intro' | 'scores' | 'winner' | 'details';

const CATEGORIES: { key: keyof ScoreBreakdown; label: string }[] = [
  { key: 'functionality', label: 'FUNCTION' },
  { key: 'visual_design', label: 'DESIGN' },
  { key: 'creativity', label: 'CREATIVE' },
  { key: 'code_quality', label: 'CODE' },
  { key: 'completeness', label: 'COMPLETE' },
];

function ScoreBar({
  value,
  max,
  color,
  delay,
}: {
  readonly value: number;
  readonly max: number;
  readonly color: string;
  readonly delay: number;
}) {
  return (
    <div className="flex items-center gap-2">
      <div className="w-24 h-1.5 bg-arena-line overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${(value / max) * 100}%` }}
          transition={{ duration: 0.8, delay, ease: 'easeOut' }}
          className={`h-full ${color}`}
        />
      </div>
      <motion.span
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: delay + 0.5 }}
        className="text-xs font-mono tabular-nums text-zinc-400 w-6 text-right"
      >
        {value}
      </motion.span>
    </div>
  );
}

function PlayerScoreCard({
  player,
  breakdown,
  isYou,
  isWinner,
  side,
}: {
  readonly player: Player;
  readonly breakdown: ScoreBreakdown;
  readonly isYou: boolean;
  readonly isWinner: boolean;
  readonly side: 'left' | 'right';
}) {
  const borderColor = isWinner ? 'border-neon-green/40' : 'border-arena-line';
  const glowClass = isWinner ? 'box-glow-green' : '';
  const barColor = side === 'left' ? 'bg-neon-green' : 'bg-neon-magenta';

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: side === 'left' ? 0.3 : 0.5 }}
      className={`border ${borderColor} ${glowClass} bg-arena-dark p-5 flex-1`}
    >
      {/* Player header */}
      <div className="flex items-center gap-3 mb-4">
        <div
          className={`w-8 h-8 border ${
            side === 'left' ? 'border-neon-green/40 text-neon-green' : 'border-neon-magenta/40 text-neon-magenta'
          } bg-arena-mid flex items-center justify-center text-xs font-mono font-bold`}
        >
          {player.username.charAt(0).toUpperCase()}
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-white font-mono">
              {player.username}
            </span>
            {isYou && (
              <span className="text-[9px] text-zinc-600 font-mono border border-zinc-800 px-1">
                YOU
              </span>
            )}
          </div>
          <span className="text-[10px] text-zinc-700 font-mono">
            [{player.elo}]
          </span>
        </div>
        {isWinner && (
          <span className="ml-auto text-[10px] text-neon-green font-mono font-bold border border-neon-green/30 px-2 py-0.5">
            WINNER
          </span>
        )}
      </div>

      {/* Total score */}
      <div className="mb-4">
        <motion.div
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.5, delay: side === 'left' ? 0.8 : 1.0 }}
          className={`text-4xl font-black tabular-nums ${
            isWinner ? 'text-neon-green glow-green' : 'text-zinc-400'
          }`}
        >
          {breakdown.total}
          <span className="text-lg text-zinc-600">/100</span>
        </motion.div>
      </div>

      {/* Category breakdown */}
      <div className="space-y-2">
        {CATEGORIES.map((cat, i) => {
          const value = breakdown[cat.key];
          if (typeof value !== 'number') return null;
          return (
            <div key={cat.key} className="flex items-center justify-between">
              <span className="text-[10px] text-zinc-600 font-mono w-16">
                {cat.label}
              </span>
              <ScoreBar
                value={value}
                max={20}
                color={barColor}
                delay={1.2 + i * 0.15}
              />
            </div>
          );
        })}
      </div>

      {/* Feedback */}
      {breakdown.feedback && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 2.5 }}
          className="mt-4 pt-3 border-t border-arena-line text-xs text-zinc-500 font-mono italic"
        >
          &quot;{breakdown.feedback}&quot;
        </motion.p>
      )}
    </motion.div>
  );
}

export default function ResultsScreen({
  currentPlayer,
  opponent,
  scores,
  isPlayer1,
}: ResultsScreenProps) {
  const [revealPhase, setRevealPhase] = useState<RevealPhase>('intro');

  useEffect(() => {
    if (!scores) return;
    const timers = [
      setTimeout(() => setRevealPhase('scores'), 1500),
      setTimeout(() => setRevealPhase('winner'), 3000),
      setTimeout(() => setRevealPhase('details'), 4000),
    ];
    return () => timers.forEach(clearTimeout);
  }, [scores]);

  if (!scores) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-arena-black noise scanlines">
        <div
          className="fixed inset-0 -z-10 opacity-[0.02]"
          style={{
            backgroundImage:
              'linear-gradient(rgba(15,244,122,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(15,244,122,0.5) 1px, transparent 1px)',
            backgroundSize: '60px 60px',
          }}
        />
        <div className="text-center space-y-5">
          <div className="w-16 h-16 border border-neon-magenta/40 flex items-center justify-center mx-auto animate-spin">
            <div className="w-3 h-3 bg-neon-magenta" />
          </div>
          <h2 className="text-2xl font-black text-white uppercase tracking-tight">
            AI JUDGING
          </h2>
          <p className="text-zinc-600 font-mono text-xs uppercase tracking-wider">
            Evaluating both submissions...
          </p>
          <p className="text-zinc-800 font-mono text-[10px]">
            This may take 10-15 seconds
          </p>
        </div>
      </div>
    );
  }

  const myScores = isPlayer1 ? scores.player1 : scores.player2;
  const theirScores = isPlayer1 ? scores.player2 : scores.player1;
  const didWin =
    (isPlayer1 && scores.winner === 'player1') ||
    (!isPlayer1 && scores.winner === 'player2');
  const isDraw = scores.winner === 'draw';

  return (
    <div className="min-h-screen bg-arena-black noise scanlines flex flex-col">
      {/* Grid background */}
      <div
        className="fixed inset-0 -z-10 opacity-[0.02]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(15,244,122,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(15,244,122,0.5) 1px, transparent 1px)',
          backgroundSize: '60px 60px',
        }}
      />

      {/* Corner brackets */}
      <div className="fixed top-4 left-4 w-8 h-8 border-t border-l border-neon-green/20 z-10" />
      <div className="fixed top-4 right-4 w-8 h-8 border-t border-r border-neon-magenta/20 z-10" />
      <div className="fixed bottom-4 left-4 w-8 h-8 border-b border-l border-neon-green/20 z-10" />
      <div className="fixed bottom-4 right-4 w-8 h-8 border-b border-r border-neon-magenta/20 z-10" />

      <div className="flex-1 flex flex-col items-center justify-center px-4 py-12 max-w-4xl mx-auto w-full">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center mb-8"
        >
          <div className="text-[10px] text-zinc-700 font-mono uppercase tracking-[0.3em] mb-3">
            Duel Results
          </div>

          <AnimatePresence mode="wait">
            {revealPhase === 'intro' && (
              <motion.div
                key="intro"
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 1.2, opacity: 0 }}
                className="text-5xl sm:text-7xl font-black text-white uppercase tracking-tight"
              >
                JUDGING
                <span className="animate-pulse">...</span>
              </motion.div>
            )}

            {(revealPhase === 'scores' || revealPhase === 'winner' || revealPhase === 'details') && (
              <motion.div
                key="result"
                initial={{ scale: 0.3, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', damping: 12 }}
              >
                {isDraw ? (
                  <div
                    className="text-5xl sm:text-7xl font-black text-white uppercase tracking-tight"
                    style={{
                      textShadow: '0 0 30px rgba(255,255,255,0.2)',
                    }}
                  >
                    DRAW
                  </div>
                ) : didWin ? (
                  <div
                    className="text-5xl sm:text-7xl font-black text-neon-green uppercase tracking-tight"
                    style={{
                      textShadow:
                        '0 0 40px rgba(15, 244, 122, 0.5), 0 0 100px rgba(15, 244, 122, 0.2)',
                    }}
                  >
                    VICTORY
                  </div>
                ) : (
                  <div
                    className="text-5xl sm:text-7xl font-black text-neon-magenta uppercase tracking-tight"
                    style={{
                      textShadow:
                        '0 0 40px rgba(255, 51, 102, 0.5), 0 0 100px rgba(255, 51, 102, 0.2)',
                    }}
                  >
                    DEFEAT
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Commentary */}
        {revealPhase === 'details' && scores.commentary && (
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="text-center text-sm text-zinc-400 font-mono mb-8 max-w-lg"
          >
            &quot;{scores.commentary}&quot;
          </motion.p>
        )}

        {/* Score cards */}
        {(revealPhase === 'scores' || revealPhase === 'winner' || revealPhase === 'details') && (
          <div className="flex flex-col sm:flex-row gap-4 w-full mb-8">
            <PlayerScoreCard
              player={currentPlayer}
              breakdown={myScores}
              isYou={true}
              isWinner={didWin}
              side="left"
            />

            {/* VS divider */}
            <div className="hidden sm:flex flex-col items-center justify-center px-2">
              <div className="w-8 h-8 border border-zinc-800 bg-arena-black rotate-45 flex items-center justify-center">
                <span className="text-xs font-black -rotate-45 text-zinc-600">
                  VS
                </span>
              </div>
            </div>

            {opponent && (
              <PlayerScoreCard
                player={opponent}
                breakdown={theirScores}
                isYou={false}
                isWinner={!didWin && !isDraw}
                side="right"
              />
            )}
          </div>
        )}

        {/* Actions */}
        {revealPhase === 'details' && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="flex flex-col sm:flex-row items-center gap-3"
          >
            <Link href="/duel">
              <Button>REMATCH</Button>
            </Link>
            <Link href="/leaderboard">
              <Button variant="ghost">RANKINGS</Button>
            </Link>
            <Link href="/">
              <Button variant="ghost">HOME</Button>
            </Link>
          </motion.div>
        )}
      </div>
    </div>
  );
}
