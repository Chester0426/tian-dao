import type { Agent, Trade } from "./types";

export const MOCK_AGENTS: Agent[] = [
  {
    id: "agent-001",
    name: "AlphaSnipe",
    strategy: "Momentum Scalper",
    avatar_url: "",
    roi_percent: 142.5,
    win_rate: 68,
    total_volume: 2450000,
    total_trades: 312,
    created_at: "2025-12-01T00:00:00Z",
  },
  {
    id: "agent-002",
    name: "SentimentOracle",
    strategy: "Sentiment Arbitrage",
    avatar_url: "",
    roi_percent: 89.3,
    win_rate: 72,
    total_volume: 1820000,
    total_trades: 198,
    created_at: "2025-12-05T00:00:00Z",
  },
  {
    id: "agent-003",
    name: "DegenHunter",
    strategy: "Early-Launch Sniper",
    avatar_url: "",
    roi_percent: 215.8,
    win_rate: 55,
    total_volume: 3100000,
    total_trades: 567,
    created_at: "2025-11-20T00:00:00Z",
  },
  {
    id: "agent-004",
    name: "WhaleTracker",
    strategy: "Whale-Following",
    avatar_url: "",
    roi_percent: 67.2,
    win_rate: 63,
    total_volume: 980000,
    total_trades: 145,
    created_at: "2025-12-10T00:00:00Z",
  },
  {
    id: "agent-005",
    name: "NeuralMeme",
    strategy: "ML Pattern Recognition",
    avatar_url: "",
    roi_percent: 178.9,
    win_rate: 61,
    total_volume: 2890000,
    total_trades: 423,
    created_at: "2025-11-28T00:00:00Z",
  },
];

export const MOCK_TRADES: Trade[] = [
  {
    id: "trade-001",
    agent_id: "agent-001",
    agent_name: "AlphaSnipe",
    action: "buy",
    token: "$PEPE",
    amount: 25000,
    reasoning: "Detected 340% volume spike on $PEPE in last 15min. Social sentiment shifted from neutral to bullish across 12 monitored channels. Entry at support level with tight stop-loss.",
    created_at: "2026-02-21T14:32:00Z",
  },
  {
    id: "trade-002",
    agent_id: "agent-003",
    agent_name: "DegenHunter",
    action: "buy",
    token: "$WIF",
    amount: 18000,
    reasoning: "New token launch detected with strong dev wallet distribution (no single wallet >2%). Liquidity locked for 6 months. Early accumulation phase with 89% buy pressure.",
    created_at: "2026-02-21T14:28:00Z",
  },
  {
    id: "trade-003",
    agent_id: "agent-002",
    agent_name: "SentimentOracle",
    action: "sell",
    token: "$BONK",
    amount: 42000,
    reasoning: "Sentiment divergence detected: price rising but social engagement dropping 45% over 4h window. Historical pattern shows 78% probability of correction within 2h. Taking profit at 2.3x entry.",
    created_at: "2026-02-21T14:25:00Z",
  },
  {
    id: "trade-004",
    agent_id: "agent-005",
    agent_name: "NeuralMeme",
    action: "buy",
    token: "$DOGE",
    amount: 35000,
    reasoning: "Pattern recognition model identified accumulation phase matching historical breakout pattern with 0.87 correlation. Volume profile suggests institutional-level bot activity. Entering with 3:1 risk/reward ratio.",
    created_at: "2026-02-21T14:20:00Z",
  },
  {
    id: "trade-005",
    agent_id: "agent-004",
    agent_name: "WhaleTracker",
    action: "buy",
    token: "$SHIB",
    amount: 15000,
    reasoning: "Tracked 3 whale wallets accumulating $SHIB in coordinated pattern over last 6h. Total whale inflow: $2.1M. Following with scaled entry. Whale conviction score: 8.2/10.",
    created_at: "2026-02-21T14:15:00Z",
  },
  {
    id: "trade-006",
    agent_id: "agent-001",
    agent_name: "AlphaSnipe",
    action: "sell",
    token: "$FLOKI",
    amount: 31000,
    reasoning: "Momentum reversal signal triggered. RSI divergence on 5min chart confirmed by declining order book depth on bid side. Exiting position with 1.8x gain before anticipated pullback.",
    created_at: "2026-02-21T14:10:00Z",
  },
];

export function getAgentById(id: string): Agent | undefined {
  return MOCK_AGENTS.find((a) => a.id === id);
}

export function getTradesByAgentId(agentId: string): Trade[] {
  return MOCK_TRADES.filter((t) => t.agent_id === agentId);
}
