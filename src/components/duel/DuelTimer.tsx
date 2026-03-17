'use client';

import { useState } from 'react';
import Timer from '@/components/ui/Timer';
import { motion, AnimatePresence } from 'framer-motion';

type DuelTimerProps = {
  readonly seconds: number;
  readonly isRunning?: boolean;
  readonly onComplete?: () => void;
};

export default function DuelTimer({
  seconds,
  isRunning = false,
  onComplete,
}: DuelTimerProps) {
  const [showFlash, setShowFlash] = useState(false);

  const handleComplete = () => {
    setShowFlash(true);
    setTimeout(() => {
      setShowFlash(false);
      onComplete?.();
    }, 1500);
  };

  return (
    <div className="flex flex-col items-center gap-1 relative">
      <span className="text-[10px] text-zinc-700 font-mono uppercase tracking-[0.2em]">
        Time
      </span>
      <Timer
        initialSeconds={seconds}
        isRunning={isRunning}
        onComplete={handleComplete}
      />

      {/* TIME'S UP flash overlay */}
      <AnimatePresence>
        {showFlash && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.2 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-arena-black/95 noise"
          >
            <motion.div
              initial={{ scale: 0.5 }}
              animate={{ scale: [0.5, 1.1, 1] }}
              transition={{ duration: 0.5 }}
              className="text-center"
            >
              <div
                className="text-7xl font-black text-neon-magenta uppercase"
                style={{
                  textShadow:
                    '0 0 30px rgba(255, 51, 102, 0.5), 0 0 80px rgba(255, 51, 102, 0.2)',
                }}
              >
                TIME&apos;S UP
              </div>
              <p className="text-zinc-600 mt-4 font-mono text-sm">
                Submitting your solution...
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
