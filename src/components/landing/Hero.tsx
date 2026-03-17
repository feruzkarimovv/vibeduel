'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import Button from '@/components/ui/Button';

function TerminalLine({
  text,
  delay,
  color = 'text-neon-green',
}: {
  readonly text: string;
  readonly delay: number;
  readonly color?: string;
}) {
  const [visible, setVisible] = useState(false);
  const [displayedText, setDisplayedText] = useState('');

  useEffect(() => {
    const showTimer = setTimeout(() => {
      setVisible(true);
      let i = 0;
      const typeTimer = setInterval(() => {
        i++;
        setDisplayedText(text.slice(0, i));
        if (i >= text.length) clearInterval(typeTimer);
      }, 25);
      return () => clearInterval(typeTimer);
    }, delay);
    return () => clearTimeout(showTimer);
  }, [text, delay]);

  if (!visible) return <div className="h-5" />;

  return (
    <div className={`font-mono text-xs sm:text-sm ${color} flex`}>
      <span className="text-zinc-600 mr-2 select-none">&gt;</span>
      <span>{displayedText}</span>
      {displayedText.length < text.length && (
        <span className="inline-block w-2 h-4 bg-current ml-0.5 animate-pulse" />
      )}
    </div>
  );
}

function FighterCard({
  side,
  name,
  tag,
}: {
  readonly side: 'left' | 'right';
  readonly name: string;
  readonly tag: string;
}) {
  const isLeft = side === 'left';

  const borderColor = isLeft
    ? 'border-neon-green/30'
    : 'border-neon-magenta/30';
  const hoverBorderColor = isLeft
    ? 'hover:border-neon-green/50'
    : 'hover:border-neon-magenta/50';
  const glowClass = isLeft ? 'box-glow-green' : 'box-glow-magenta';
  const textColor = isLeft ? 'text-neon-green' : 'text-neon-magenta';
  const dotColor = isLeft ? 'bg-neon-green' : 'bg-neon-magenta';
  const barColor = isLeft
    ? 'bg-neon-green/60'
    : 'bg-neon-magenta/60';

  const lines = isLeft
    ? [
        'const solve = (prompt) => {',
        '  const ai = useModel("claude");',
        '  return ai.generate({',
        '    task: prompt,',
        '    speed: "maximum"',
        '  });',
        '};',
      ]
    : [
        'function buildUI(spec) {',
        '  const engine = initAI();',
        '  const result = engine',
        '    .parse(spec)',
        '    .render()',
        '    .ship();',
        '}',
      ];

  return (
    <div
      className={`relative opacity-0 ${isLeft ? 'animate-slide-up-delay-2' : 'animate-slide-up-delay-3'}`}
    >
      {/* Player label */}
      <div
        className={`flex items-center gap-2 mb-3 ${isLeft ? '' : 'justify-end'}`}
      >
        <div
          className={`w-8 h-8 border-2 ${borderColor} bg-arena-dark flex items-center justify-center font-mono text-xs font-bold ${textColor}`}
        >
          {isLeft ? 'P1' : 'P2'}
        </div>
        <div className={isLeft ? '' : 'text-right'}>
          <div className={`text-sm font-bold ${textColor}`}>{name}</div>
          <div className="text-[10px] text-zinc-600 font-mono uppercase tracking-wider">
            {tag}
          </div>
        </div>
      </div>

      {/* Code block */}
      <div
        className={`${glowClass} ${hoverBorderColor} border ${borderColor} bg-arena-dark/90 p-4 font-mono text-[11px] sm:text-xs leading-relaxed transition-colors`}
      >
        {/* Top bar */}
        <div className="flex items-center justify-between mb-3 pb-2 border-b border-white/5">
          <div className="flex items-center gap-1">
            <div
              className={`w-2 h-2 ${dotColor} rounded-full animate-pulse`}
            />
            <span className="text-zinc-600 text-[10px] font-mono">LIVE</span>
          </div>
          <span className="text-zinc-700 text-[10px]">
            {isLeft ? 'solution.ts' : 'approach.ts'}
          </span>
        </div>

        {lines.map((line, i) => (
          <div key={i} className="flex">
            <span className="text-zinc-700 w-5 mr-3 text-right select-none text-[10px]">
              {i + 1}
            </span>
            <span className="text-zinc-400">{line}</span>
          </div>
        ))}

        {/* Progress bar */}
        <div className="mt-3 h-px w-full bg-arena-line overflow-hidden">
          <div
            className={`h-full ${barColor} animate-pulse`}
            style={{ width: isLeft ? '72%' : '58%' }}
          />
        </div>
      </div>
    </div>
  );
}

export default function Hero() {
  return (
    <section className="relative min-h-screen flex flex-col items-center justify-center px-4 overflow-hidden noise scanlines">
      {/* Hard geometric background */}
      <div className="absolute inset-0 -z-10">
        {/* Base black */}
        <div className="absolute inset-0 bg-arena-black" />

        {/* Diagonal split — green side and magenta side */}
        <div
          className="absolute inset-0 opacity-[0.06]"
          style={{
            background:
              'linear-gradient(135deg, #0ff47a 0%, transparent 40%, transparent 60%, #ff3366 100%)',
          }}
        />

        {/* Grid lines */}
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              'linear-gradient(rgba(15,244,122,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(15,244,122,0.5) 1px, transparent 1px)',
            backgroundSize: '80px 80px',
          }}
        />

        {/* Corner accents */}
        <div className="absolute top-0 left-0 w-32 h-32 border-l-2 border-t-2 border-neon-green/20" />
        <div className="absolute top-0 right-0 w-32 h-32 border-r-2 border-t-2 border-neon-magenta/20" />
        <div className="absolute bottom-0 left-0 w-32 h-32 border-l-2 border-b-2 border-neon-green/10" />
        <div className="absolute bottom-0 right-0 w-32 h-32 border-r-2 border-b-2 border-neon-magenta/10" />
      </div>

      {/* Content */}
      <div className="max-w-6xl mx-auto w-full">
        {/* Top status bar */}
        <div className="opacity-0 animate-slide-up flex items-center justify-center gap-3 mb-12 font-mono text-[11px]">
          <span className="text-zinc-700">[</span>
          <span className="w-1.5 h-1.5 bg-neon-green rounded-full animate-pulse" />
          <span className="text-neon-green/80 uppercase tracking-[0.2em]">
            Arena Online
          </span>
          <span className="text-zinc-700">/</span>
          <span className="text-zinc-500">
            127 duels active
          </span>
          <span className="text-zinc-700">]</span>
        </div>

        {/* Headline */}
        <div className="text-center mb-6 opacity-0 animate-slide-up-delay-1">
          <h1 className="text-7xl sm:text-8xl md:text-[10rem] font-black tracking-tighter leading-[0.85] uppercase">
            <span
              className="glitch-text block text-white"
              data-text="VIBE"
            >
              VIBE
            </span>
            <span
              className="glitch-text block text-neon-green glow-green"
              data-text="DUEL"
            >
              DUEL
            </span>
          </h1>
        </div>

        {/* Tagline — typed terminal style */}
        <div className="max-w-md mx-auto mb-10 space-y-1">
          <TerminalLine text="AI-powered coding arena" delay={800} />
          <TerminalLine
            text="Race head-to-head. Ship or get shipped."
            delay={1600}
            color="text-zinc-400"
          />
        </div>

        {/* CTA buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16 opacity-0 animate-slide-up-delay-2">
          <Link href="/duel">
            <Button size="lg">
              ENTER THE ARENA
            </Button>
          </Link>
          <Link href="/leaderboard">
            <Button variant="ghost" size="lg">
              RANKINGS
            </Button>
          </Link>
        </div>

        {/* VS Split Screen */}
        <div className="relative max-w-4xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] items-start gap-4 md:gap-6">
            <FighterCard side="left" name="you" tag="challenger" />

            {/* VS Badge */}
            <div className="hidden md:flex flex-col items-center justify-center pt-16">
              <div className="opacity-0 animate-vs-slam">
                <div className="relative">
                  <div className="w-16 h-16 bg-arena-black border-2 border-white/20 rotate-45 flex items-center justify-center">
                    <span className="text-2xl font-black -rotate-45 text-white">
                      VS
                    </span>
                  </div>
                  {/* Cross glows */}
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-24 h-px bg-gradient-to-r from-neon-green/50 via-white/20 to-neon-magenta/50" />
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-24 w-px bg-gradient-to-b from-neon-green/30 via-white/10 to-neon-magenta/30" />
                </div>
              </div>
            </div>

            <FighterCard side="right" name="opponent" tag="defender" />
          </div>
        </div>
      </div>

      {/* Bottom scroll cue */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 font-mono text-[10px] text-zinc-700 uppercase tracking-[0.3em] flex flex-col items-center gap-2">
        <span>scroll</span>
        <div className="w-px h-6 bg-gradient-to-b from-zinc-600 to-transparent" />
      </div>
    </section>
  );
}
