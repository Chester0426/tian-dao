# /change Plan Templates

> Used by change.md Phase 1 to present the plan to the user.
> Each template corresponds to a change type classified in Step 3.

## Feature Plan Template

```
## What I'll Add

**Feature:** [description from $ARGUMENTS]
**Complexity:** Simple (single layer) | Multi-layer (spans pages + API + DB)

**New pages (if any):**
- [Page Name] (/route) — [purpose]

**Files I'll create or modify:**
- [file] — [what changes]

**New database tables (if any):**
- [table] — stores [what]

**New analytics events (if any):**
- [event_name] — fires when [trigger]

**Golden Path impact:**
- Current: [show current golden_path from idea.yaml, or "not defined"]
- After this change: [updated path if flow changes, or "unchanged"]

**Critical Flows impact:**
- Current: [show current critical_flows from idea.yaml, or "none defined"]
- After this change: [new flow if adding webhook/admin/cron, or "unchanged"]

**Questions:**
- [any ambiguities, or "None"]
- [if new library needed: "This feature needs [library]. Should I add it?"]
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

**Questions:**
- [any ambiguities, or "None"]
```

## Fix Plan Template

```
## Bug Diagnosis

**Bug:** [description from $ARGUMENTS]
**Root cause:** [why this happens]

**Files affected:**
- [file] — [what's wrong]

**Fix approach:** [what you'll change, minimal diff]
**Risk:** [what else could be affected, or "Low — isolated change"]
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
- primary_metric: [from idea.yaml]
- Activation test: [what the test will do]

**Files to Create/Modify:**
- [list of files]

**Template path:** Full templates (all assumes met) | No-Auth Fallback (assumes unmet: [list unmet category/value pairs])
```
