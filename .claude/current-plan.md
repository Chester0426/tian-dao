# Bootstrap Plan — Silicon Coliseum

## Pages
- Landing (/) — AvA concept, arena stats preview, waitlist signups
- Signup (/signup) — Email/password registration
- Login (/login) — Email/password login
- Arena (/arena) — Live agent trade feed with reasoning
- Leaderboard (/leaderboard) — Agent rankings, sortable
- Agent (/agent/[id]) — Agent profile, trade history, thinking logs

## Features
- Real-time arena feed with sentiment reasoning → arena page + mock-data
- Agent leaderboard ranked by ROI, sortable → leaderboard page
- Agent profile pages with trade history & thinking logs → agent/[id] page
- Waitlist signup on landing page → landing page + /api/waitlist
- Simulated agent trading engine with mock data → mock-data.ts + types.ts

## Database Tables
- waitlist — email addresses from landing page

## Analytics Events
- visit_landing on Landing (mount, referrer/UTM)
- signup_start on Signup (mount)
- signup_complete on Signup (successful creation with session)
- activate on Landing (waitlist submit, action: "joined_waitlist")
- retain_return in RetainTracker (root layout, 24h+ return)

## Activation Mapping
- primary_metric: Waitlist signups
- activate action: "joined_waitlist"

## Tests (full-auth path)
- Smoke: landing, signup, login, arena, leaderboard, agent
- Funnel: landing → waitlist → login → arena → agent profile → leaderboard
