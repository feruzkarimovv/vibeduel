import { SupabaseClient } from '@supabase/supabase-js';
import type { Player } from '@/types';

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

const STORAGE_KEY = 'vibeduel_player_id';

function generateUsername(): string {
  const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
  const num = Math.floor(Math.random() * 100);
  return `${adj}${noun}${num}`;
}

export async function getOrCreatePlayer(
  supabase: SupabaseClient,
): Promise<Player | null> {
  // Check localStorage for existing player
  const storedId =
    typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;

  if (storedId) {
    const { data } = await supabase
      .from('players')
      .select('*')
      .eq('id', storedId)
      .single();

    if (data) return data as Player;
  }

  // Create new guest player
  const username = generateUsername();

  const { data, error } = await supabase
    .from('players')
    .insert({ username })
    .select()
    .single();

  if (error) {
    console.error('Failed to create player:', error.message);
    return null;
  }

  if (data && typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, data.id);
  }

  return data as Player;
}
