import dynamic from 'next/dynamic';

const DuelRoom = dynamic(() => import('@/components/duel/DuelRoom'), {
  ssr: false,
  loading: () => (
    <main className="min-h-screen flex items-center justify-center bg-arena-black">
      <div className="text-zinc-700 font-mono text-sm uppercase tracking-wider animate-pulse">
        Loading duel...
      </div>
    </main>
  ),
});

export default function DuelRoomPage() {
  return <DuelRoom />;
}
