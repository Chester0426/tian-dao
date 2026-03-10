---
description: "Use when you have analytics data and want to decide what to do next. Analysis only — no code changes."
type: analysis-only
reads:
  - idea/experiment.yaml
  - EVENTS.yaml
  - idea/ads.yaml
stack_categories: [analytics]
requires_approval: false
references: []
branch_prefix: chore
modifies_specs: false
---
Review the experiment's progress and recommend what to do next.

This skill does NOT write code. It helps you decide what action to take, then points you to the right skill to execute it.

## Step 1: Read the experiment definition

- Verify `idea/experiment.yaml` exists. If not, stop and tell the user: "No experiment found. Create `idea/experiment.yaml` from the template first, then run `/bootstrap`."
- If `package.json` does not exist, stop and tell the user: "No app found. Run `/bootstrap` first to create the app, then run `/iterate` to review its progress."
- Run `npm run build`. If it fails, stop and tell the user: "The app has build errors. Run `/change fix build errors` to repair the codebase first, then return to `/iterate`."
- Verify `EVENTS.yaml` exists. If not, stop and tell the user: "EVENTS.yaml not found. This file defines all analytics events and is required. Restore it from your template repo or re-create it following the format in the EVENTS.yaml section of the template."
- Check if `stack.analytics` is present in experiment.yaml. If not, warn: "No analytics stack configured — skipping auto-query. You can provide funnel numbers manually in Step 2b, or add `analytics: posthog` to experiment.yaml `stack` and run `/change add analytics` for automated tracking." Skip Step 2a entirely and proceed to Step 2b.
- Read `idea/experiment.yaml` — understand the hypothesis:
  - What are we building? (`name`, `description`)
  - For whom? (`target_user`)
  - What does success look like? (`thesis`, `funnel` thresholds)
  - What behaviors exist? (`behaviors`)
  - What is the scope? (pages from `golden_path` for web-app, `endpoints` for service, `commands` for cli — from archetype's `required_idea_fields`)
- Read the archetype file at `.claude/archetypes/<type>.md` (type from experiment.yaml, default `web-app`). Note the `funnel_template` value:
  - `web` (web-app) — funnel events come from EVENTS.yaml `standard_funnel`
  - `custom` (service, cli) — funnel events come from EVENTS.yaml `custom_events` and the experiment's own event definitions
- Read `EVENTS.yaml` — understand what's being tracked (this is the canonical list of all events)

## Step 2: Gather funnel data and user feedback

### 2a: Attempt auto-query for funnel numbers

Read the analytics stack file (`.claude/stacks/analytics/<value>.md`). If it has an "Auto Query" section, follow its credential check and query procedure to automatically fetch funnel data.

If the auto-query succeeds, present the results for user verification:

```
## Auto-fetched Funnel Data (last <N> days)
| Event | Unique Users |
|-------|-------------|
| <first standard_funnel event> | <count> |
| <second standard_funnel event> | <count> |
| ... | ... |
Source: Analytics Query API (project_name = "<name>")
**Please verify.** Reply "looks good" to proceed, or provide corrections.
```

- Show all events from the query, including those with 0 counts
- Wait for user confirmation before proceeding to Step 3 verdict
- If the user replies "looks good" (or any affirmative), proceed to Step 3 with the auto-fetched data
- If the user provides corrections (e.g., "visit_landing should be 500"), update the affected counts and re-present the table for confirmation. Use the corrected values in Step 3.

### 2b: Fall back to manual input

If the analytics stack file has no "Auto Query" section, or credentials are missing, or the query fails, fall back to manual input.

Tell the user how to get the numbers. See the analytics stack file's "Dashboard Navigation" section for provider-specific instructions on how to pull funnel numbers. If no stack file exists or it lacks a "Dashboard Navigation" section, give general guidance.

> **How to get your funnel numbers:**
> Follow the dashboard instructions in your analytics stack file (`.claude/stacks/analytics/<value>.md`).
>
> If `funnel_template` is `web` (web-app): create a funnel using events from EVENTS.yaml `standard_funnel` in the order listed, then append `payment_funnel` events if `stack.payment` is present.
>
> If `funnel_template` is `custom` (service, cli): create a funnel using events from EVENTS.yaml `custom_events`. If `custom_events` is empty, use the typical events suggested in the archetype file (e.g., `api_call` → `activate` → `retain_return` for services, `command_run` → `activate` → `retain_return` for CLIs). Also include `payment_funnel` events if `stack.payment` is present.
>
> Filter by `project_name` equals your experiment.yaml `name` value. Present the actual event names to the user so they can find them in their dashboard.
>
> If you haven't deployed yet, the app isn't collecting data. For web-app and service archetypes, run `/deploy` first; for CLI archetypes, publish via `npm publish` or GitHub Releases (see the archetype file). Then return to `/iterate` after a few days of live traffic. If you haven't set up analytics yet, rough estimates are fine too (e.g., "about 200 landing page visits, maybe 20 signups").

Ask the user to provide funnel numbers — for each event in the funnel (from `standard_funnel` for web-app or `custom_events` for service/cli, plus `payment_funnel` if `stack.payment` is present), how many users? Present the actual event names from EVENTS.yaml so the user knows what to look for in their dashboard.

### 2c: Ask for qualitative data

Whether funnel numbers came from auto-query (2a) or manual input (2b), also ask the user to provide whatever they have. Not all of these will be available — use what you get:

1. **Custom event numbers** — if EVENTS.yaml `custom_events` is non-empty and not already fetched in 2a, ask for counts of each custom event. Include these in the Step 4 diagnosis as supplementary data below the standard funnel table.

2. **Timeline** — how far into the experiment timeline are we?

3. **Qualitative feedback** — any user quotes, complaints, feature requests, support messages?

4. **Observations** — anything the team has noticed (e.g., "users sign up but never create an invoice", "landing page bounce rate is high")

5. **Variant comparison (if experiment.yaml has `variants`)** — per-variant metrics:
   - `visit_landing` count per variant (filter by `variant` property)
   - `signup_complete` count per variant (if available, filter by UTM content or variant context)
   - `activate` count per variant (if available)
   - Which variant is getting the most traffic and which has the best conversion?

6. **Ads data (if /distribute has been run)** — if `idea/ads.yaml` exists:
   - Total spend so far
   - Clicks and CTR
   - Cost per click (CPC)
   - Conversions attributed to ads (`activate` events filtered by `utm_source` matching the channel from ads.yaml)

   How to get ads data: Open the campaign dashboard for your distribution channel and check Clicks, CTR, Avg CPC/CPM, Cost. For conversions: filter events in the analytics dashboard by `utm_source` matching the channel (e.g., `"google"`, `"twitter"`, `"reddit"` — see ads.yaml `channel` field).

## Step 3: Experiment Verdict

Before diagnosing details, assess overall experiment health. This verdict is the headline — present it first, prominently.

### 3a: Calculate progress

From the data gathered in Step 2, determine:
- **Time elapsed**: ask the user how many days the experiment has been running and the total planned duration. Calculate `time_pct = elapsed_days / total_days`.
- **Target progress**: extract the target from experiment.yaml `thesis` (e.g., "10+ will complete at least one paid invoice within 2 weeks" → target = 10 paid invoices). Compare against the closest matching funnel metric. Calculate `target_pct = achieved / target_number`.
- **Pace**: `pace = target_pct / time_pct`. A pace of 1.0 means exactly on track; >1.0 means ahead; <1.0 means behind.
- **Budget progress (if ads running)**: if the user provided ads spend data, calculate `budget_pct = spent / total_budget`.

### 3b: Apply verdict framework

Present the verdict table and determination:

| Dimension | Value |
|-----------|-------|
| Time | Day [N] of [total] ([time_pct]% elapsed) |
| Target | [achieved] of [target] [metric] ([target_pct]% achieved) |
| Pace | [pace]x ([interpretation]) |
| Budget | $[spent] of $[total] ([budget_pct]%) — only if ads running |

Then apply the decision tree:

| Condition | Verdict |
|-----------|---------|
| time_pct < 25% AND total visits < 30 | **TOO EARLY** — not enough data for a verdict. Keep running, check back in a few days. |
| pace >= 0.7 | **SCALE** — on track. Continue and optimize conversion at the biggest bottleneck. |
| pace 0.4–0.7 AND time_pct < 60% | **REFINE** — behind pace but recoverable. Focus on the biggest funnel bottleneck identified in Step 4. |
| pace 0.2–0.4 AND time_pct > 50% | **PIVOT** — there's signal, but the angle is wrong. Change messaging or target user. |
| pace < 0.2 AND time_pct > 50% | **KILL** — unlikely to reach target. Consider stopping. |
| 0 activations AND time_pct > 30% | **KILL** — zero demand signal. Stop spending, re-evaluate positioning. |

Output the verdict prominently:

> ### Verdict: [SCALE / KILL / PIVOT / REFINE / TOO EARLY]
>
> **[One-line reasoning]**

### 3c: Verdict caveats

- The verdict is a **guideline, not an order** — the user makes the final call
- Qualitative signals (user feedback, feature requests) can override quantitative pace
- If `thesis` target is not cleanly numeric (e.g., "validate that freelancers will pay"), use the closest measurable proxy and note the approximation
- For experiments without ads (organic only), budget dimension is omitted

## Step 3.5: Per-Hypothesis Verdicts

Read `.claude/spec-manifest.json`. If the file does not exist, skip this step entirely (backward compatible — experiments created before /spec won't have it).

For each hypothesis in `spec-manifest.json` where `status` is `"testing"` (not `"resolved"`):

1. **Dependency check**: if the hypothesis has `depends_on[]`, check whether any parent hypothesis has verdict `REJECTED`. If so, set this hypothesis's verdict to `BLOCKED` and skip metric comparison.
2. **Map metric**: match `success_metric` to the closest funnel metric from Step 2 data (e.g., "CTA click rate" → visit_landing-to-signup conversion, "signup rate" → signup_start count)
3. **Compare**: actual value vs `threshold`
4. **Verdict**:
   - `CONFIRMED` — actual >= threshold
   - `REJECTED` — actual < threshold AND sample size >= 30
   - `INCONCLUSIVE` — sample size < 30
   - `BLOCKED` — a parent in `depends_on[]` was REJECTED
5. **Confidence tag** based on sample size:
   - <30: "insufficient data"
   - 30-100: "directional signal"
   - 100-500: "reliable"
   - 500+: "high confidence"

Output:
```
Hypothesis Verdicts
───────────────────
  [CATEGORY]   [metric] [actual] vs [threshold]   [PASS ✓ / FAIL ✗ / ? INCONCLUSIVE / BLOCKED ⊘ (parent: h-XX)]  ([confidence] — [N] [unit])
  [CATEGORY]   [metric] [actual] vs [threshold]   [PASS ✓ / FAIL ✗ / ? INCONCLUSIVE / BLOCKED ⊘ (parent: h-XX)]  ([confidence] — [N] [unit])
  ...
```

If ALL testable hypotheses are CONFIRMED (excluding BLOCKED) and verdict from Step 3 is SCALE, note:
> All hypotheses confirmed. This experiment has validated its core assumptions. Consider graduating with `/harden`.

## Step 4: Diagnose the funnel

Analyze the data to find where the funnel breaks. Present a funnel visualization:

```
## Funnel Analysis

| Stage | Count | Conversion | Diagnosis |
|-------|-------|-----------|-----------|
| [1st funnel event] | [count] | — | [diagnosis] |
| [2nd funnel event] | [count] | [%] | ⚠️/✅/❌ [specific diagnosis] |
| ... (one row per funnel event — from standard_funnel or custom_events depending on archetype) | ... | ... | ... |
| [payment_funnel events if stack.payment present] | ... | ... | ... |
| [retain_return] | [count] | — | [retention diagnosis] |

If `stack.payment` is absent from experiment.yaml, omit the `pay_start` and `pay_success` rows from the funnel table.

> Note: `retain_return` is a retention metric, not a conversion step. Show it below the funnel or as a separate row — it does not have a meaningful conversion rate relative to the row above it.

## Biggest Bottleneck
Activation (signup → first value): 22% conversion
Users sign up but don't [complete the core action].
```

Focus on the **biggest drop-off** in the funnel. That's where effort has the highest leverage.

### Validation Scorecard

Map funnel metrics to validation dimensions. Score each 0-100 as `(actual / threshold) * 100`, capped at 100.

| Dimension | Metric | Actual | Threshold | Score | Confidence | Available |
|-----------|--------|--------|-----------|-------|------------|-----------|
| REACH | ad CTR + visit count | [value] | [threshold] | [0-100] | [tag] | L1+ |
| DEMAND | CTA click rate + signup rate | [value] | [threshold] | [0-100] | [tag] | L1+ |
| MONETIZE | pricing interaction + payment | [value] | [threshold] | [0-100] | [tag] | L2+ |
| RETAIN | return visits + repeat behavior | [value] | [threshold] | [0-100] | [tag] | L3+ |

- If experiment level < dimension level, show "—" for that row with "(not tested at this level)"
- Confidence per-dimension is based on sample size (same tags as Step 3.5)
- Threshold sourcing (in priority order): (1) `funnel.<dimension>.threshold` from experiment.yaml, (2) spec-manifest.json `hypotheses[].threshold` mapped by category, (3) EVENTS.yaml funnel benchmarks as fallback

#### Custom funnel mapping (service/cli archetypes)

When `funnel_template` is `custom`, map custom funnel events to the 4 standard dimensions for consistent Scorecard output:

| Custom Stage | Dimension |
|-------------|-----------|
| `api_call` / `command_run` | REACH |
| `activate` | DEMAND |
| `pay_*` | MONETIZE |
| `retain_return` | RETAIN |

Apply these dimension labels in the Scorecard output so that the 4-column structure (REACH, DEMAND, MONETIZE, RETAIN) remains consistent regardless of archetype.

#### Decision Framework Reference

The `decision_framework` field in experiment.yaml `funnel` section is human-readable documentation of the experiment's decision criteria. The actual verdict logic uses the two-tier approach: pace-based overall verdict (Step 3) + per-dimension Scorecard ratios (Step 4). The `decision_framework` field serves as operator context — display it in the Step 7 summary for reference but do not use it to override the algorithmic verdict.

### Bottleneck

Identify the dimension with the lowest `actual / threshold` ratio (excluding dimensions not available at the current level):

```
⚠ Bottleneck: [DIMENSION] (ratio [N.NN]) — [dimension-specific recommendation]
```

Dimension-specific recommendations:
- **REACH** → improve ad targeting, headline, or channel selection
- **DEMAND** → improve CTA clarity, value proposition, or signup friction
- **MONETIZE** → adjust pricing, add value justification, or feature comparison
- **RETAIN** → improve onboarding, engagement hooks, or usage feedback

### Ads Performance (if ads.yaml exists)

If `idea/ads.yaml` exists and the user provided ads data in Step 2, include this table:

```
## Ads Performance

| Metric | Actual | Threshold | Status |
|--------|--------|-----------|--------|
| CTR | [%] | >1% | [status] |
| CPC | [$] | <$[max_cpc from ads.yaml guardrails.max_cpc_cents / 100] | [status] |
| Spend | [$] | /$[total_budget from ads.yaml budget.total_budget_cents / 100] | [status] |
| Paid activations | [N] | >=[thresholds.expected_activations from ads.yaml] | [status] |
```

Read `idea/ads.yaml` to populate threshold values. Use the user-provided ads data for actual values.

### Variant Winner Analysis (if experiment.yaml has `variants`)

If the user provided per-variant metrics in Step 2, present a comparison:

```
## Variant Comparison

| Variant | Visits | Signups | Activations | Visit→Signup | Signup→Activate |
|---------|--------|---------|-------------|--------------|-----------------|
| [slug]  | [N]    | [N]     | [N]         | [%]          | [%]             |
| [slug]  | [N]    | [N]     | [N]         | [%]          | [%]             |

**Winner:** [slug] — [reason]
**Confidence:** [Clear (2x+ difference and 50+ visits per variant) | Likely (1.5x+ and 30+ visits) | Too early (<30 visits per variant — extend the test)]
```

- **Clear winner (2x+ conversion rate, 50+ visits per variant)**: recommend consolidating on the winning variant — remove the losing variant, update root `/` to the winner's messaging
- **Likely winner (1.5x+, 30+ visits)**: recommend extending the test for more data, or consolidating if time is short
- **Too early (<30 visits per variant)**: recommend extending the test duration or increasing traffic — no reliable signal yet
- **No winner (similar conversion rates)**: recommend testing a new messaging angle — current variants may not differentiate enough

## Step 5: Recommend actions

Based on the diagnosis, recommend 1-3 specific actions. For each:
- **What**: concrete description of the change
- **Why**: how it addresses the bottleneck
- **Skill to use**: which /command to run
- **Expected impact**: what metric should improve

Common patterns:

| Bottleneck | Typical Actions |
|-----------|----------------|
| Low visit → signup | `/change improve landing page copy and CTA` |
| Low signup_start → complete | `/change fix signup errors` or `/change reduce signup form friction` |
| Low activation | `/change simplify [first-value action]` |
| Low pay conversion | `/change improve pricing/payment UX` |
| Low retention | `/change add [engagement hook]` |
| Everything low | Reconsider `target_user` or `distribution` — may be a positioning problem, not a product problem |

**Service/CLI bottleneck patterns (when `funnel_template` is `custom`):**

| Bottleneck | Typical Actions |
|-----------|----------------|
| Low API calls / command runs | Distribution problem — how do users discover the service/CLI? |
| Low activation (calls exist but no first-value action) | `/change simplify [activation action]` or improve onboarding |
| Low retention | `/change add [engagement hook]` or improve core value delivery |
| Everything low | Reconsider `target_user` or distribution channel |

| One variant clearly wins | `/change` to consolidate — remove losing variant, make winner the sole landing page |
| No variant winner | Extend test for more data, or `/change` to try a new messaging angle |
| Verdict is SCALE with strong metrics | Suggest `/harden` to graduate: "Your metrics indicate product-market fit. Run `/harden` to add TDD coverage to critical paths before scaling." |
| Production incident | `/rollback` to revert deploy, then `/change fix <root cause>` |

Present recommendations in priority order (highest impact first).

### Ads Decision (if ads.yaml exists and day 7 or budget exhausted)

If `idea/ads.yaml` exists but the user reported no ads data in Step 2 (campaign not yet launched), skip this section and instead note: "Ads config generated but campaign not yet launched. Create the campaign in your distribution channel's platform using `idea/ads.yaml`, then return to `/iterate` after a few days of data."

If `idea/ads.yaml` exists and the campaign has been running for the full `budget.duration_days` or `budget.total_budget_cents` is exhausted, present a go/no-go decision:

| Signal | Interpretation | Action |
|--------|---------------|--------|
| 3+ paid activations | Demand validated | Continue: increase budget or `/change` to improve conversion |
| 1-2 paid activations | Weak signal | Extend 3 days or improve landing page, then re-evaluate |
| 0 activations, >10 signups | Activation problem | `/change` to reduce activation friction |
| 0 activations, >50 clicks, <3 signups | Landing page problem | `/change` to improve landing page |
| 0 activations, <50 clicks, <1% CTR | Targeting problem | Revise targeting in ads.yaml, re-run `/distribute` |
| 0 activations, <50 clicks, >1% CTR | Budget/time problem | Extend budget or experiment duration |

Read `thresholds.go_signal` and `thresholds.no_go_signal` from `idea/ads.yaml` and use them as the primary decision criteria. The table above provides additional diagnostic detail.

### Save analysis for /change context

Write `.claude/iterate-manifest.json`:
```json
{
  "verdict": "<SCALE|KILL|PIVOT|REFINE|TOO_EARLY>",
  "bottleneck": {
    "stage": "<funnel stage name>",
    "conversion": "<percentage>",
    "diagnosis": "<one-line diagnosis>",
    "dimension": "<REACH|DEMAND|MONETIZE|RETAIN>",
    "ratio": 0.65,
    "recommendation": "<dimension-specific recommendation>"
  },
  "recommendations": [
    {
      "action": "<what to do>",
      "skill": "</change ...>",
      "expected_impact": "<which metric improves>"
    }
  ],
  "variant_winner": "<slug or null>",
  "analyzed_at": "<ISO 8601>",
  "hypothesis_verdicts": [
    {
      "hypothesis_id": "<id from spec-manifest>",
      "metric_name": "<mapped metric>",
      "actual_value": "<value>",
      "threshold": "<threshold>",
      "verdict": "<CONFIRMED|REJECTED|INCONCLUSIVE|BLOCKED>",
      "blocked_by": "<parent hypothesis id or null>",
      "sample_size": 0,
      "confidence_level": "<insufficient data|directional signal|reliable|high confidence>"
    }
  ],
  "funnel_scores": {
    "reach": { "score": 0, "confidence": "<tag>", "sample_size": 0, "threshold_source": "<experiment.yaml|spec-manifest|events-yaml>" },
    "demand": { "score": 0, "confidence": "<tag>", "sample_size": 0, "threshold_source": "<experiment.yaml|spec-manifest|events-yaml>" },
    "monetize": { "score": 0, "confidence": "<tag>", "sample_size": 0, "threshold_source": "<experiment.yaml|spec-manifest|events-yaml>" },
    "retain": null
  }
}
```

- `hypothesis_verdicts` and `funnel_scores` are only populated when spec-manifest.json exists. Omit both fields for experiments without /spec.
- `bottleneck.dimension`, `bottleneck.ratio`, and `bottleneck.recommendation` are populated from the Validation Scorecard. For experiments without spec-manifest, populate from funnel analysis only (`dimension` and `ratio` may be null).

This file is read by `/change` to provide context for the next iteration.

## Step 6: Update the experiment plan (if needed)

If the diagnosis reveals a need to change direction:

### Minor pivot (keep same target user, adjust behaviors)
- Propose the changes to the user and list the specific edits to experiment.yaml
- The user should edit experiment.yaml manually, then run `/change ...` to implement the changes (or `make clean` followed by `/bootstrap` to rebuild from scratch)

### Pivot (verdict is PIVOT — signal exists but wrong angle)
- Identify what IS working (which funnel stage converts well)
- Propose messaging or positioning changes that preserve what works
- The user should run `/change` to adjust copy/CTA/targeting, NOT rebuild from scratch

### Major pivot or stop (verdict is NO-GO)
- Present the case: "The Step 3 verdict is NO-GO. The data suggests [current approach] isn't working because [reason]. Consider targeting [new user] or solving [different problem]."
- Do NOT update experiment.yaml for major pivots — the user should think about this and manually edit experiment.yaml
- Remind them: "After updating experiment.yaml, run `make clean` then `/bootstrap` to start a new experiment (or in a fresh repo), or `/change ...` to iteratively shift the existing one."

### On track (verdict is SCALE)
- Say so clearly: "The Step 3 verdict is SCALE. You're on track. [X] of [target from thesis] achieved with [Y days] remaining."
- Recommend: keep going, focus on distribution, or run `/change improve conversion` to improve conversion
- If the experiment shows strong, sustained traction: suggest `/harden` as a graduation step: "Consider graduating to production quality: run `/harden` to add TDD coverage to critical paths before scaling. This adds specification tests to auth, payment, and core business logic."

## Step 7: Summarize next steps

End with a clear, numbered action list. Prepend the verdict from Step 3:

```
## Recommended Next Steps

**Verdict: [SCALE/KILL/PIVOT/REFINE/TOO EARLY]** — [one-line summary]

1. Run `/change sharpen landing page headline to address [specific user pain]`
2. Run `/change add onboarding checklist after signup`
3. Post in [distribution channel from experiment.yaml] — drive more top-of-funnel traffic

Your measurement window ends in [X days]. [Verdict-specific guidance].
```

### Retro reminder
If the experiment is near its planned end date or the user is considering stopping:
> Your measurement window ends in [X days]. When you're ready to wrap up, run **`/retro`** to generate a structured retrospective and file it as feedback on the template repo.

### Next Check-in

Based on the measurement window and current progress, provide a concrete schedule:

```
## Next Check-in

| Milestone | Date | Action |
|-----------|------|--------|
| Next data check | [3 days from now] | Run `/iterate` again |
| Decision point | [when time_pct hits 50%] | Verdict becomes actionable — REFINE/KILL verdicts require decision |
| Window closes | [experiment end date] | Run `/retro` to file retrospective |
```

- Calculate dates from the experiment timeline and the elapsed days reported in Step 3
- If verdict is TOO EARLY, set next check-in to 3 days or when 30+ visits are expected
- If verdict is KILL, the next check-in is NOW — recommend immediate decision
- Tell the user: "Set a calendar reminder for [next check-in date] to run `/iterate` again."

## Do NOT
- Write code or modify source files — this skill is analysis only
- Recommend more than 3 actions — focus is more valuable than breadth
- Recommend actions outside the defined commands (bootstrap, change, iterate, retro, distribute, verify)
- Be vague — every recommendation must be specific enough to act on
- Ignore the data — don't recommend features if the funnel shows a landing page problem
- Recommend adding features when the real problem is distribution or positioning
