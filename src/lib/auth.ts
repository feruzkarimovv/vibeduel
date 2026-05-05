'use client';

import type { SupabaseClient, Session } from '@supabase/supabase-js';
import type { Player } from '@/types';

const STORAGE_KEY = 'vibeduel_player_id';

const ADJECTIVES = [
  'Vibe', 'Code', 'Ship', 'Pixel', 'Turbo',
  'Neon', 'Cyber', 'Nova', 'Hyper', 'Ultra',
  'Flux', 'Blaze', 'Drift', 'Pulse', 'Zen',
] as const;

const NOUNS = [
  'Ninja', 'Phoenix', 'Lord', 'Master', 'Wizard',
  'Coder', 'Hacker', 'Builder', 'Pilot', 'Shark',
  'Wolf', 'Ghost', 'Raven', 'Tiger', 'Spark',
] as const;

function generateUsername(): string {
  const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
  const num = Math.floor(Math.random() * 100);
  return `${adj}${noun}${num}`;
}

export async function getSession(
  supabase: SupabaseClient,
): Promise<Session | null> {
  const { data } = await supabase.auth.getSession();
  return data.session;
}

/**
 * Resolve the current player.
 * - If a Supabase Auth session exists, find or create the bound player row.
 * - Otherwise, fall back to the legacy localStorage-anonymous flow so that
 *   guests can still play without an account.
 */
export async function getOrCreatePlayer(
  supabase: SupabaseClient,
): Promise<Player | null> {
  // Authed path
  const session = await getSession(supabase);
  if (session?.user) {
    const { user } = session;
    const { data: existing } = await supabase
      .from('players')
      .select('*')
      .eq('auth_user_id', user.id)
      .maybeSingle();
    if (existing) {
      // Keep localStorage in sync so any code paths still reading it agree.
      if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, existing.id);
      }
      return existing as Player;
    }

    // No bound player yet — try to upgrade an existing localStorage guest
    // first (so a user who's been playing as guest doesn't lose their stats
    // when they sign up). This calls a server route because UPDATE on
    // players is RLS-blocked for the anon client.
    const guestId =
      typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
    const username = (user.user_metadata?.username as string | undefined) ?? generateUsername();

    const res = await fetch('/api/player/bind', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        auth_user_id: user.id,
        email: user.email,
        guest_player_id: guestId,
        fallback_username: username,
      }),
    });
    if (!res.ok) return null;
    const { player } = await res.json();
    if (player && typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, player.id);
    }
    return player as Player;
  }

  // Unauthed (guest) path — same as before
  const storedId =
    typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
  if (storedId) {
    const { data } = await supabase
      .from('players')
      .select('*')
      .eq('id', storedId)
      .maybeSingle();
    if (data) return data as Player;
  }

  // Create a new guest via a server route (RLS allows anon INSERT to players,
  // but we centralise here for symmetry).
  const username = generateUsername();
  const { data, error } = await supabase
    .from('players')
    .insert({ username })
    .select()
    .single();
  if (error) return null;
  if (data && typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, data.id);
  }
  return data as Player;
}

export async function signOut(supabase: SupabaseClient): Promise<void> {
  await supabase.auth.signOut();
  // Don't clear vibeduel_player_id — they can keep playing as guest.
}
