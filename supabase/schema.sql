-- VibeDuel Database Schema
-- Run this SQL in your Supabase Dashboard → SQL Editor

-- Players table
CREATE TABLE IF NOT EXISTS players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username TEXT NOT NULL,
  avatar_seed TEXT DEFAULT gen_random_uuid()::text,
  elo INTEGER DEFAULT 1200,
  wins INTEGER DEFAULT 0,
  losses INTEGER DEFAULT 0,
  draws INTEGER DEFAULT 0,
  auth_user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL,
  email TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Block multi-account ELO farming with the same email. Existing rows with
-- duplicate emails will need to be merged before this can be applied to a
-- non-empty database.
CREATE UNIQUE INDEX IF NOT EXISTS players_email_unique
  ON players (lower(email)) WHERE email IS NOT NULL;

-- Duels table
CREATE TABLE IF NOT EXISTS duels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id TEXT NOT NULL,
  player1_id UUID REFERENCES players(id),
  player2_id UUID REFERENCES players(id),
  status TEXT DEFAULT 'waiting' CHECK (status IN ('waiting', 'countdown', 'active', 'judging', 'complete')),
  winner_id UUID REFERENCES players(id),
  invited_only BOOLEAN NOT NULL DEFAULT FALSE,
  -- ELO snapshots written during finalize, used for /me history graph
  player1_elo_before INTEGER,
  player1_elo_after INTEGER,
  player2_elo_before INTEGER,
  player2_elo_after INTEGER,
  created_at TIMESTAMPTZ DEFAULT now(),
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ
);

-- Submissions table
CREATE TABLE IF NOT EXISTS submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  duel_id UUID REFERENCES duels(id) ON DELETE CASCADE,
  player_id UUID REFERENCES players(id),
  code TEXT NOT NULL DEFAULT '',
  iterations INTEGER NOT NULL DEFAULT 0,
  score INTEGER,
  score_breakdown JSONB,
  submitted_at TIMESTAMPTZ DEFAULT now()
);

-- Backfill for existing databases (CREATE TABLE above is for fresh installs).
ALTER TABLE submissions
  ADD COLUMN IF NOT EXISTS iterations INTEGER NOT NULL DEFAULT 0;

-- Atomic iteration counter for /api/generate. Returns the new iteration
-- count, or -1 when the cap is reached. Race-safe: the UPDATE holds a row
-- lock; the INSERT branch handles the no-row case and folds a concurrent
-- INSERT (UNIQUE violation) into the cap-reached signal.
CREATE OR REPLACE FUNCTION claim_iteration(
  p_duel_id UUID,
  p_player_id UUID,
  p_max INTEGER
) RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  UPDATE submissions
  SET iterations = iterations + 1
  WHERE duel_id = p_duel_id
    AND player_id = p_player_id
    AND iterations < p_max
  RETURNING iterations INTO v_count;

  IF FOUND THEN
    RETURN v_count;
  END IF;

  -- No row updated: either no row exists yet, or iterations >= p_max.
  BEGIN
    INSERT INTO submissions (duel_id, player_id, code, iterations)
    VALUES (p_duel_id, p_player_id, '', 1)
    RETURNING iterations INTO v_count;
    RETURN v_count;
  EXCEPTION WHEN unique_violation THEN
    -- Row exists at >= cap (or a concurrent insert just landed).
    RETURN -1;
  END;
END;
$$;

-- Unique constraint: one submission per player per duel
CREATE UNIQUE INDEX IF NOT EXISTS unique_submission_per_player_per_duel
ON submissions(duel_id, player_id);

-- Hot-path indexes
-- Matchmaking candidate scan: WHERE status='waiting' AND invited_only=false
CREATE INDEX IF NOT EXISTS duels_status_invited_idx
  ON duels (status, invited_only) WHERE status = 'waiting';
-- /me history: WHERE player1_id = $1 OR player2_id = $1, ORDER BY ended_at
CREATE INDEX IF NOT EXISTS duels_player1_ended_idx
  ON duels (player1_id, ended_at);
CREATE INDEX IF NOT EXISTS duels_player2_ended_idx
  ON duels (player2_id, ended_at);

-- Enable Realtime on duels and submissions
ALTER PUBLICATION supabase_realtime ADD TABLE duels;
ALTER PUBLICATION supabase_realtime ADD TABLE submissions;

-- Row Level Security
-- Anonymous clients can only SELECT (for the leaderboard / duel display) and
-- INSERT their own player row. ALL other writes (UPDATE, DELETE) must go
-- through server routes using the service_role key.
ALTER TABLE players ENABLE ROW LEVEL SECURITY;
ALTER TABLE duels ENABLE ROW LEVEL SECURITY;
ALTER TABLE submissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all for players" ON players;
DROP POLICY IF EXISTS "Allow all for duels" ON duels;
DROP POLICY IF EXISTS "Allow all for submissions" ON submissions;

-- players: anyone can SELECT or INSERT (for guest sign-up). UPDATE/DELETE blocked.
CREATE POLICY "players read" ON players FOR SELECT USING (true);
CREATE POLICY "players insert" ON players FOR INSERT WITH CHECK (true);

-- duels: anyone can SELECT. Writes only via service_role.
CREATE POLICY "duels read" ON duels FOR SELECT USING (true);

-- submissions: anyone can SELECT. Writes only via service_role.
CREATE POLICY "submissions read" ON submissions FOR SELECT USING (true);
