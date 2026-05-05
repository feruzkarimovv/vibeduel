'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import Button from '@/components/ui/Button';

export default function Error({
  error,
  reset,
}: {
  readonly error: Error & { digest?: string };
  readonly reset: () => void;
}) {
  useEffect(() => {
    // Surface to the server log so prod issues are visible in Vercel logs.
    console.error(error);
  }, [error]);

  return (
    <main className="min-h-screen flex items-center justify-center bg-arena-black px-4 noise">
      <div className="text-center space-y-5 max-w-md">
        <div className="w-16 h-16 border-2 border-neon-magenta/40 mx-auto flex items-center justify-center">
          <span className="text-neon-magenta font-mono text-2xl font-bold">!</span>
        </div>
        <h2 className="text-xl font-black text-white uppercase tracking-tight">
          Something Broke
        </h2>
        <p className="text-zinc-600 text-xs font-mono uppercase tracking-wider">
          The arena hit an unexpected error.
        </p>
        {error.digest && (
          <p className="text-zinc-800 text-[10px] font-mono">
            ref: {error.digest}
          </p>
        )}
        <div className="flex items-center gap-3 justify-center">
          <Button onClick={reset}>RETRY</Button>
          <Link href="/">
            <Button variant="ghost">HOME</Button>
          </Link>
        </div>
      </div>
    </main>
  );
}
