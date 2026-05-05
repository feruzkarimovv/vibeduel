'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Button from '@/components/ui/Button';
import { createClient } from '@/lib/supabase/client';
import { getOrCreatePlayer } from '@/lib/auth';
import type { SupabaseClient } from '@supabase/supabase-js';

type Mode = 'signin' | 'signup';

function useSupabase() {
  const ref = useRef<SupabaseClient | null>(null);
  if (!ref.current && typeof window !== 'undefined') {
    ref.current = createClient();
  }
  return ref.current;
}

export default function AuthForm() {
  const router = useRouter();
  const params = useSearchParams();
  const supabase = useSupabase();
  const initialMode = (params.get('mode') as Mode) ?? 'signin';
  const [mode, setMode] = useState<Mode>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [busy, setBusy] = useState(false);
  const callbackError =
    params.get('error') === 'callback'
      ? "Couldn't verify that email link — try signing in directly."
      : null;
  const [error, setError] = useState<string | null>(callbackError);
  const [info, setInfo] = useState<string | null>(null);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) router.replace('/me');
    });
  }, [supabase, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) return;
    setError(null);
    setInfo(null);
    setBusy(true);
    try {
      if (mode === 'signup') {
        const { error: signErr } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { username: username || undefined } },
        });
        if (signErr) {
          setError(signErr.message);
          setBusy(false);
          return;
        }
        // If email confirmation is enabled there may be no session yet.
        const { data: sess } = await supabase.auth.getSession();
        if (!sess.session) {
          setInfo('Check your email to confirm your account.');
          setBusy(false);
          return;
        }
      } else {
        const { error: signErr } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (signErr) {
          setError(signErr.message);
          setBusy(false);
          return;
        }
      }
      // Bind / upgrade player row, then go to /me.
      await getOrCreatePlayer(supabase);
      router.push('/me');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setBusy(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center px-4 py-12 noise bg-arena-black">
      <div className="fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-arena-black" />
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage:
              'linear-gradient(rgba(15,244,122,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(15,244,122,0.5) 1px, transparent 1px)',
            backgroundSize: '80px 80px',
          }}
        />
      </div>

      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <Link
            href="/"
            className="inline-block text-2xl font-black text-neon-green glow-green uppercase tracking-tight mb-3"
          >
            VibeDuel
          </Link>
          <h1 className="text-2xl font-black text-white uppercase tracking-tight">
            {mode === 'signup' ? 'Create Account' : 'Sign In'}
          </h1>
          <p className="text-[10px] text-zinc-700 font-mono uppercase tracking-[0.2em] mt-2">
            {mode === 'signup'
              ? 'Save your ELO across devices'
              : 'Welcome back, dueler'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3 border border-arena-line bg-arena-dark p-5">
          {mode === 'signup' && (
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="username (optional)"
              maxLength={32}
              className="w-full px-3 py-2 bg-arena-black border border-arena-line text-white font-mono text-sm placeholder:text-zinc-700 focus:outline-none focus:border-neon-green/50"
            />
          )}
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="email"
            autoComplete="email"
            required
            className="w-full px-3 py-2 bg-arena-black border border-arena-line text-white font-mono text-sm placeholder:text-zinc-700 focus:outline-none focus:border-neon-green/50"
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="password (min 6 chars)"
            autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
            minLength={6}
            required
            className="w-full px-3 py-2 bg-arena-black border border-arena-line text-white font-mono text-sm placeholder:text-zinc-700 focus:outline-none focus:border-neon-green/50"
          />

          {error && (
            <p className="text-[11px] font-mono text-neon-magenta">{error}</p>
          )}
          {info && (
            <p className="text-[11px] font-mono text-neon-green">{info}</p>
          )}

          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? 'WORKING...' : mode === 'signup' ? 'CREATE ACCOUNT' : 'SIGN IN'}
          </Button>
        </form>

        <div className="text-center">
          <button
            onClick={() => {
              setError(null);
              setInfo(null);
              setMode((m) => (m === 'signin' ? 'signup' : 'signin'));
            }}
            className="text-[10px] text-zinc-600 hover:text-neon-green transition-colors font-mono uppercase tracking-wider"
          >
            {mode === 'signin'
              ? 'No account? Sign up →'
              : '← Already have an account? Sign in'}
          </button>
        </div>

        <div className="text-center">
          <Link
            href="/duel"
            className="text-[10px] text-zinc-700 hover:text-zinc-500 transition-colors font-mono uppercase tracking-wider"
          >
            Continue as guest →
          </Link>
        </div>
      </div>
    </main>
  );
}
