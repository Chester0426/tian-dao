---
description: "Transform an idea + level into a complete experiment.yaml with hypotheses, behaviors, variants, and stack."
type: code-writing
reads: []
stack_categories: []
requires_approval: true
references: []
branch_prefix: feat
modifies_specs: true
---

> **Platform mode (`ASSAYER_API_URL`):** When running under the Assayer platform,
> idea text and level are pre-configured in experiment.yaml. Input collection
> steps auto-proceed, and research failures auto-select "override". Approval
> gates (Step 6 CHECKPOINT) remain interactive for session-resume in the web UI.

Transform an idea into a complete experiment specification: $ARGUMENTS

## Step 1: Parse Input

Parse `$ARGUMENTS` for:
- **Idea text**: the main argument (everything except flags)
- **Level flag**: `--level 1`, `--level 2`, or `--level 3` (default: `1`)

Level definitions:
- **Level 1 — Landing test**: static page, analytics, no database or auth. Tests demand signals.
- **Level 2 — Interactive MVP**: Level 1 + database + core feature. Tests feasibility and retention.
- **Level 3 — Full MVP**: Level 2 + auth + payments (if applicable). Tests monetization.

### Fallback
If `$ARGUMENTS` is empty or contains only a level flag:
- Check if `idea/experiment.yaml` exists and has non-TODO `thesis` and `description` fields.
  If so, extract the idea text from those fields and confirm with the user:
  > Found existing thesis/description in experiment.yaml. Using this as the idea input:
  > "[extracted text]"
  > Proceed? (yes/no)
- If experiment.yaml doesn't exist or fields are still TODO: stop with:
  > **Usage:** `/spec <idea description> [--level 1|2|3]`
  >
  > Example: `/spec Freelancers waste hours on invoicing. A tool that generates invoices from time logs. --level 2`
  >
  > Provide at least a sentence describing the problem and proposed solution.

### Guards
- If the idea text (excluding flags) is fewer than 20 characters: stop with:
  > That's too brief. Describe the problem and solution in at least a sentence so I can generate meaningful hypotheses.
- If the level is not 1, 2, or 3: stop with:
  > Invalid level. Use `--level 1` (landing test), `--level 2` (interactive MVP), or `--level 3` (full MVP).

### Confirm
Display the parsed input and confirm before proceeding:
> **Idea:** [parsed idea text]
> **Level:** [1/2/3] — [level name]
>
> Proceed with this? (yes / change level / rephrase)

Wait for user confirmation.

> **Platform mode:** If `ASSAYER_API_URL` is set, auto-proceed — idea and level
> are pre-configured by the platform. Do not prompt interactively.

## Step 1.5: Input Sufficiency Check

After confirming the idea text and level, assess 3 information dimensions in the parsed input:

| Dimension | What to look for | Example (sufficient) |
|-----------|-----------------|---------------------|
| **Target user** | A describable person, not just "people" or "users" | "freelancers billing <5 clients/month" |
| **Problem** | A stated pain with some specificity | "wastes 2-3 hours/week on manual invoicing" |
| **Solution shape** | A proposed mechanism, not just a category | "single-page tool that generates invoices from time logs" |

For each dimension, classify as:
- **✓ present** — explicitly stated in the input
- **~ inferable** — can be reasonably derived (mark as assumption)
- **✗ missing** — cannot be determined

### Decision logic

- **All 3 present/inferable** → show assumptions inline with the Step 1 Confirm (zero added latency), proceed to Step 2
- **1 missing** → ONE follow-up message asking exactly what's missing, with `proceed` escape hatch
- **2-3 missing** → input too vague, ask user to elaborate (no escape hatch)

### Rules
- Maximum ONE round of follow-up — never enter a Q&A loop
- Inference-first — if you can reasonably infer, don't ask
- Show inferences — let user confirm or correct
- Merge follow-up answers with original input, then continue to Step 2 (no re-check)
- `proceed` escape hatch — user can skip and let AI infer everything

> **Platform mode:** If `ASSAYER_API_URL` is set, auto-use the "proceed" escape
> hatch for any missing dimensions. Do not prompt interactively.

### Output: All present/inferable (merged into Confirm)

When all 3 dimensions are present or inferable, merge the sufficiency check into the Step 1 Confirm display:

```
**Idea:** Freelancers billing <5 clients waste 2-3 hours on invoicing...
**Level:** 2 — Interactive MVP

Understanding:
✓ Target user: freelance designers billing 1-5 clients/month
✓ Problem: 2-3 hours/week wasted on manual invoicing
✓ Solution: single-page tool, invoice in <60 seconds

Proceed with this? (yes / change level / rephrase)
```

### Output: 1 missing

```
I have enough to start, but one detail would sharpen the spec:

✓ Target user: freelancers (inferred: billing few clients)
✓ Solution: invoice generation tool
✗ Problem: What specific pain does manual invoicing cause?
   (e.g., "wastes 3 hours/week" or "clients pay late")

Answer this, or say "proceed" to let me infer.
```

Wait for user response. Merge answers (or inferences if user said "proceed") with original input, then continue to Step 2.

### Output: 2-3 missing

```
The idea is too vague to generate a useful spec. Please provide more detail:

✗ Target user: Who specifically has this problem?
✗ Problem: What pain are they experiencing?
✗ Solution: What would the tool actually do?

Example: "Freelancers billing <5 clients waste 2-3 hours/week on manual invoicing.
A single-page tool that generates invoices from time logs."
```

Wait for user to elaborate, then restart from Step 1 with the enriched input.

## Step 2: Pre-flight Research

Conduct desk research across 4 dimensions. For each, produce a structured finding:

| Dimension | What to assess |
|-----------|---------------|
| **Market exists** | Is there an active market? Are people spending money or time on this problem today? |
| **Problem validated** | Have real users expressed this pain? (forums, reviews, social posts, surveys) |
| **Competitive landscape** | Who else solves this? What's their approach? Where are the gaps? |
| **ICP identified** | Can you name a specific, reachable person who has this problem? |

For each dimension, record:
- `hypothesis_id`: `research_<dimension>` (e.g., `research_market_exists`)
- `finding`: 1-2 sentence summary of what was found
- `sources`: list of source types checked (e.g., "Reddit threads", "G2 reviews", "App Store listings")
- `confidence`: `high` | `medium` | `low`
- `verdict`: `pass` | `caution` | `fail`

Use web search to gather real data. If web search is unavailable, use your training knowledge and mark confidence as `low`.

### Display results

```
Pre-flight Research                                    N/4 passed
──────────────────────────────────────────────────────────────────
[✓/⚠/✗] Market exists       [finding summary]        (confidence: high/medium/low)
[✓/⚠/✗] Problem validated   [finding summary]        (confidence: high/medium/low)
[✓/⚠/✗] Competitive gaps    [finding summary]        (confidence: high/medium/low)
[✓/⚠/✗] ICP identified      [finding summary]        (confidence: high/medium/low)
```

Use `✓` for pass, `⚠` for caution, `✗` for fail.

### Stop on critical failure
If 2+ dimensions are `fail`: stop and tell the user:
> **Pre-flight failed.** [N] of 4 research checks failed. This idea may need rethinking before investing in an experiment.
>
> [List failed dimensions with reasons]
>
> Options:
> 1. Revise your idea and re-run `/spec`
> 2. Say "override" to proceed anyway (research will be marked as low-confidence)

Wait for the user to revise, override, or abandon.

> **Platform mode:** If `ASSAYER_API_URL` is set, auto-select "override" and
> proceed with low-confidence research. Do not prompt interactively.

## Step 3: Generate Hypotheses

Generate 5-10 hypotheses spanning these categories:

| Category | What it tests | Example |
|----------|--------------|---------|
| `demand` | Do people want this? | "At least N% of landing visitors will click the CTA" |
| `reach` | Can we find these people? | "We can acquire N visitors from [channel] in [time]" |
| `feasibility` | Can we build this? | "Core feature can be built with [stack] in [time]" |
| `monetize` | Will people pay? | "N% of active users will start a checkout" |
| `retain` | Will people come back? | "N% of users return within 7 days" |

### Hypothesis fields
Each hypothesis must have:
```yaml
- id: h-01                       # Sequential zero-padded: h-01, h-02, ...
  category: demand               # demand | reach | feasibility | monetize | retain
  statement: "..."               # Testable claim with specific numbers
  success_metric: "..."          # What to measure
  threshold: "..."               # Pass/fail number (e.g., ">5% CTR", ">=50 signups")
  priority_score: 80             # 0-100, higher = test first
  experiment_level: 1            # Minimum level needed to test this (1, 2, or 3)
  depends_on: []                 # List of hypothesis IDs this depends on
  status: pending                # pending | resolved
```

### Rules
- Research-type hypotheses from Step 2 are included with `status: resolved` and their verdicts
- Every hypothesis MUST have a concrete, numeric `threshold` — no vague language
- Filter: only include hypotheses where `experiment_level <= selected level`
- Minimum 5 hypotheses after filtering. If fewer, add more at the selected level.
- At least one hypothesis per category that applies to the selected level:
  - Level 1: demand, reach required
  - Level 2: demand, reach, feasibility, monetize, retain required
  - Level 3: all five categories required
- `monetize` hypotheses appear at Level 2+
- Sort by `priority_score` descending

## Step 4: Derive Behaviors

Convert each **pending** (experiment-type) hypothesis into testable behaviors using given/when/then format.

For each hypothesis, derive 1-3 behaviors that, if observed, would validate or invalidate it.

### Behavior fields
```yaml
- id: b-01                      # Sequential zero-padded: b-01, b-02, ...
  hypothesis_id: h-01           # Which hypothesis this validates
  given: "A visitor lands on the landing page"
  when: "They read the headline and see the CTA"
  then: "They click the CTA button"
  tests:                         # 1-3 verifiable assertions
    - "Landing page renders CTA button"
    - "Clicking CTA navigates to signup"
  level: 1                       # Matches the hypothesis level
```

For system or scheduled behaviors, add `actor` and `trigger`:
```yaml
- id: b-05
  actor: system                  # system | cron (default: user, omit for user behaviors)
  trigger: "stripe webhook checkout.session.completed"
  hypothesis_id: h-03
  given: "..."
  when: "..."
  then: "..."
  tests:
    - "..."
  level: 3
```

### Rules
- Every pending hypothesis must have at least one behavior
- Behaviors must be observable and measurable (map to analytics events or database state)
- Use concrete user actions, not abstract concepts ("clicks the CTA" not "shows interest")
- Behaviors replace the traditional `features` list — each behavior IS a feature requirement
- Each behavior must have 1-3 `tests` entries — verifiable assertions about the behavior
- System/cron behaviors should be derived from monetize or operational hypotheses

## Step 5: Generate Variants

Generate 3-5 offer variants. Each variant is a different messaging angle for the same product.

### Variant fields
```yaml
- slug: time-saver               # URL-safe, lowercase, hyphens
  headline: "..."                 # Max 10 words, benefit-focused
  subheadline: "..."              # Max 25 words, how-it-works
  cta: "..."                      # Action verb + outcome (e.g., "Start invoicing free")
  pain_points:                    # Exactly 3
    - "..."
    - "..."
    - "..."
  promise: "..."                  # What they get (1 sentence)
  proof: "..."                    # Why believe it (social proof, mechanism, guarantee)
  urgency: "..."                  # Why now (scarcity, timing, cost of delay)
```

### Rules
- Headlines must have >30% word difference between any two variants (no minor rewording)
- Each variant targets a different emotional angle (e.g., time-saving vs cost-saving vs status)
- `pain_points` must be specific to the target user, not generic
- If Level 3 AND monetize hypotheses exist: add `pricing_amount` and `pricing_model` fields to each variant

## Step 6: Assemble experiment.yaml

Build the complete experiment.yaml with these 7 sections:

### Section 1 — Identity
```yaml
name: <slugified-name>
type: web-app                    # web-app | service | cli
level: <selected level>
status: draft
```

### Section 2 — Intent
```yaml
description: |
  <2-3 sentences, refined from idea + research>

thesis: "<If [action], then [outcome], as measured by [metric]>"
target_user: "<Specific ICP>"

distribution: |
  <Channels from reach hypotheses>

hypotheses:
  <all from Step 3>
```
- `description` merges problem + solution into one field
- `thesis` is required
- `hypotheses` are inline under Intent

### Section 3 — Behaviors
```yaml
behaviors:
  <all from Step 4, with tests[] and optional actor/trigger>
```

### Section 4 — Journey
Derive golden_path from behaviors:
```yaml
golden_path:
  - step: "<description>"         # e.g., "Visit landing page"
    event: visit_landing
    page: landing
  # Continue through behavior chain to value moment
  - step: "<value-delivering action>"
    event: activate
    page: <value page>
target_clicks: <N>
```
- `step:` replaces the old `action:` field
- Pages are derived from golden_path — no separate `pages` section

### Section 5 — Variants
```yaml
variants:
  <all from Step 5>
```

### Section 6 — Funnel
```yaml
funnel:
  reach:
    metric: "<from reach hypothesis>"
    threshold: "<threshold>"
    available_from: L1
  demand:
    metric: "<from demand hypothesis>"
    threshold: "<threshold>"
    available_from: L1
  monetize:
    metric: "<from monetize hypothesis>"
    threshold: "<threshold>"
    available_from: L2
  retain:
    metric: "<from retain hypothesis>"
    threshold: "<threshold>"
    available_from: L3

decision_framework:
  scale: "<condition>"
  refine: "<condition>"
  pivot: "<condition>"
  kill: "<condition>"
```

### Section 7 — Stack + Deploy
Stack is deterministic from level:

**Level 1:**
```yaml
stack:
  services:
    - name: app
      runtime: nextjs
      hosting: vercel
      ui: shadcn
      testing: playwright
  analytics: posthog

deploy:
  url: null
  repo: null
```

**Level 2:** Level 1 +
```yaml
  database: supabase
```

**Level 3:** Level 2 +
```yaml
  auth: supabase
```

If monetize hypotheses exist at Level 3, also add:
```yaml
  payment: stripe
```

### CHECKPOINT

Present the assembled YAML in full. Then say:
> **Review the experiment specification above.**
>
> - Check that hypotheses match your intuition
> - Check that behaviors cover what you want to test
> - Check that variants feel genuinely different
> - Check that the stack matches your needs
>
> Reply **approve** to write the file, or tell me what to change.

**STOP.** Do NOT write any files until the user explicitly approves.

If the user requests changes, revise the YAML and present it again. Repeat until approved.

## Step 7: Write Files and Confirm

After the user approves:

### 7a: Write experiment.yaml
Write the approved YAML to `idea/experiment.yaml`.

### 7b: Write spec-manifest.json
Write `.claude/spec-manifest.json` with the full research and hypothesis details:
```json
{
  "spec_version": "1.0",
  "created_at": "<ISO timestamp>",
  "level": <N>,
  "research": {
    "market_exists": { "finding": "...", "sources": [...], "confidence": "...", "verdict": "..." },
    "problem_validated": { "finding": "...", "sources": [...], "confidence": "...", "verdict": "..." },
    "competitive_landscape": { "finding": "...", "sources": [...], "confidence": "...", "verdict": "..." },
    "icp_identified": { "finding": "...", "sources": [...], "confidence": "...", "verdict": "..." }
  },
  "hypotheses": [
    { "id": "...", "category": "...", "statement": "...", "success_metric": "...", "threshold": "...", "priority_score": 80, "experiment_level": 1, "depends_on": [], "status": "..." }
  ],
  "behaviors": [
    { "id": "...", "hypothesis_id": "...", "given": "...", "when": "...", "then": "...", "tests": ["..."], "level": 1 }
  ],
  "variants": [
    { "slug": "...", "headline": "...", "headline_word_diff_vs_others": ">30%" }
  ],
  "decision_framework": {
    "scale": "...",
    "refine": "...",
    "pivot": "...",
    "kill": "..."
  }
}
```

### 7c: Validate
1. Verify experiment.yaml is valid YAML:
   ```bash
   python3 -c "import yaml; yaml.safe_load(open('idea/experiment.yaml'))"
   ```
2. Verify spec-manifest.json is valid JSON:
   ```bash
   python3 -c "import json; json.load(open('.claude/spec-manifest.json'))"
   ```
3. Spot-check:
   - Every hypothesis has a numeric threshold
   - Every behavior traces to a hypothesis ID that exists
   - Variant headlines have >30% word difference (compare each pair)

If validation fails, fix the file and re-validate (max 2 attempts).

### 7d: Summary
Print a summary:

```
Experiment Specification Complete
─────────────────────────────────
Level:        [N] — [level name]
Hypotheses:   [N] ([N resolved from research], [N pending])
Behaviors:    [N] (given/when/then)
Variants:     [N]
Stack:        [services: app(runtime, hosting, ...), shared: ...]
Status:       draft

Next: Run /bootstrap to scaffold the app, or edit idea/experiment.yaml to adjust.
```

## Do NOT
- Add behaviors not traceable to a hypothesis
- Add stack components not required by the selected level
- Generate fewer than 3 variants or fewer than 5 hypotheses
- Produce hypotheses without a testable numeric threshold
- Modify any file other than `idea/experiment.yaml` and `.claude/spec-manifest.json`
- Skip the user approval checkpoint in Step 6
- Proceed past any STOP point without explicit user confirmation
- Add `monetize` category hypotheses at Level 1
- Add `payment: stripe` to stack unless Level 3 with monetize hypotheses
- Add `auth: supabase` to stack at Level 1
- Add `database: supabase` to stack at Level 1
