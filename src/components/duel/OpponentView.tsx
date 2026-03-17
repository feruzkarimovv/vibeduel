import type { Player, OpponentProgress } from '@/types';

type OpponentViewProps = {
  readonly opponent: Player | null;
  readonly progress?: OpponentProgress | null;
};

export default function OpponentView({
  opponent,
  progress,
}: OpponentViewProps) {
  if (!opponent) {
    return (
      <div className="px-3 py-2 border border-arena-line bg-arena-dark">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 border border-neon-magenta/20 bg-arena-mid animate-pulse" />
          <div className="space-y-1.5">
            <div className="w-20 h-2.5 bg-arena-mid animate-pulse" />
            <div className="w-14 h-2 bg-arena-mid/50 animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  const status = progress?.status ?? 'idle';
  const lineCount = progress?.lineCount ?? 0;
  const iterations = progress?.iterationCount ?? 0;

  // Progress bar: rough estimate based on lines written (200 lines = 100%)
  const progressPercent = Math.min((lineCount / 200) * 100, 100);

  return (
    <div className="px-3 py-2 border border-arena-line bg-arena-dark">
      <div className="flex items-center gap-2.5">
        {/* Avatar — simple initial square */}
        <div className="w-7 h-7 border border-neon-magenta/40 bg-arena-mid flex items-center justify-center text-[10px] font-mono font-bold text-neon-magenta">
          {opponent.username.charAt(0).toUpperCase()}
        </div>

        {/* Info */}
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <p className="text-xs font-mono font-bold text-white truncate max-w-[100px]">
              {opponent.username}
            </p>
            <span className="text-[9px] text-zinc-700 font-mono">
              [{opponent.elo}]
            </span>
          </div>

          {/* Progress bar + status */}
          <div className="flex items-center gap-2 mt-0.5">
            <div className="w-20 h-1 bg-arena-line overflow-hidden">
              <div
                className="h-full bg-neon-magenta transition-all duration-1000 ease-out"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <span
              className={`text-[9px] whitespace-nowrap font-mono ${
                status === 'submitted'
                  ? 'text-neon-green'
                  : status === 'coding'
                    ? 'text-amber-400'
                    : 'text-zinc-700'
              }`}
            >
              {status === 'submitted'
                ? 'DONE'
                : status === 'coding'
                  ? `ITR ${iterations}/5`
                  : 'IDLE'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
