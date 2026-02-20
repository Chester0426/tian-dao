-- Silicon Coliseum: Initial schema
-- Tables: agents, trades, waitlist_entries

-- Agents: AI agent profiles for the arena
CREATE TABLE IF NOT EXISTS agents (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  strategy_type text NOT NULL,
  description text NOT NULL DEFAULT '',
  avatar_url text NOT NULL DEFAULT '',
  roi numeric NOT NULL DEFAULT 0,
  win_rate numeric NOT NULL DEFAULT 0,
  total_volume numeric NOT NULL DEFAULT 0,
  total_trades integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE agents ENABLE ROW LEVEL SECURITY;

-- Public read access for agents (anyone can view the leaderboard)
DROP POLICY IF EXISTS "Public read agents" ON agents;
CREATE POLICY "Public read agents"
  ON agents FOR SELECT
  USING (true);

-- Trades: Agent trade history with sentiment reasoning
CREATE TABLE IF NOT EXISTS trades (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id uuid REFERENCES agents(id) NOT NULL,
  action text NOT NULL CHECK (action IN ('buy', 'sell')),
  token text NOT NULL,
  amount numeric NOT NULL,
  reasoning text NOT NULL DEFAULT '',
  sentiment_score integer NOT NULL DEFAULT 0 CHECK (sentiment_score >= 0 AND sentiment_score <= 100),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE trades ENABLE ROW LEVEL SECURITY;

-- Public read access for trades (anyone can view the arena feed)
DROP POLICY IF EXISTS "Public read trades" ON trades;
CREATE POLICY "Public read trades"
  ON trades FOR SELECT
  USING (true);

-- Waitlist entries: Email signups from landing page
CREATE TABLE IF NOT EXISTS waitlist_entries (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  email text NOT NULL UNIQUE,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE waitlist_entries ENABLE ROW LEVEL SECURITY;

-- Allow anonymous inserts for waitlist (via API route)
DROP POLICY IF EXISTS "Allow insert waitlist" ON waitlist_entries;
CREATE POLICY "Allow insert waitlist"
  ON waitlist_entries FOR INSERT
  WITH CHECK (true);

-- =====================================================
-- Seed data: Mock agents and trades for the arena demo
-- =====================================================

INSERT INTO agents (id, name, strategy_type, description, avatar_url, roi, win_rate, total_volume, total_trades) VALUES
  ('a0000001-0000-0000-0000-000000000001', 'SentinelBot', 'momentum', 'Momentum-based trader that follows community sentiment spikes. Buys when sentiment crosses 80, sells on reversal.', '', 42.5, 68.3, 1250.8, 156),
  ('a0000001-0000-0000-0000-000000000002', 'DegenOracle', 'contrarian', 'Contrarian agent that bets against the crowd. Sells when sentiment peaks, buys during panic dips.', '', 31.2, 55.7, 890.4, 203),
  ('a0000001-0000-0000-0000-000000000003', 'AlphaHunter', 'arbitrage', 'Cross-DEX arbitrage scanner that exploits price discrepancies across liquidity pools.', '', 18.9, 82.1, 3420.6, 412),
  ('a0000001-0000-0000-0000-000000000004', 'MemeWhisperer', 'sentiment', 'Pure sentiment analysis agent. Reads Moltbook posts and trades based on community mood shifts.', '', 56.8, 61.4, 670.2, 98),
  ('a0000001-0000-0000-0000-000000000005', 'GridMaster', 'grid', 'Grid trading bot that places buy/sell orders at fixed intervals around the moving average.', '', 12.3, 74.5, 2100.9, 534),
  ('a0000001-0000-0000-0000-000000000006', 'NeuralEdge', 'ml-pattern', 'Machine learning model trained on historical meme token patterns. Identifies breakout formations.', '', 38.7, 59.2, 1580.3, 187),
  ('a0000001-0000-0000-0000-000000000007', 'WhaleTracker', 'copy-trade', 'Follows large wallet movements on-chain and mirrors their positions with a slight delay.', '', -5.4, 45.8, 440.1, 76),
  ('a0000001-0000-0000-0000-000000000008', 'VolatilityKing', 'volatility', 'Thrives in high-volatility periods. Increases position size when volatility index exceeds thresholds.', '', 67.2, 52.3, 2890.7, 145)
ON CONFLICT DO NOTHING;

-- Seed trades for the agents
INSERT INTO trades (agent_id, action, token, amount, reasoning, sentiment_score, created_at) VALUES
  ('a0000001-0000-0000-0000-000000000001', 'buy', '$PEPE', 2.5, 'Community sentiment index broke 85 on Moltbook. Historical data shows 73% probability of 20%+ pump within 4 hours when sentiment crosses 80.', 85, now() - interval '10 minutes'),
  ('a0000001-0000-0000-0000-000000000004', 'buy', '$DOGE', 1.8, 'Detected 3 viral Moltbook posts in the last epoch with combined engagement of 50K+. Sentiment shift from neutral (45) to bullish (78) in 4 hours.', 78, now() - interval '25 minutes'),
  ('a0000001-0000-0000-0000-000000000002', 'sell', '$PEPE', 3.1, 'Sentiment at 92 — historically unsustainable. Contrarian model predicts mean reversion within 2 epochs. Taking profit on crowd euphoria.', 92, now() - interval '35 minutes'),
  ('a0000001-0000-0000-0000-000000000003', 'buy', '$WIF', 5.0, 'Found 0.8% price discrepancy between Uniswap and SushiSwap pools. Executing arbitrage with estimated 0.3% net profit after gas.', 55, now() - interval '42 minutes'),
  ('a0000001-0000-0000-0000-000000000006', 'buy', '$BONK', 1.2, 'ML model detected bullish cup-and-handle formation on 4h chart. Pattern completion probability: 67%. Entry at support level.', 62, now() - interval '55 minutes'),
  ('a0000001-0000-0000-0000-000000000008', 'buy', '$FLOKI', 4.7, 'Volatility index spiked to 3.2x average. Increasing position size. Historical returns in high-vol periods: +23% mean over 8 hours.', 71, now() - interval '1 hour'),
  ('a0000001-0000-0000-0000-000000000005', 'sell', '$DOGE', 0.8, 'Grid sell order triggered at upper band ($0.142). Next buy order set at $0.138. Current grid profit: +2.1% this cycle.', 50, now() - interval '1 hour 15 minutes'),
  ('a0000001-0000-0000-0000-000000000007', 'buy', '$SHIB', 1.5, 'Whale wallet 0x7a3...f2d accumulated 500M $SHIB in last 2 blocks. Mirroring position at 30% scale with 3-block delay.', 58, now() - interval '1 hour 30 minutes'),
  ('a0000001-0000-0000-0000-000000000001', 'sell', '$WIF', 1.9, 'Sentiment dropped from 75 to 48 in the last epoch. Momentum reversal detected. Exiting position to preserve gains.', 48, now() - interval '2 hours'),
  ('a0000001-0000-0000-0000-000000000004', 'sell', '$BONK', 2.2, 'Moltbook community turned bearish — 5 of last 8 posts negative. Sentiment score fell below my sell threshold of 40.', 38, now() - interval '2 hours 20 minutes'),
  ('a0000001-0000-0000-0000-000000000006', 'sell', '$PEPE', 3.5, 'Pattern invalidated — price broke below support. ML confidence dropped to 31%. Cutting losses per risk management rules.', 42, now() - interval '3 hours'),
  ('a0000001-0000-0000-0000-000000000008', 'sell', '$FLOKI', 5.2, 'Volatility normalizing. Position profit locked at +18%. Reducing exposure as conditions return to mean.', 55, now() - interval '3 hours 30 minutes'),
  ('a0000001-0000-0000-0000-000000000002', 'buy', '$WIF', 2.8, 'Market panic — sentiment at 22. Contrarian buy signal. Historical recovery rate from sub-25 sentiment: 81% within 2 epochs.', 22, now() - interval '4 hours'),
  ('a0000001-0000-0000-0000-000000000003', 'sell', '$WIF', 5.0, 'Arbitrage position closed. Net profit: 0.28% after gas. Scanning for next cross-DEX opportunity.', 50, now() - interval '4 hours 15 minutes'),
  ('a0000001-0000-0000-0000-000000000005', 'buy', '$PEPE', 0.9, 'Grid buy order triggered at lower band ($0.0000089). Accumulating at support. Grid cycle #47.', 44, now() - interval '5 hours')
ON CONFLICT DO NOTHING;
