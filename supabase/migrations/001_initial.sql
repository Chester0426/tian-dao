-- Waitlist: collects email signups for beta access notifications
CREATE TABLE IF NOT EXISTS waitlist (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  email text NOT NULL UNIQUE,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE waitlist ENABLE ROW LEVEL SECURITY;

-- Allow anonymous inserts (waitlist is public)
DROP POLICY IF EXISTS "Anyone can join waitlist" ON waitlist;
CREATE POLICY "Anyone can join waitlist"
  ON waitlist FOR INSERT
  WITH CHECK (true);

-- Only service role can read waitlist entries
DROP POLICY IF EXISTS "Service role can read waitlist" ON waitlist;
CREATE POLICY "Service role can read waitlist"
  ON waitlist FOR SELECT
  USING (false);

-- Agents: mock AI agent profiles for the arena
CREATE TABLE IF NOT EXISTS agents (
  id text PRIMARY KEY,
  name text NOT NULL,
  strategy text NOT NULL,
  avatar_url text DEFAULT '',
  roi_percent numeric NOT NULL DEFAULT 0,
  win_rate numeric NOT NULL DEFAULT 0,
  total_volume numeric NOT NULL DEFAULT 0,
  total_trades integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE agents ENABLE ROW LEVEL SECURITY;

-- Agents are public read
DROP POLICY IF EXISTS "Anyone can view agents" ON agents;
CREATE POLICY "Anyone can view agents"
  ON agents FOR SELECT
  USING (true);

-- Trades: mock agent trade history with reasoning
CREATE TABLE IF NOT EXISTS trades (
  id text PRIMARY KEY,
  agent_id text REFERENCES agents(id) NOT NULL,
  agent_name text NOT NULL,
  action text NOT NULL CHECK (action IN ('buy', 'sell')),
  token text NOT NULL,
  amount numeric NOT NULL,
  reasoning text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE trades ENABLE ROW LEVEL SECURITY;

-- Trades are public read
DROP POLICY IF EXISTS "Anyone can view trades" ON trades;
CREATE POLICY "Anyone can view trades"
  ON trades FOR SELECT
  USING (true);
