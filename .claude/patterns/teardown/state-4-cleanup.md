# STATE 4: CLEANUP

**PRECONDITIONS:**
- Deletion verified (STATE 3 POSTCONDITIONS met)

**ACTIONS:**

### Step 4: Cleanup

1. Delete `.claude/deploy-manifest.json`
2. Remove `.env.local` if it exists (contains deployed credentials that are now invalid).
   Ask user first: "`.env.local` contains credentials for the deleted infrastructure.
   Delete it? (y/n)"

### Step 5: Summary

```
## Teardown Complete

**Deleted:**
- [For each successfully deleted resource] <provider> <resource type> <id>
- PostHog dashboard #<id>

**Failed (manual cleanup needed):**
- <resource> — <dashboard URL from stack file's Teardown section>

**External services (manual cleanup):**
- <service> — <dashboard URL>

**Deletion Verification:**
[Include provision scanner output table from STATE 3]

**Local cleanup:**
- .claude/deploy-manifest.json deleted
- [.env.local deleted / .env.local kept]

**What's preserved:**
- All source code on main branch
- experiment.yaml, experiment/EVENTS.yaml (experiment definition)
- Migration files (can re-deploy with /deploy)

To re-deploy this experiment: run `/deploy` again.
To archive this experiment: `gh release create v1.0 --notes "Experiment <name> concluded"`
```

**POSTCONDITIONS:**
- `.claude/deploy-manifest.json` deleted
- `.env.local` deleted (if user approved) or kept
- Summary printed to user

**VERIFY:**
```bash
test ! -f .claude/deploy-manifest.json && echo "OK" || echo "FAIL"
```

**STATE TRACKING:** After postconditions pass, mark this state complete:
```bash
bash .claude/scripts/advance-state.sh teardown 4
```

**NEXT:** TERMINAL
