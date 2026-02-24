-- Waitlist signups — stores email for beta access notifications
CREATE TABLE IF NOT EXISTS waitlist_signups (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  email text NOT NULL UNIQUE,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE waitlist_signups ENABLE ROW LEVEL SECURITY;

-- Allow anonymous inserts (waitlist is public)
DROP POLICY IF EXISTS "Anyone can insert waitlist signups" ON waitlist_signups;
CREATE POLICY "Anyone can insert waitlist signups"
  ON waitlist_signups
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Only service role can read (admin only)
DROP POLICY IF EXISTS "Service role can read waitlist" ON waitlist_signups;
CREATE POLICY "Service role can read waitlist"
  ON waitlist_signups
  FOR SELECT
  TO service_role
  USING (true);
