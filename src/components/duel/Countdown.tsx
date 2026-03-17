'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

type CountdownProps = {
  readonly onComplete: () => void;
  readonly challengeTitle: string;
};

export default function Countdown({
  onComplete,
  challengeTitle,
}: CountdownProps) {
  const [count, setCount] = useState(3);
  const [phase, setPhase] = useState<'counting' | 'go' | 'done'>('counting');

  useEffect(() => {
    if (phase === 'done') return;

    if (phase === 'go') {
      const timer = setTimeout(() => {
        setPhase('done');
        onComplete();
      }, 800);
      return () => clearTimeout(timer);
    }

    if (count <= 0) {
      setPhase('go');
      return;
    }

    const timer = setTimeout(() => {
      setCount((prev) => prev - 1);
    }, 1000);

    return () => clearTimeout(timer);
  }, [count, phase, onComplete]);

  if (phase === 'done') return null;

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center bg-arena-black noise scanlines"
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
    >
      {/* Grid background */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(15,244,122,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(15,244,122,0.5) 1px, transparent 1px)',
          backgroundSize: '60px 60px',
        }}
      />

      {/* Corner brackets */}
      <div className="absolute top-8 left-8 w-16 h-16 border-t-2 border-l-2 border-neon-green/30" />
      <div className="absolute top-8 right-8 w-16 h-16 border-t-2 border-r-2 border-neon-magenta/30" />
      <div className="absolute bottom-8 left-8 w-16 h-16 border-b-2 border-l-2 border-neon-green/30" />
      <div className="absolute bottom-8 right-8 w-16 h-16 border-b-2 border-r-2 border-neon-magenta/30" />

      <div className="relative text-center space-y-6">
        <p className="text-zinc-600 text-xs font-mono uppercase tracking-[0.3em]">
          Duel Starting
        </p>

        <AnimatePresence mode="wait">
          {phase === 'counting' ? (
            <motion.div
              key={count}
              initial={{ scale: 0.3, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 2, opacity: 0 }}
              transition={{ duration: 0.4, ease: 'easeOut' }}
              className="text-[12rem] font-black text-white tabular-nums leading-none glow-green"
              style={{
                textShadow:
                  '0 0 30px rgba(15, 244, 122, 0.4), 0 0 80px rgba(15, 244, 122, 0.15)',
              }}
            >
              {count}
            </motion.div>
          ) : (
            <motion.div
              key="go"
              initial={{ scale: 0.3, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 2, opacity: 0 }}
              transition={{ duration: 0.4, ease: 'easeOut' }}
              className="relative"
            >
              {/* Glow burst */}
              <div className="absolute inset-0 flex items-center justify-center">
                <motion.div
                  initial={{ scale: 0.5, opacity: 0.8 }}
                  animate={{ scale: 4, opacity: 0 }}
                  transition={{ duration: 0.8 }}
                  className="w-32 h-32 bg-neon-green/20 blur-xl"
                />
              </div>
              <span
                className="relative text-[12rem] font-black text-neon-green leading-none"
                style={{
                  textShadow:
                    '0 0 40px rgba(15, 244, 122, 0.6), 0 0 120px rgba(15, 244, 122, 0.2)',
                }}
              >
                GO
              </span>
            </motion.div>
          )}
        </AnimatePresence>

        <p className="text-zinc-600 text-xs font-mono">{challengeTitle}</p>
      </div>
    </motion.div>
  );
}
