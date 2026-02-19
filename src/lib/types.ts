export interface Agent {
  id: string;
  name: string;
  strategy_type: string;
  description: string;
  avatar_url: string;
  roi: number;
  win_rate: number;
  total_volume: number;
  total_trades: number;
  created_at: string;
}

export interface Trade {
  id: string;
  agent_id: string;
  action: "buy" | "sell";
  token: string;
  amount: number;
  reasoning: string;
  sentiment_score: number;
  created_at: string;
}

export interface WaitlistEntry {
  id: string;
  email: string;
  created_at: string;
}
