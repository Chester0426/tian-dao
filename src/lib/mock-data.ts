import type { Agent, Trade, ThinkingLog } from "./types";

export const MOCK_AGENTS: Agent[] = [
  {
    id: "agent-alpha",
    name: "AlphaGrinder",
    avatar: "A",
    strategy: "Momentum",
    roi: 142.5,
    winRate: 68.3,
    totalVolume: 2450000,
    totalTrades: 347,
  },
  {
    id: "agent-sigma",
    name: "SigmaSniper",
    avatar: "S",
    strategy: "Sentiment Arbitrage",
    roi: 89.2,
    winRate: 72.1,
    totalVolume: 1870000,
    totalTrades: 215,
  },
  {
    id: "agent-omega",
    name: "OmegaOracle",
    avatar: "O",
    strategy: "Mean Reversion",
    roi: 67.8,
    winRate: 61.5,
    totalVolume: 3120000,
    totalTrades: 528,
  },
  {
    id: "agent-delta",
    name: "DeltaHunter",
    avatar: "D",
    strategy: "Breakout Detection",
    roi: 54.1,
    winRate: 58.9,
    totalVolume: 980000,
    totalTrades: 163,
  },
  {
    id: "agent-gamma",
    name: "GammaBot",
    avatar: "G",
    strategy: "Volume Surge",
    roi: 31.6,
    winRate: 55.2,
    totalVolume: 1540000,
    totalTrades: 289,
  },
  {
    id: "agent-theta",
    name: "ThetaTracker",
    avatar: "T",
    strategy: "Social Signal",
    roi: 23.4,
    winRate: 52.8,
    totalVolume: 760000,
    totalTrades: 142,
  },
  {
    id: "agent-zeta",
    name: "ZetaZapper",
    avatar: "Z",
    strategy: "Whale Following",
    roi: -8.3,
    winRate: 44.1,
    totalVolume: 420000,
    totalTrades: 97,
  },
  {
    id: "agent-kappa",
    name: "KappaKing",
    avatar: "K",
    strategy: "Contrarian",
    roi: -15.7,
    winRate: 41.6,
    totalVolume: 310000,
    totalTrades: 78,
  },
];

const TOKENS = ["$PEPE", "$DOGE", "$SHIB", "$WIF", "$BONK", "$FLOKI", "$MEME", "$TURBO"];

const SENTIMENTS = [
  "Bullish social momentum detected across X/Twitter",
  "Whale accumulation pattern on-chain",
  "Bearish divergence in volume profile",
  "Community sentiment shift — rising mentions",
  "Smart money exit signal detected",
  "New listing catalyst — exchange announcement",
  "Overbought RSI with declining volume",
  "Accumulation phase — low volatility breakout imminent",
];

const REASONINGS = [
  "Cross-referenced 847 social posts — net sentiment +73%. Entry signal confirmed.",
  "Detected 3 whale wallets accumulating in last 2h. Front-running institutional flow.",
  "Volume dropped 60% while price held — distribution phase likely. Taking profit.",
  "Sentiment analysis of 1.2k tweets shows fear index at 12/100. Contrarian buy signal.",
  "On-chain data shows 5 large sells in 30 min. Exiting before cascade.",
  "New CEX listing announced — historical data shows 40% avg pump in 24h.",
  "RSI at 89 with bearish divergence. Risk/reward favors exit.",
  "Price consolidated for 6h in tight range. Breakout probability: 78% based on pattern match.",
];

export function generateMockTrades(count: number): Trade[] {
  const trades: Trade[] = [];
  const now = Date.now();

  for (let i = 0; i < count; i++) {
    const agent = MOCK_AGENTS[Math.floor(Math.random() * MOCK_AGENTS.length)];
    const action = Math.random() > 0.45 ? "buy" : "sell";
    const token = TOKENS[Math.floor(Math.random() * TOKENS.length)];
    const amount = Math.floor(Math.random() * 50000) + 1000;
    const price = parseFloat((Math.random() * 0.01 + 0.0001).toFixed(6));

    trades.push({
      id: `trade-${i}-${now}`,
      agentId: agent.id,
      agentName: agent.name,
      agentAvatar: agent.avatar,
      action,
      token,
      amount,
      price,
      reasoning: REASONINGS[Math.floor(Math.random() * REASONINGS.length)],
      sentiment: SENTIMENTS[Math.floor(Math.random() * SENTIMENTS.length)],
      timestamp: new Date(now - i * 45000).toISOString(),
    });
  }

  return trades;
}

export function generateThinkingLogs(agentId: string): ThinkingLog[] {
  const thoughts = [
    {
      thought: "Scanning social feeds for sentiment shifts on meme tokens...",
      conclusion: "Detected bullish momentum on $PEPE — 847 positive mentions in last hour.",
    },
    {
      thought: "Analyzing on-chain whale movements for accumulation patterns...",
      conclusion: "3 whale wallets accumulated $WIF in last 2h. Signal strength: HIGH.",
    },
    {
      thought: "Evaluating risk/reward for current $DOGE position...",
      conclusion: "RSI overbought at 89. Taking 50% profit to lock gains.",
    },
    {
      thought: "Cross-referencing exchange order books with social sentiment...",
      conclusion: "Buy wall at $0.0042 with rising mentions. Entering long position.",
    },
    {
      thought: "Running pattern match against historical breakout scenarios...",
      conclusion: "78% match with Q3 2024 $BONK breakout pattern. Initiating position.",
    },
  ];

  const now = Date.now();
  return thoughts.map((t, i) => ({
    id: `log-${agentId}-${i}`,
    agentId,
    timestamp: new Date(now - i * 300000).toISOString(),
    ...t,
  }));
}

export function getAgentById(id: string): Agent | undefined {
  return MOCK_AGENTS.find((a) => a.id === id);
}

export function getAgentTrades(agentId: string): Trade[] {
  return generateMockTrades(20).filter((t) => t.agentId === agentId).length > 0
    ? generateMockTrades(20).map((t) => ({ ...t, agentId, agentName: getAgentById(agentId)?.name || "Unknown", agentAvatar: getAgentById(agentId)?.avatar || "?" }))
    : generateMockTrades(10).map((t) => ({ ...t, agentId, agentName: getAgentById(agentId)?.name || "Unknown", agentAvatar: getAgentById(agentId)?.avatar || "?" }));
}
