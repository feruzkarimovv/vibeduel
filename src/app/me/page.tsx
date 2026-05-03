import dynamic from 'next/dynamic';

const ProfilePage = dynamic(() => import('@/components/me/ProfilePage'), {
  ssr: false,
  loading: () => (
    <main className="min-h-screen flex items-center justify-center bg-arena-black">
      <div className="text-zinc-700 font-mono text-sm uppercase tracking-wider animate-pulse">
        Loading profile...
      </div>
    </main>
  ),
});

export default function Me() {
  return <ProfilePage />;
}
