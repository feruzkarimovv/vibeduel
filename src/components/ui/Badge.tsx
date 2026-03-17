import { ReactNode } from 'react';
import { Difficulty } from '@/types';

type BadgeProps = {
  readonly children: ReactNode;
  readonly variant?: Difficulty | 'default';
};

const variantStyles: Record<Difficulty | 'default', string> = {
  easy: 'bg-neon-green/10 text-neon-green border-neon-green/30',
  medium: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
  hard: 'bg-neon-magenta/10 text-neon-magenta border-neon-magenta/30',
  default: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/30',
};

export default function Badge({ children, variant = 'default' }: BadgeProps) {
  return (
    <span
      className={`
        inline-flex items-center px-2 py-0.5 text-[10px] font-mono font-bold
        border uppercase tracking-wider
        ${variantStyles[variant]}
      `}
    >
      {children}
    </span>
  );
}
