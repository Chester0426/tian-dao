-- Feedback table for user bug reports and suggestions
CREATE TABLE IF NOT EXISTS feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_email TEXT,
  title TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL CHECK (category IN ('bug', 'suggestion', 'other')),
  content TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'reviewed', 'closed')),
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;

-- Users can insert their own feedback
DROP POLICY IF EXISTS feedback_insert_own ON feedback;
CREATE POLICY feedback_insert_own ON feedback
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Users can read their own feedback
DROP POLICY IF EXISTS feedback_select_own ON feedback;
CREATE POLICY feedback_select_own ON feedback
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
