# /change Plan Templates

> Used by change.md Phase 1 to present the plan to the user.
> Each template corresponds to a change type classified in Step 3.
> "How" and "Approaches" sections use exploration results from plan-exploration.md.
> After drafting, run plan-validation.md — flagged items appear in Questions prefixed with "[Validation]".

## Feature Plan Template

```
## What I'll Add

**Feature:** [description from $ARGUMENTS]
**Complexity:** Simple (single layer) | Multi-layer (spans pages + API + DB)

**New pages/endpoints/commands (if any):**
- [Page Name] (/route) — [purpose]

**Files I'll create or modify:**
- [file] — [what changes]

**New database tables (if any):**
- [table] — stores [what]

**New analytics events (if any):**
- [event_name] — fires when [trigger]

**Golden Path impact:**
- Current: [show current golden_path from experiment.yaml, or "not defined"]
- After this change: [updated path if flow changes, or "unchanged"]

**System/Cron Behaviors impact:**
- Current: [show current behaviors with `actor: system/cron` from experiment.yaml, or "none defined"]
- After this change: [new system/cron behavior if adding webhook/admin/cron, or "unchanged"]

### How (Multi-layer only — skip for Simple)

**Data Model:** (skip if no database changes)
- [table]: [key columns with types] — RLS: [policy summary]
- Indexes: [columns indexed and why, or "primary key only"]
- [Note existing tables from exploration if relevant]

**API Contract:**
- `[METHOD] /api/[route]` — req: `{ [fields] }` → res: `{ [shape] }` | `4xx: { error: string }`
- [Pagination: cursor/offset if list endpoint, or omit]

**Component Tree:** (web-app only — skip for service/cli)
- [PageComponent] → [ChildComponent] → [GrandchildComponent]
- Reuses: [existing components found during exploration, or "none"]

**Data Flow:**
- [user action] → [client component] → [API route] → [DB operation] → [response] → [UI update]

### Approaches (Multi-layer only — skip for Simple)

| | Option A: [name] | Option B: [name] |
|---|---|---|
| Approach | [1-2 sentences] | [1-2 sentences] |
| Pros | [bullets] | [bullets] |
| Cons | [bullets] | [bullets] |
| Effort | [relative: less/more] | [relative: less/more] |

**Recommendation:** [Option X] because [1-sentence reason].

### Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| [what could go wrong] | [consequence] | [prevention/fallback] |
| ... | ... | ... |

(2-5 items. For Simple features with no notable risks, write "Low risk — isolated, single-layer change.")

**Questions:**
- [any ambiguities, or "None"]
- [if new library needed: "This feature needs [library]. Should I add it?"]
- [any items flagged by plan-validation.md, prefixed with "[Validation]"]
```

## Upgrade Plan Template

```
## Upgrade: [feature name]

**Current state:** Fake Door / Stub
**Target state:** Full integration with [service name]
**Credentials needed:** [env vars + how to obtain]

**Files to modify:**
- [file] — [what changes]

**Analytics changes:** Remove `fake_door: true` from activate event (now fires as real activation)

### How

**Integration Architecture:**
- Client → [API route] → [service SDK/REST call] → [response handling]
- Auth: [how the service authenticates — API key / OAuth / webhook signature]

**Error Handling Strategy:**
- Timeout: [approach — e.g., 10s timeout, show retry button]
- Rate limit: [approach — e.g., exponential backoff, queue]
- Invalid response: [approach — e.g., fallback UI, error toast]
- Service down: [approach — e.g., graceful degradation, cached data]

### Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| [what could go wrong] | [consequence] | [prevention/fallback] |
| ... | ... | ... |

(2-5 items.)

**Questions:**
- [any ambiguities, or "None"]
- [any items flagged by plan-validation.md, prefixed with "[Validation]"]
```

## Fix Plan Template

```
## Bug Diagnosis

**Bug:** [description from $ARGUMENTS]

**Root Cause Chain:**
1. [surface symptom — what the user sees]
2. [immediate cause — which code path produces it]
3. [root cause — why that code path is wrong]

**Files affected:**
- [file] — [what's wrong]

**Fix approach:** [what you'll change, minimal diff]

**Blast Radius:**
- Files that import from affected files: [list, or "none — isolated"]
- Analytics events on affected pages: [list, or "none"]
- Tests that cover affected code: [list, or "none"]

**Regression Risk:** [Low/Medium/High] — [1-sentence justification]
```

## Polish Plan Template

```
## Planned Changes

1. **[Page/Component]**: [what you'll change] — [why this improves things for target_user]
2. ...
```

## Analytics Plan Template

```
## Audit Report

### Standard Funnel Events
| Event | Expected Location | Status | Issue |
|-------|-------------------|--------|-------|
| [event from EVENTS.yaml] | [page] | ✅/❌/⚠️ | [issue or —] |

### Custom Events
| Event | Expected Location | Status | Issue |
|-------|-------------------|--------|-------|
| (from EVENTS.yaml custom_events) | ... | ... | ... |

### Suggested Custom Events (if any)
- [event_name] — fires when [trigger]
```

## Test Plan Template

```
## Smoke Test Plan

**Funnel Steps:**
| # | Event | Route | Browser Actions | Selectors |
|---|-------|-------|-----------------|-----------|
| 1 | [event] | [route] | [actions] | [selectors from app code] |

**Skipped:** retain_return (requires 24h delay)

**Activation Detail:**
- thesis: [from experiment.yaml]
- Activation test: [what the test will do]

**Files to Create/Modify:**
- [list of files]

**Template path:** Full templates (all assumes met) | No-Auth Fallback (assumes unmet: [list unmet category/value pairs])
```
