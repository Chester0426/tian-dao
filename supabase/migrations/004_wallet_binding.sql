-- 004_wallet_binding.sql — Wallet binding (per account, not per slot)
-- Also: change max free slots from 3 to 1

CREATE TABLE IF NOT EXISTS wallet_bindings (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) NOT NULL UNIQUE,
  wallet_address text NOT NULL,
  bound_at timestamptz NOT NULL DEFAULT now(),
  cooldown_until timestamptz -- 7-day cooldown after changing wallet
);
ALTER TABLE wallet_bindings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own wallet" ON wallet_bindings;
CREATE POLICY "Users can read own wallet" ON wallet_bindings
  FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can insert own wallet" ON wallet_bindings;
CREATE POLICY "Users can insert own wallet" ON wallet_bindings
  FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update own wallet" ON wallet_bindings;
CREATE POLICY "Users can update own wallet" ON wallet_bindings
  FOR UPDATE USING (auth.uid() = user_id);
