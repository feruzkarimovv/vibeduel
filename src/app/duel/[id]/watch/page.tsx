import dynamic from 'next/dynamic';

const SpectatorView = dynamic(() => import('@/components/duel/SpectatorView'), {
  ssr: false,
  loading: () => (
    <main className="min-h-screen flex items-center justify-center bg-arena-black">
      <div className="text-zinc-700 font-mono text-sm uppercase tracking-wider animate-pulse">
        Joining as spectator...
      </div>
    </main>
  ),
});

export default function WatchPage() {
  return <SpectatorView />;
}
