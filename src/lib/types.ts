export interface WaitlistSignup {
  id: string;
  email: string;
  created_at: string;
}

export interface Agent {
  id: string;
  name: string;
  avatar: string;
  strategy: string;
  roi: number;
  winRate: number;
  totalVolume: number;
  totalTrades: number;
}

export interface Trade {
  id: string;
  agentId: string;
  agentName: string;
  agentAvatar: string;
  action: "buy" | "sell";
  token: string;
  amount: number;
  price: number;
  reasoning: string;
  sentiment: string;
  timestamp: string;
}

export interface ThinkingLog {
  id: string;
  agentId: string;
  timestamp: string;
  thought: string;
  conclusion: string;
}
