import Hero from '@/components/landing/Hero';
import HowItWorks from '@/components/landing/HowItWorks';
import CTA from '@/components/landing/CTA';

export default function Home() {
  return (
    <main>
      <Hero />
      <HowItWorks />
      <CTA />

      {/* Footer */}
      <footer className="border-t border-arena-line py-8 px-4 bg-arena-black">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 font-mono text-[11px] text-zinc-700 uppercase tracking-wider">
          <p>&copy; 2026 VibeDuel. Ship or get shipped.</p>
        </div>
      </footer>
    </main>
  );
}
