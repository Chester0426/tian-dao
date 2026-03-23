---
description: "Analyze template structural quality: duplication, complexity, abstractability. Analysis only — no code changes."
type: analysis-only
reads:
  - CLAUDE.md
  - scripts/check-inventory.md
stack_categories: []
requires_approval: false
references: []
branch_prefix: ""
modifies_specs: false
---
Audit the template's structural quality. $ARGUMENTS

## Step 0: Scope and baseline

### Scope selection

Parse `$ARGUMENTS` for an optional focus scope:

| Argument | Scope | Files scanned |
|----------|-------|---------------|
| (empty) | full | All .claude/ subdirectories |
| `hooks` | hooks only | `.claude/hooks/*.sh` |
| `commands` | skills only | `.claude/commands/*.md` |
| `patterns` | patterns only | `.claude/patterns/**/*.md`, `.claude/procedures/*.md` |
| `agents` | agents only | `.claude/agents/*.md` |
| `stacks` | stacks only | `.claude/stacks/**/*.md` |

If `$ARGUMENTS` contains `--save`, set `save_manifest = true`.

### Baseline metrics

Run these commands and hold the results in working memory:

```bash
# File inventory by type and total lines
echo "=== File inventory ===" && \
find .claude -name '*.md' -not -path '*plans*' | wc -l && \
find .claude -name '*.sh' | wc -l && \
find scripts -name '*.py' 2>/dev/null | wc -l && \
echo "=== Total lines ===" && \
find .claude scripts -name '*.md' -o -name '*.sh' -o -name '*.py' 2>/dev/null | xargs wc -l | tail -1

# Top 25 largest files (within selected scope, or all if full)
echo "=== Largest files ===" && \
find .claude scripts -name '*.md' -o -name '*.sh' -o -name '*.py' 2>/dev/null | \
  xargs wc -l | sort -rn | head -25

# Duplication signals: inline python3 one-liners in hooks (the #1 duplication source)
echo "=== Inline python3 patterns in hooks ===" && \
grep -ch 'python3 -c' .claude/hooks/*.sh 2>/dev/null | paste -d: - <(ls .claude/hooks/*.sh) | sort -rn

# Cross-file reference frequency
echo "=== Most-referenced patterns ===" && \
grep -roh '[a-z/-]*\.md' .claude/commands/ .claude/patterns/ 2>/dev/null | \
  grep -v '^$' | sort | uniq -c | sort -rn | head -15

# Hook function definitions (shared vs local)
echo "=== Hook functions ===" && \
grep -hn '^[a-z_]*()' .claude/hooks/*.sh 2>/dev/null
```

Validator health baseline:
```bash
python3 scripts/validate-frontmatter.py 2>&1 | tail -1
python3 scripts/validate-semantics.py 2>&1 | tail -1
bash scripts/consistency-check.sh 2>&1 | tail -1
```

### Prior audit (delta tracking)

If `.claude/audit-manifest.json` exists from a prior run:
```bash
python3 -c "
import json
d = json.load(open('.claude/audit-manifest.json'))
print(f\"Prior audit: {d.get('timestamp','')} — {d.get('total_findings',0)} findings\")
for f in d.get('findings', []):
    print(f\"  [{f.get('dimension','')}] {f.get('title','')}\")
" 2>/dev/null || echo "No prior audit found"
```

Store prior findings as `prior_findings` for delta comparison in Step 2.

## Step 1: Parallel analysis

Launch 3 Explore subagents in parallel. Construct each agent's prompt from:
- The **shared context instruction** below
- The agent's **dimension section**
- The **Finding Format** and **Rules**

> **Shared context instruction** — include verbatim in every subagent prompt:
>
> Before scanning, read these context files:
> `CLAUDE.md`, `.claude/settings.json`, `scripts/check-inventory.md`.
>
> Then read ALL files in these directories (adjust to scope if not full):
> - Glob `.claude/commands/*.md` — every skill file
> - Glob `.claude/stacks/**/*.md` — every stack file
> - Glob `.claude/patterns/**/*.md` — every pattern file (including verify sub-states)
> - Glob `.claude/procedures/*.md` — every procedure file
> - Glob `.claude/agents/*.md` — every agent definition
> - Glob `.claude/hooks/*.sh` — every hook script
> - Glob `scripts/*.py` — every validator script
>
> Do not report issues already covered by `scripts/check-inventory.md`
> (including its Pending and Rejected sections).
>
> **JIT awareness**: This template uses JIT State Dispatch — state files and
> agent prompts are intentionally self-contained. Some repetition is by design
> to avoid cross-file dependencies during context-limited execution. Do NOT
> flag self-containment repetition as duplication.

---

### Dimension A: Duplication

Focus: Find **textually identical or near-identical** code/prose blocks
duplicated across 3+ files that serve no architectural purpose and could be
extracted into a shared definition.

**Primary scan targets** (highest-yield duplication sources):
- Inline `python3 -c` one-liners in hook scripts (payload extraction, JSON reading, verdict checking)
- Boilerplate skeleton shared between structurally similar hooks (e.g., merge gates)
- Validator invocation lists repeated across skill files
- Artifact cleanup/deletion lists repeated within or across files
- Error handling patterns (`2>/dev/null || echo ""`, `ERRORS+=()`, deny JSON output)

**Classification** — for each candidate, determine:
- **Extractable**: No architectural reason for duplication. Could be a shared
  shell function, a referenced pattern section, or a named constant.
- **JIT-intentional**: Repeated for self-containment. Skip silently.

Only report extractable findings.

Files to read: all directories from shared context instruction, with special
attention to `.claude/hooks/*.sh` (the densest duplication source).

---

### Dimension B: Complexity

Focus: Find files whose **internal structure** has grown beyond maintainable
levels — not merely long files, but files with mixed responsibilities,
deep nesting, or interacting subsystems.

**Thresholds** (flag for analysis, not automatic finding):
- Shell scripts (.sh): >400 lines
- Markdown skill/pattern (.md): >600 lines
- Python scripts (.py): >1500 lines

**For each file exceeding a threshold, classify:**

- **Long but simple** — Linear structure: parallel case branches, sequential
  checklists, independent validation checks. Long because it covers many cases.
  **Do NOT report.** Instead, note in the "Scanned but clean" summary.

- **Long and complex** — One or more of:
  - Mixed responsibilities (validation + transformation + reporting in one file)
  - Deep nesting (4+ levels of if/elif/case)
  - Functions longer than 50 lines (.sh) or sections longer than 100 lines (.md)
  - Multiple helper functions that interact with shared mutable state
  - A file that is both a gate (deny/allow) and a validator (check N conditions)
  **Report with a split strategy.**

**Also flag regardless of file size:**
- Functions/sections with cyclomatic complexity concerns (many conditional paths)
- Files where a single change requires understanding 3+ helper functions

Files to read: all directories from shared context instruction.

---

### Dimension C: Abstractability

Focus: Find **semantically equivalent patterns** implemented inline in 3+ files
instead of referencing a shared definition. This goes beyond textual duplication
(Dimension A) — look for implementations that achieve the same goal with
different words, structure, or ordering.

**Deduplication rule**: If Dimension A already reported a finding about the
same pattern (textually identical blocks), do NOT re-report it here. Dimension C
is exclusively for **semantic** equivalence — same intent, different text.

**Primary scan targets:**
- Protocol descriptions (e.g., fix-log writing format described differently in 13 files)
- Conditional archetype handling (`if web-app... elif service... elif cli...`)
  reimplemented per-skill instead of referencing a shared decision tree
- Gate-checking patterns (read JSON → extract field → compare → error array)
  reimplemented per-hook instead of calling a shared function
- Artifact existence checks done inline instead of referencing a manifest

**For each finding, record:**
- The pattern being implemented inline (describe the intent, not the text)
- Number of files and their paths
- Where a shared definition should live
- **JIT tradeoff note**: Would extracting this break self-containment? If yes,
  note the tradeoff explicitly — the finding is still valuable but the fix
  approach should preserve JIT readability (e.g., "reference + inline fallback"
  rather than "extract entirely")

Files to read: all directories from shared context instruction.

---

### Finding Format

Every finding from every dimension must use this format:

```
### Finding <D><N>: <title>
- **Dimension**: A (Duplication) | B (Complexity) | C (Abstractability)
- **Impact**: HIGH (10+ files or >100 dup lines) | MEDIUM (4-9 files) | LOW (2-3 files)
- **Effort**: LOW (<30 min) | MEDIUM (1-2 hours) | HIGH (>2 hours)
- **Files**: <file1>, <file2>, ... (or "N files — see list below")
- **Issue**: <specific description — quote representative text>
- **Suggestion**: <concrete, implementable improvement>
```

### Rules

Include in each subagent prompt:

1. **Maximum 7 findings per dimension.** Prioritize by impact.
2. **No overlap with automated checks.** Read `scripts/check-inventory.md` — if
   a check exists or was rejected, do not report it.
3. **No overlap between dimensions.** Dimension A = textual duplication.
   Dimension C = semantic equivalence (different text, same intent). If the same
   pattern qualifies for both, report it under A only.
4. **Zero findings is valid.** Say "No findings — scanned N files, all clean."
5. **Confidence filter.** Only report HIGH confidence (can quote specific lines)
   and MEDIUM confidence (likely issue, evidence points to it). Drop LOW.
6. **Self-review.** Before presenting: verify each finding is not already in
   check-inventory.md, verify no overlap with other dimensions, verify
   JIT-intentional repetition is excluded.

---

After all 3 agents return, collect findings and deduplicate:
- Finding signature = `<dimension>:<primary_file>:<title>`
- If two findings from different dimensions describe the same underlying issue,
  keep the one with higher impact; drop the other with a note.

## Step 2: Prioritize and output

### Priority matrix

| | Low Effort | Medium Effort | High Effort |
|---|---|---|---|
| **High Impact** | P1 | P2 | P3 |
| **Medium Impact** | P2 | P3 | P4 |
| **Low Impact** | P3 | P4 | — |

### Delta computation

If `prior_findings` is non-empty (from Step 0):
- **New**: findings not in prior audit (by title similarity)
- **Resolved**: prior findings not in current audit
- **Persistent**: findings in both

### Report

Print the report:

```
Template Structural Audit
─────────────────────────
Scope: <full | hooks | commands | ...>
Files scanned: <N> .md, <N> .sh, <N> .py    Total lines: <N>
Validator baseline: <PASSED | N errors>
Prior audit: <date> (<N> findings) | none

## Duplication (<N> findings)
| # | Pattern | Occurrences | Files | Effort | Priority |
|---|---------|-------------|-------|--------|----------|
| 1 | ...     | ...         | ...   | ...    | P1       |

## Complexity Hotspots (<N> findings)
| # | File | Lines | Issue | Suggestion | Priority |
|---|------|-------|-------|------------|----------|
| 1 | ...  | ...   | ...   | ...        | P2       |

## Abstraction Opportunities (<N> findings)
| # | Pattern | Inline Count | Shared Definition | Priority |
|---|---------|--------------|-------------------|----------|
| 1 | ...     | ...          | ...               | P1       |

## Delta (vs prior audit)
- New: <N> findings
- Resolved: <N> findings
- Persistent: <N> findings
(Or: "First audit — no prior baseline")

## Top 5 Recommendations (by priority)
1. [P1] <one-line summary + suggested next step>
2. [P1] <one-line summary + suggested next step>
3. [P2] <one-line summary + suggested next step>
4. [P2] <one-line summary + suggested next step>
5. [P3] <one-line summary + suggested next step>
```

### Manifest (if --save)

If `save_manifest` is true, write `.claude/audit-manifest.json`:
```json
{
  "timestamp": "<ISO 8601>",
  "scope": "<full|hooks|commands|...>",
  "files_scanned": {"md": <N>, "sh": <N>, "py": <N>},
  "total_lines": <N>,
  "total_findings": <N>,
  "findings": [
    {
      "id": "<D><N>",
      "dimension": "duplication|complexity|abstractability",
      "title": "<title>",
      "impact": "HIGH|MEDIUM|LOW",
      "effort": "LOW|MEDIUM|HIGH",
      "priority": "P1|P2|P3|P4",
      "files": ["<path>", ...],
      "issue": "<description>",
      "suggestion": "<fix>"
    }
  ],
  "delta": {
    "new": <N>,
    "resolved": <N>,
    "persistent": <N>
  }
}
```

## STOP

After printing the report, **STOP**. Do not implement any changes.
The user decides next steps — they may cherry-pick recommendations
and run `/resolve` or manual refactoring for specific items.

## Do NOT
- Modify any source files — this skill is analysis only
- Create branches or PRs
- Propose fixes for correctness issues — that is `/review`'s job
- Flag intentional JIT repetition as duplication
- Report "long but simple" files as complexity hotspots
- Report the same finding under both Dimension A and Dimension C
