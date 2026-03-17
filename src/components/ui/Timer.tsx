'use client';

import { useEffect, useState, useCallback, useRef } from 'react';

type TimerProps = {
  readonly initialSeconds: number;
  readonly onComplete?: () => void;
  readonly isRunning?: boolean;
};

function formatTime(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

export default function Timer({
  initialSeconds,
  onComplete,
  isRunning = false,
}: TimerProps) {
  const [seconds, setSeconds] = useState(initialSeconds);
  const completedRef = useRef(false);

  const handleComplete = useCallback(() => {
    if (completedRef.current) return;
    completedRef.current = true;
    onComplete?.();
  }, [onComplete]);

  useEffect(() => {
    if (!isRunning || seconds <= 0) return;

    const interval = setInterval(() => {
      setSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          handleComplete();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isRunning, seconds, handleComplete]);

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
