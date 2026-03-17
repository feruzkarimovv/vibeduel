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
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Duels table
CREATE TABLE IF NOT EXISTS duels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id TEXT NOT NULL,
  player1_id UUID REFERENCES players(id),
  player2_id UUID REFERENCES players(id),
  status TEXT DEFAULT 'waiting' CHECK (status IN ('waiting', 'countdown', 'active', 'judging', 'complete')),
  winner_id UUID REFERENCES players(id),
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
  score INTEGER,
  score_breakdown JSONB,
  submitted_at TIMESTAMPTZ DEFAULT now()
);

-- Unique constraint: one submission per player per duel
CREATE UNIQUE INDEX IF NOT EXISTS unique_submission_per_player_per_duel
ON submissions(duel_id, player_id);

-- Enable Realtime on duels and submissions
ALTER PUBLICATION supabase_realtime ADD TABLE duels;
ALTER PUBLICATION supabase_realtime ADD TABLE submissions;

-- Row Level Security (permissive for MVP — tighten later)
ALTER TABLE players ENABLE ROW LEVEL SECURITY;
ALTER TABLE duels ENABLE ROW LEVEL SECURITY;
ALTER TABLE submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for players" ON players FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for duels" ON duels FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for submissions" ON submissions FOR ALL USING (true) WITH CHECK (true);
