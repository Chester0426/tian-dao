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
- Check if `idea/experiment.yaml` exists and has non-TODO `problem` and `solution` fields.
  If so, extract the idea text from those fields and confirm with the user:
  > Found existing problem/solution in experiment.yaml. Using this as the idea input:
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
- id: h_<category>_<n>           # e.g., h_demand_1
  category: demand               # demand | reach | feasibility | monetize | retain
  statement: "..."               # Testable claim with specific numbers
  test_method: "..."             # How to test — either "research" or an experiment action
  success_metric: "..."          # What to measure
  threshold: "..."               # Pass/fail number (e.g., ">5% CTR", ">=50 signups")
  priority_score: 8              # 1-10, higher = test first
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
  - Level 2: demand, reach, feasibility, retain required
  - Level 3: all five categories required
- `monetize` hypotheses only appear at Level 3
- Sort by `priority_score` descending

## Step 4: Derive Behaviors

Convert each **pending** (experiment-type) hypothesis into testable behaviors using given/when/then format.

For each hypothesis, derive 1-3 behaviors that, if observed, would validate or invalidate it.

### Behavior fields
```yaml
- id: b_<n>                      # Sequential: b_1, b_2, ...
  hypothesis_id: h_demand_1      # Which hypothesis this validates
  given: "A visitor lands on the landing page"
  when: "They read the headline and see the CTA"
  then: "They click the CTA button"
  level: 1                       # Matches the hypothesis level
```

### Rules
- Every pending hypothesis must have at least one behavior
- Behaviors must be observable and measurable (map to analytics events or database state)
- Use concrete user actions, not abstract concepts ("clicks the CTA" not "shows interest")
- Behaviors replace the traditional `features` list — each behavior IS a feature requirement

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
- First variant gets `default: true`

## Step 6: Assemble experiment.yaml

Build the complete experiment.yaml with these sections:

### 6a: Identity
```yaml
name: <slugified-name>
title: "<Human Title — Tagline>"
owner: <from existing experiment.yaml or ask user>
template_repo: magpiexyz-lab/mvp-template
type: web-app
level: <selected level>
status: draft
```

### 6b: Intent
```yaml
problem: |
  <Refined from idea + research findings>

solution: |
  <Refined from idea + research findings>

target_user: "<Specific ICP from research>"
thesis: "<One-sentence testable claim: If [action], then [outcome], as measured by [metric]>"

distribution: |
  <Channels identified from reach hypotheses + research>
```

### 6c: Hypotheses
```yaml
hypotheses:
  <all hypotheses from Step 3>
```

### 6d: Behaviors
```yaml
behaviors:
  <all behaviors from Step 4>
```

### 6e: Journey
Derive pages, golden_path, and features from behaviors:

```yaml
pages:
  - name: landing
    purpose: "Validate demand — present offer, capture interest"
  # Add pages required by Level 2+ behaviors (e.g., dashboard, settings)

golden_path:
  - page: landing
    action: "<from demand behavior>"
    event: visit_landing
  # Continue through behavior chain to value moment
  - page: <value page>
    action: "<value-delivering action>"
    event: activate
    value_moment: true
target_clicks: <N>

features:
  # Derive from behaviors — each behavior's "then" becomes a feature
  - "<feature derived from behavior b_1>"
  - "<feature derived from behavior b_2>"
```

### 6f: Variants
```yaml
variants:
  <all variants from Step 5>
```

### 6g: Funnel
```yaml
primary_metric: "<from demand hypothesis threshold>"
target_value: "<from demand hypothesis threshold>"
measurement_window: "<reasonable window for the level>"

funnel:
  thresholds:
    visit_to_cta: "<from demand hypothesis>"
    cta_to_signup: "<from reach/retain hypothesis, if applicable>"
    signup_to_activate: "<from feasibility hypothesis, if applicable>"
    activate_to_pay: "<from monetize hypothesis, if applicable>"
  decision_framework: |
    CONTINUE if: [conditions based on hypothesis thresholds]
    PIVOT if: [conditions]
    KILL if: [conditions]
```

### 6h: Stack
Stack is deterministic from level:

**Level 1:**
```yaml
stack:
  framework: nextjs
  hosting: vercel
  analytics: posthog
  ui: shadcn
  testing: playwright
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

### 6i: Deploy (preserve from existing or use defaults)
```yaml
deploy:
  vercel_team: "Magpiexyz Ltd"
  supabase_org: "Magpiexyz Labs"
  supabase_region: us-east-1
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
    { "id": "...", "category": "...", "statement": "...", "test_method": "...", "success_metric": "...", "threshold": "...", "priority_score": 8, "experiment_level": 1, "depends_on": [], "status": "..." }
  ],
  "behaviors": [
    { "id": "...", "hypothesis_id": "...", "given": "...", "when": "...", "then": "...", "level": 1 }
  ],
  "variants": [
    { "slug": "...", "headline": "...", "headline_word_diff_vs_others": ">30%" }
  ],
  "decision_framework": {
    "continue_if": "...",
    "pivot_if": "...",
    "kill_if": "..."
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
Stack:        [framework, hosting, ...]
Status:       draft

Next: Run /bootstrap to scaffold the app, or edit idea/experiment.yaml to adjust.
```

## Do NOT
- Use `features` instead of `behaviors` with given/when/then — behaviors ARE the feature specification
- Add behaviors not traceable to a hypothesis
- Add stack components not required by the selected level
- Generate fewer than 3 variants or fewer than 5 hypotheses
- Produce hypotheses without a testable numeric threshold
- Modify any file other than `idea/experiment.yaml` and `.claude/spec-manifest.json`
- Skip the user approval checkpoint in Step 6
- Proceed past any STOP point without explicit user confirmation
- Add `monetize` category hypotheses at Level 1 or Level 2
- Add `payment: stripe` to stack unless Level 3 with monetize hypotheses
- Add `auth: supabase` to stack at Level 1
- Add `database: supabase` to stack at Level 1
