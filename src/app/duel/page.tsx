import dynamic from 'next/dynamic';

const DuelLobby = dynamic(() => import('@/components/duel/DuelLobby'), {
  ssr: false,
  loading: () => (
    <main className="min-h-screen flex items-center justify-center bg-arena-black">
      <div className="text-zinc-700 font-mono text-sm uppercase tracking-wider animate-pulse">
        Initializing...
      </div>
    </main>
  ),
});

export default function DuelPage() {
  return <DuelLobby />;
}
