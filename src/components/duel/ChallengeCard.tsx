import { Challenge } from '@/types';
import Badge from '@/components/ui/Badge';

type ChallengeCardProps = {
  readonly challenge: Challenge;
};

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
}

export default function ChallengeCard({ challenge }: ChallengeCardProps) {
  return (
    <div className="border border-arena-line bg-arena-dark p-6">
      {/* Corner accents */}
      <div className="relative">
        <div className="absolute -top-6 -left-6 w-3 h-3 border-t border-l border-neon-green/30" />
        <div className="absolute -top-6 -right-6 w-3 h-3 border-t border-r border-neon-green/30" />
      </div>

      <div className="flex items-center justify-between mb-4">
        <Badge variant={challenge.difficulty}>{challenge.difficulty}</Badge>
        <span className="text-zinc-600 text-xs font-mono uppercase tracking-wider">
          {formatTime(challenge.timeLimit)}
        </span>
      </div>

      <h3 className="text-lg font-black text-white mb-2 uppercase tracking-tight">
        {challenge.title}
      </h3>

      <p className="text-zinc-400 text-sm leading-relaxed mb-5">
        {challenge.description}
      </p>

      <div className="border-t border-arena-line pt-4 space-y-2">
        <p className="text-[10px] text-zinc-600 font-mono uppercase tracking-[0.2em]">
          Scoring Criteria
        </p>
        <ul className="space-y-1.5">
          {challenge.criteria.map((criterion) => (
            <li
              key={criterion}
              className="flex items-center gap-2 text-sm text-zinc-400 font-mono"
            >
              <span className="w-1 h-1 bg-neon-green" />
              {criterion}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
