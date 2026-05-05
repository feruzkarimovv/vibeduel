'use client';

import Link from 'next/link';
import Button from '@/components/ui/Button';

export default function CTA() {
  return (
    <section className="relative py-28 px-4 overflow-hidden noise">
      {/* Background */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-arena-black" />

        {/* Converging lines */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            background:
              'conic-gradient(from 0deg at 50% 100%, var(--neon-green) 0deg, transparent 30deg, transparent 150deg, var(--neon-magenta) 180deg, transparent 210deg, transparent 330deg, var(--neon-green) 360deg)',
          }}
        />
      </div>

      {/* Top border */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-neon-green/20 via-transparent to-neon-magenta/20" />

      <div className="max-w-2xl mx-auto text-center relative">
        {/* Pre-header */}
        <div className="font-mono text-[11px] text-zinc-600 uppercase tracking-[0.3em] mb-6">
          {'> ready_check()'}
        </div>

        {/* Headline */}
        <h2 className="text-4xl sm:text-6xl font-black text-white tracking-tight uppercase mb-4">
          ENTER THE
          <br />
          <span className="text-neon-magenta glow-magenta">ARENA</span>
        </h2>

        <p className="text-zinc-500 text-sm sm:text-base mb-10 max-w-md mx-auto font-mono">
          Join the ranked queue and prove your vibecoding skills against real
          opponents. No frameworks. Just you, AI, and the clock.
        </p>

        {/* Primary CTA */}
        <Link href="/duel">
          <Button variant="secondary" size="lg">
            DUEL NOW
          </Button>
        </Link>
      </div>
    </section>
  );
}
