'use client';

import { useEffect, useRef, useState } from 'react';

type TimerProps = {
  /** Total duration in seconds. Used as a fallback when startedAt is null. */
  readonly initialSeconds: number;
  /**
   * Wall-clock anchor for when the duel went active (Date.now() ms or ISO).
   * If provided, the timer computes remaining seconds from
   * (startedAt + initialSeconds) - Date.now(), making the value identical
   * across clients regardless of when each one mounted.
   */
  readonly startedAt?: string | number | null;
  readonly onComplete?: () => void;
  readonly isRunning?: boolean;
};

function formatTime(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function computeRemaining(
  initialSeconds: number,
  startedAt: string | number | null | undefined,
): number {
  if (startedAt == null) return initialSeconds;
  const startMs = typeof startedAt === 'number' ? startedAt : Date.parse(startedAt);
  if (Number.isNaN(startMs)) return initialSeconds;
  const elapsed = (Date.now() - startMs) / 1000;
  return Math.max(0, Math.ceil(initialSeconds - elapsed));
}

export default function Timer({
  initialSeconds,
  startedAt,
  onComplete,
  isRunning = false,
}: TimerProps) {
  const [seconds, setSeconds] = useState(() =>
    computeRemaining(initialSeconds, startedAt),
  );
  const completedRef = useRef(false);

  useEffect(() => {
    if (!isRunning) return;
    // Tick every 250ms. The displayed value still moves once per second
    // because we floor to whole seconds, but the higher tick rate keeps the
    // server-clock sync tight even after backgrounded-tab throttling.
    const tick = () => {
      const remaining = computeRemaining(initialSeconds, startedAt);
      setSeconds(remaining);
      if (remaining <= 0 && !completedRef.current) {
        completedRef.current = true;
        onComplete?.();
      }
    };
    tick();
    const interval = setInterval(tick, 250);
    return () => clearInterval(interval);
  }, [isRunning, initialSeconds, startedAt, onComplete]);

  // Re-arm if the parent recreates with a fresh anchor
  useEffect(() => {
    completedRef.current = false;
  }, [startedAt]);

  const isWarning = seconds <= 30 && seconds > 10;
  const isUrgent = seconds <= 10 && seconds > 0;
  const isExpired = seconds === 0;

  let colorClass = 'text-neon-green glow-green';
  if (isExpired) colorClass = 'text-neon-magenta glow-magenta';
  else if (isUrgent) colorClass = 'text-neon-magenta glow-magenta';
  else if (isWarning) colorClass = 'text-amber-400';

  return (
    <div
      className={`
        font-mono text-2xl font-bold tabular-nums
        ${colorClass}
        ${isUrgent ? 'animate-pulse' : ''}
        transition-colors duration-300
      `}
    >
      {isExpired ? "TIME'S UP" : formatTime(seconds)}
    </div>
  );
}
