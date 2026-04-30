-- One-time-use nonces for wallet sign-in (SIWE-style replay + phishing protection).
-- Each /api/auth/wallet-nonce request inserts one row; client must include
-- the nonce in the signed message; server validates + marks used (delete row).

CREATE TABLE IF NOT EXISTS public.wallet_auth_nonces (
  nonce text PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wallet_auth_nonces_created ON public.wallet_auth_nonces (created_at);

ALTER TABLE public.wallet_auth_nonces ENABLE ROW LEVEL SECURITY;
-- Server-only table; no RLS policies → anon client cannot touch this.

-- Atomically issues a fresh nonce and lazily reaps expired ones.
-- Returns the new nonce. Reads/writes go through service-role only via SECURITY DEFINER.
CREATE OR REPLACE FUNCTION public.issue_wallet_nonce()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_nonce text;
BEGIN
  -- Reap any nonces older than 10 minutes — keeps the table tiny without a cron.
  DELETE FROM wallet_auth_nonces WHERE created_at < now() - interval '10 minutes';

  -- 64 random hex chars = 256 bits. Not guessable.
  v_nonce := encode(gen_random_bytes(32), 'hex');
  INSERT INTO wallet_auth_nonces (nonce) VALUES (v_nonce);
  RETURN v_nonce;
END;
$$;

-- Atomically validates + consumes a nonce. Returns true if the nonce existed
-- and wasn't expired (5 min); false otherwise. Always deletes the nonce so
-- it can never be reused regardless of outcome.
CREATE OR REPLACE FUNCTION public.consume_wallet_nonce(p_nonce text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_created_at timestamptz;
BEGIN
  DELETE FROM wallet_auth_nonces
  WHERE nonce = p_nonce
  RETURNING created_at INTO v_created_at;

  IF v_created_at IS NULL THEN
    RETURN false;
  END IF;

  IF v_created_at < now() - interval '5 minutes' THEN
    RETURN false;
  END IF;

  RETURN true;
END;
$$;
