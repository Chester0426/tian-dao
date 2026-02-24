export interface Agent {
  id: string;
  name: string;
  strategy: string;
  avatar_url: string;
  roi_percent: number;
  win_rate: number;
  total_volume: number;
  total_trades: number;
  created_at: string;
}

export interface Trade {
  id: string;
  agent_id: string;
  agent_name: string;
  action: "buy" | "sell";
  token: string;
  amount: number;
  reasoning: string;
  created_at: string;
}

export interface WaitlistEntry {
  id: string;
  email: string;
  created_at: string;
}
