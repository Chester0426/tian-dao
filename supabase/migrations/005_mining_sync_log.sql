-- 005_mining_sync_log.sql — Log each mining sync for anomaly detection
CREATE TABLE IF NOT EXISTS mining_sync_logs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) NOT NULL,
  slot smallint NOT NULL,
  mine_id uuid NOT NULL,
  actions integer NOT NULL,
  elapsed_ms integer NOT NULL,
  drops jsonb NOT NULL DEFAULT '{}',
  xp_mining integer NOT NULL DEFAULT 0,
  xp_mastery integer NOT NULL DEFAULT 0,
  xp_body integer NOT NULL DEFAULT 0,
  anomalies text[] DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

-- Index for admin queries (find anomalies, per-user history)
CREATE INDEX IF NOT EXISTS idx_mining_sync_logs_user ON mining_sync_logs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mining_sync_logs_anomalies ON mining_sync_logs USING gin(anomalies) WHERE array_length(anomalies, 1) > 0;

-- RLS: users can't read/write this table (admin only via service role)
ALTER TABLE mining_sync_logs ENABLE ROW LEVEL SECURITY;
