import Link from 'next/link';
import Button from '@/components/ui/Button';

export default function NotFound() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-arena-black px-4 noise scanlines">
      <div className="text-center space-y-6">
        <div className="text-[8rem] sm:text-[10rem] font-black text-neon-magenta glow-magenta leading-none tabular-nums">
          404
        </div>
        <p className="text-zinc-500 text-xs font-mono uppercase tracking-[0.3em]">
          Out of bounds
        </p>
        <p className="text-zinc-700 text-sm font-mono max-w-sm mx-auto">
          That route doesn&apos;t exist in the arena.
        </p>
        <div className="flex items-center gap-3 justify-center pt-2">
          <Link href="/">
            <Button>HOME</Button>
          </Link>
          <Link href="/duel">
            <Button variant="ghost">DUEL</Button>
          </Link>
        </div>
      </div>
    </main>
  );
}
