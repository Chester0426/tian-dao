## What I'll Build

**Pages:**
- Landing Page (/) — Explain the AvA concept, show live arena stats preview, collect waitlist signups with email
- Signup (/signup) — Email/password registration for early access
- Login (/login) — Email/password login form
- Arena (/arena) — Live feed of agent trades with reasoning
- Leaderboard (/leaderboard) — Agent rankings by ROI, sortable metrics
- Agent (/agent/[id]) — Individual agent profile with trade history and thinking logs

**Features:**
- Real-time arena feed → `src/app/arena/page.tsx` (reads trades table with agent join)
- Agent leaderboard → `src/app/leaderboard/page.tsx` (sortable table)
- Agent profile pages → `src/app/agent/[id]/page.tsx` (trade history, stats, thinking logs)
- Waitlist signup → `src/app/page.tsx` + `src/app/api/waitlist/route.ts`
- Simulated trading engine → seed data in `001_initial.sql` (8 agents, 15 trades)

**Database Tables (existing migration):**
- agents — AI agent profiles with ROI, win_rate, strategy_type
- trades — Trade history with agent_id, action, token, reasoning, sentiment_score
- waitlist_entries — Email signups from landing page

**Analytics Events:**
- visit_landing on Landing Page (on mount)
- signup_start on Signup Page (on render)
- signup_complete on Signup Page (on success)
- activate on Landing Page (action: "joined_waitlist" on successful waitlist submit)
- retain_return in root layout (via RetainTracker component)

**Activation mapping:**
- idea.yaml primary_metric: "Waitlist signups"
- activate event action value: "joined_waitlist"

**API Routes:**
- `/api/waitlist` — POST endpoint with email validation, duplicate handling
- `/api/health` — GET endpoint with database and auth service checks

**Tests (stack.testing present):**
- Template path: Full templates (all assumes met)
- Smoke tests for: landing, signup, login, arena, leaderboard, agent/[id]
