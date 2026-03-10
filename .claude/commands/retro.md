---
description: "Use at the end of an experiment or when the measurement window ends. Files structured feedback as a GitHub Issue."
type: analysis-only
reads:
  - experiment/experiment.yaml
  - EVENTS.yaml
stack_categories: []
requires_approval: false
references: []
branch_prefix: chore
modifies_specs: false
---
Run a structured retrospective for the current experiment and file it as a GitHub Issue.

## Step 1: Gather Automated Data

Verify `experiment/experiment.yaml` exists. If not, stop and tell the user: "No experiment found — `experiment/experiment.yaml` is missing. Make sure you're in the right project directory."

Verify `EVENTS.yaml` exists. If not, stop and tell the user: "EVENTS.yaml not found. This file defines all analytics events and is required. Restore it from your template repo or re-create it following the format in the EVENTS.yaml section of the template."

If `package.json` does not exist, warn: "No app found — this retro will be based on your qualitative feedback only. If you want to include analytics data, run `/bootstrap` and `/deploy` first."

Collect these data points and present a summary before asking questions:

1. **Git activity**
   - Run `git log --oneline --no-decorate -50` — report commit count and date range
   - Run `gh pr list --state all --limit 50` — report PR counts (merged, open, closed)

2. **App scope**
   - Count primary units based on archetype (read `.claude/archetypes/<type>.md`, type from experiment.yaml, default `web-app`):
     - web-app: count page directories in `src/app/` (excluding `api/`)
     - service: count API route directories (e.g., `src/app/api/` or `src/routes/`)
     - cli: count command modules in `src/commands/`
   - Count production dependencies from `package.json` (if it exists)

3. **Spec files**
   - Read `experiment/experiment.yaml` — extract experiment name, description, target user, thesis, funnel thresholds
   - Read `EVENTS.yaml` — list events being tracked

Present the summary and then proceed to Step 2.

## Step 2: Ask Four Questions

Ask these questions **one at a time** by ending your response after each question. Wait for the user's reply before asking the next question.

**Resumption:** If interrupted mid-conversation, the user can re-run `/retro`. If the user provides answers to previous questions up front (e.g., pasting prior responses), skip those questions and continue from where they left off. If the user provides all four answers at once, skip the one-at-a-time flow entirely and proceed to Step 3.

### Q1: Outcome
"What was the outcome of this experiment?"
- Succeeded — hit or exceeded thesis target
- Partially succeeded — made progress but didn't hit target
- Failed — didn't move the metric
- Inconclusive — not enough data or time

Follow-up: "What was the actual result vs the target in your thesis: [thesis]?"

### Q2: What worked
"What worked well? (workflow, tools, stack, anything)"

### Q3: What was painful
"What was painful, confusing, or slow?"

### Q4: What was missing
"What capability did you wish you had but didn't?"

## Step 3: Generate Structured Retro

Compile all data into a structured document with these sections:

1. **Experiment Summary** — name, description, target user, thesis, outcome, metric results
2. **Timeline & Activity** — commits, PRs, pages built, scope delivered vs planned
3. **Stack Used** — from experiment.yaml `stack`
4. **Team Assessment** — answers to Q2-Q4
5. **Template Improvement Suggestions** — specific, actionable changes mapped to template components (e.g., "Add X to the bootstrap skill", "Change Y in CLAUDE.md Rule Z")

Show the full retro to the user before filing.

## Step 4: File as GitHub Issue

1. Determine the target repo: use the current repo via `gh repo view --json nameWithOwner --jq '.nameWithOwner'`. If `gh` is not available or the command fails, ask the user: "Where should I file this retro? Enter a repo in `owner/repo` format, or say 'skip' to print it to the terminal instead."
2. If the user says "skip", print the retro to the terminal and stop.

File the issue:
```
gh issue create \
  --title "Retro: <experiment-name> — <outcome>" \
  --label "retro" \
  --body "<structured retro content>"
```

### Error Handling
- If `gh issue create` fails with a label error (e.g., label "retro" doesn't exist): retry **without** the `--label "retro"` flag. The user may not have triage permissions to create labels.
- If `gh issue create` fails for any other reason: show the full error message and suggest:
  - Check GitHub authentication: `gh auth status`
  - Try filing manually by copying the retro content above
- If the issue is created successfully, show the issue URL.

## Step 5: Next steps

After filing the retro, guide the user:
- If the archetype is `web-app` or `service` and cloud infrastructure was deployed: "If you're done with this experiment, run `/teardown` to remove cloud resources (Vercel, Supabase, etc.)."
- If the archetype is `cli`: "CLI tools have no cloud infrastructure to tear down. If you want to unpublish the npm package, run `npm unpublish <name>` (within 72 hours of publish) or deprecate it with `npm deprecate <name> \"Experiment concluded\"`."
- For all archetypes: "Your source code, experiment.yaml, and experiment history are preserved on the main branch."

## Do NOT
- Modify any code files
- Create branches or PRs
- Change experiment.yaml, EVENTS.yaml, or any spec file
- Install or remove packages
