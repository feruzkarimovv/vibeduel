'use client';

type Phase = {
  readonly id: string;
  readonly label: string;
  readonly title: string;
  readonly description: string;
  readonly accent: 'green' | 'cyan' | 'magenta';
  readonly command: string;
};

const phases: readonly Phase[] = [
  {
    id: '01',
    label: 'PHASE_01',
    title: 'MATCH',
    description:
      'Get paired with an opponent at your skill level. ELO-based matchmaking ensures fair fights. Both players receive the same challenge prompt.',
    accent: 'green',
    command: '> matchmaking.find({ elo: 1650, mode: "ranked" })',
  },
  {
    id: '02',
    label: 'PHASE_02',
    title: 'CODE',
    description:
      'The clock starts. Both players use AI to vibecode their solution in real-time. 5 iterations max. Choose your prompts wisely.',
    accent: 'cyan',
    command: '> ai.generate({ prompt, challenge, iterations: 5 })',
  },
  {
    id: '03',
    label: 'PHASE_03',
    title: 'SHIP',
    description:
      'Time expires. AI judges both submissions on correctness, design, and creativity. The better output wins. Climb the leaderboard.',
    accent: 'magenta',
    command: '> judge.evaluate({ submissions, criteria: "all" })',
  },
] as const;

function getAccentStyles(accent: Phase['accent']) {
  const map = {
    green: {
      border: 'border-neon-green/20 hover:border-neon-green/40',
      text: 'text-neon-green',
      bg: 'bg-neon-green',
      glow: 'box-glow-green',
      dot: 'bg-neon-green',
    },
    cyan: {
      border: 'border-neon-cyan/20 hover:border-neon-cyan/40',
      text: 'text-neon-cyan',
      bg: 'bg-neon-cyan',
      glow: '',
      dot: 'bg-neon-cyan',
    },
    magenta: {
      border: 'border-neon-magenta/20 hover:border-neon-magenta/40',
      text: 'text-neon-magenta',
      bg: 'bg-neon-magenta',
      glow: 'box-glow-magenta',
      dot: 'bg-neon-magenta',
    },
  } as const;
  return map[accent];
}

function PhaseCard({
  phase,
  index,
}: {
  readonly phase: Phase;
  readonly index: number;
}) {
  const styles = getAccentStyles(phase.accent);

  return (
    <div className="group relative">
      {/* Connector */}
      {index < phases.length - 1 && (
        <div className="hidden lg:block absolute -bottom-8 left-1/2 -translate-x-1/2 w-px h-8 bg-gradient-to-b from-zinc-700 to-transparent" />
      )}

      <div
        className={`relative border ${styles.border} bg-arena-dark/80 p-6 transition-all duration-300 hover:bg-arena-mid/50`}
      >
        {/* Top-left corner accent */}
        <div
          className={`absolute top-0 left-0 w-4 h-4 border-t border-l ${styles.border}`}
        />
        <div
          className={`absolute bottom-0 right-0 w-4 h-4 border-b border-r ${styles.border}`}
        />

        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="font-mono text-[10px] text-zinc-600 uppercase tracking-[0.2em] mb-1">
              {phase.label}
            </div>
            <h3
              className={`text-3xl sm:text-4xl font-black tracking-tight ${styles.text}`}
            >
              {phase.title}
            </h3>
          </div>

          {/* Phase number */}
          <div
            className={`w-10 h-10 border ${styles.border} flex items-center justify-center font-mono text-sm font-bold ${styles.text}`}
          >
            {phase.id}
          </div>
        </div>

        {/* Description */}
        <p className="text-zinc-400 text-sm leading-relaxed mb-4 max-w-md">
          {phase.description}
        </p>

        {/* Command line */}
        <div className="font-mono text-[11px] text-zinc-600 border-t border-arena-line pt-3">
          <span className={styles.text}>{phase.command}</span>
          <span className="inline-block w-1.5 h-3 bg-current ml-1 animate-pulse opacity-50" />
        </div>
      </div>
    </div>
  );
}

export default function HowItWorks() {
  return (
    <section className="relative py-28 px-4 noise">
      {/* Background */}
      <div className="absolute inset-0 -z-10 bg-arena-dark" />

      {/* Diagonal top edge */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-neon-green/20 via-transparent to-neon-magenta/20" />

      <div className="max-w-4xl mx-auto">
        {/* Section header */}
        <div className="mb-16">
          <div className="font-mono text-[11px] text-zinc-600 uppercase tracking-[0.3em] mb-3">
            {'// Protocol'}
          </div>
          <h2 className="text-4xl sm:text-5xl font-black text-white tracking-tight uppercase">
            HOW IT
            <br />
            <span className="text-neon-green glow-green">WORKS</span>
          </h2>
          <div className="w-12 h-0.5 bg-neon-green mt-4" />
        </div>

        {/* Phases */}
        <div className="space-y-6 lg:space-y-4">
          {phases.map((phase, i) => (
            <PhaseCard key={phase.id} phase={phase} index={i} />
          ))}
        </div>

        {/* Stats bar */}
        <div className="mt-16 grid grid-cols-3 gap-4 font-mono text-center">
          {[
            { value: '5min', label: 'per duel' },
            { value: '5', label: 'AI iterations' },
            { value: 'ELO', label: 'ranked system' },
          ].map((stat) => (
            <div
              key={stat.label}
              className="border border-arena-line p-4 bg-arena-dark/50"
            >
              <div className="text-2xl sm:text-3xl font-black text-white mb-1">
                {stat.value}
              </div>
              <div className="text-[10px] text-zinc-600 uppercase tracking-[0.2em]">
                {stat.label}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
