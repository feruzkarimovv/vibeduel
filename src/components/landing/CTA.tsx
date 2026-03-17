'use client';

import { useState } from 'react';
import Link from 'next/link';
import Button from '@/components/ui/Button';

export default function CTA() {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (email.trim()) {
      setSubmitted(true);
    }
  };

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

        {/* Email form */}
        <form
          onSubmit={handleSubmit}
          className="flex flex-col sm:flex-row items-stretch gap-3 max-w-md mx-auto mb-4"
        >
          {submitted ? (
            <div className="w-full py-3 px-4 border border-neon-green/30 text-neon-green font-mono text-sm text-center">
              <span className="mr-2">&#10003;</span>
              REGISTERED. STAND BY FOR DEPLOYMENT.
            </div>
          ) : (
            <>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                className="flex-1 px-4 py-3 bg-arena-dark border border-arena-line text-white font-mono text-sm placeholder:text-zinc-700 focus:outline-none focus:border-neon-green/50 transition-colors"
                required
              />
              <Button type="submit" className="sm:w-auto whitespace-nowrap">
                GET ACCESS
              </Button>
            </>
          )}
        </form>

        {!submitted && (
          <p className="text-zinc-700 text-[10px] font-mono uppercase tracking-wider mb-14">
            No spam. Duel invites only.
          </p>
        )}

        {/* Divider */}
        <div className="flex items-center gap-4 max-w-xs mx-auto mb-14">
          <div className="flex-1 h-px bg-arena-line" />
          <span className="text-zinc-700 font-mono text-[10px]">OR</span>
          <div className="flex-1 h-px bg-arena-line" />
        </div>

        {/* Direct CTA */}
        <Link href="/duel">
          <Button variant="secondary" size="lg">
            SKIP THE LINE — DUEL NOW
          </Button>
        </Link>
      </div>
    </section>
  );
}
