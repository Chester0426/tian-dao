#!/usr/bin/env bash
# verify-pr-gate.sh — Claude Code PreToolUse hook for Bash commands.
# Blocks `gh pr create` unless verify-report.md passes integrity checks.

set -euo pipefail

# Read the hook payload from stdin
PAYLOAD=$(cat)

# Extract the command from tool_input.command
COMMAND=$(echo "$PAYLOAD" | python3 -c "import sys, json; d=json.load(sys.stdin); print(d.get('tool_input',{}).get('command',''))" 2>/dev/null || echo "")

# If the command doesn't contain `gh pr create`, allow it
if [[ "$COMMAND" != *"gh pr create"* ]]; then
  exit 0
fi

# --- PR creation detected — run verification checks ---

PROJECT_DIR="${CLAUDE_PROJECT_DIR:-.}"
REPORT="$PROJECT_DIR/.claude/verify-report.md"
TRACES_DIR="$PROJECT_DIR/.claude/agent-traces"
ERRORS=()
BRANCH=$(git branch --show-current 2>/dev/null || echo "")

# Branch-aware checks: skills that don't produce verify-report.md use their own artifacts
if [[ "$BRANCH" =~ ^chore/review- ]]; then
  # /review uses review-complete.json (produced in Step 4)
  if [[ ! -f "$PROJECT_DIR/.claude/review-complete.json" ]]; then
    ERRORS+=("review-complete.json not found — /review must write this after final validation")
  fi
elif [[ "$BRANCH" =~ ^fix/resolve- ]]; then
  # /resolve uses observe-result.json (produced by skill-epilogue.md)
  if [[ ! -f "$PROJECT_DIR/.claude/observe-result.json" ]]; then
    ERRORS+=("observe-result.json not found — /resolve must complete observation before PR")
  fi
else
  # Standard path: Checks 1-5 (verify-report.md required)

  # Check 1: verify-report.md exists with YAML frontmatter
  if [[ ! -f "$REPORT" ]]; then
    ERRORS+=("verify-report.md not found — run /verify first")
  elif ! head -1 "$REPORT" | grep -q '^---$'; then
    ERRORS+=("verify-report.md missing YAML frontmatter")
  fi

  if [[ -f "$REPORT" ]]; then
    # Extract frontmatter (between first and second ---)
    FRONTMATTER=$(sed -n '2,/^---$/p' "$REPORT" | sed '$d')

    # Check 2: process_violation is absent or false
    VIOLATION=$(echo "$FRONTMATTER" | grep 'process_violation: *true' || true)
    if [[ -n "$VIOLATION" ]]; then
      ERRORS+=("process_violation is true in verify-report.md — verification agents were skipped")
    fi

    # Check 3: agents_expected matches agents_completed
    EXPECTED=$(echo "$FRONTMATTER" | grep 'agents_expected:' | sed 's/agents_expected: *//' | tr -d '[]' | tr ',' '\n' | sed 's/^ *//;/^$/d' | sort)
    COMPLETED=$(echo "$FRONTMATTER" | grep 'agents_completed:' | sed 's/agents_completed: *//' | tr -d '[]' | tr ',' '\n' | sed 's/^ *//;/^$/d' | sort)
    if [[ "$EXPECTED" != "$COMPLETED" ]]; then
      ERRORS+=("agents_expected does not match agents_completed in verify-report.md")
    fi

    # Check 4: agent-traces directory has matching file count
    if [[ -d "$TRACES_DIR" ]]; then
      TRACE_COUNT=$(find "$TRACES_DIR" -name '*.json' -type f | wc -l | tr -d ' ')
      COMPLETED_COUNT=$(echo "$FRONTMATTER" | grep 'agents_completed:' | sed 's/agents_completed: *//' | tr -d '[]' | tr ',' '\n' | sed '/^$/d' | wc -l | tr -d ' ')
      if [[ "$TRACE_COUNT" -ne "$COMPLETED_COUNT" ]]; then
        ERRORS+=("Agent trace count ($TRACE_COUNT) does not match agents_completed count ($COMPLETED_COUNT)")
      fi
    else
      ERRORS+=("Agent traces directory not found at $TRACES_DIR")
    fi

    # Check 5: hard_gate_failure blocks PR (except standalone mode)
    HARD_GATE=$(echo "$FRONTMATTER" | grep 'hard_gate_failure: *true' || true)
    MODE=""
    if [[ -f "$PROJECT_DIR/.claude/verify-context.json" ]]; then
      MODE=$(python3 -c "import json; d=json.load(open('$PROJECT_DIR/.claude/verify-context.json')); print(d.get('mode',''))" 2>/dev/null || echo "")
    fi
    if [[ -n "$HARD_GATE" && "$MODE" != "standalone" ]]; then
      ERRORS+=("hard_gate_failure is true — verification hard gate(s) failed; PR blocked in non-standalone mode")
    fi
  fi
fi  # end branch-aware checks

# Check 6: Gate verdict files (G4, G5, G6) exist with PASS for current branch
# Only required for /change skill branches — other skills use their own verification.
if [[ "$BRANCH" =~ ^(change|feat|fix)/ ]] && [[ ! "$BRANCH" =~ ^feat/bootstrap ]] && [[ ! "$BRANCH" =~ ^fix/resolve- ]]; then
VERDICTS_DIR="$PROJECT_DIR/.claude/gate-verdicts"
VERDICT_CHECK=$(python3 -c "
import json, os, sys
verdicts_dir = '$VERDICTS_DIR'
branch = '$BRANCH'
errors = []
for gate in ['g4', 'g5', 'g6']:
    path = os.path.join(verdicts_dir, gate + '.json')
    if not os.path.exists(path):
        errors.append(gate.upper() + ' verdict missing')
        continue
    try:
        d = json.load(open(path))
    except Exception:
        errors.append(gate.upper() + ' verdict file is not valid JSON')
        continue
    if d.get('verdict') != 'PASS':
        errors.append(gate.upper() + ' verdict is ' + str(d.get('verdict','?')) + ', not PASS')
    v_branch = d.get('branch', '')
    if branch and v_branch and v_branch != branch:
        errors.append(gate.upper() + ' verdict is for branch ' + v_branch + ', not ' + branch)
if errors:
    print('FAIL:' + '; '.join(errors))
else:
    print('OK')
" 2>/dev/null || echo "OK")
if [[ "$VERDICT_CHECK" == FAIL:* ]]; then
  DETAIL="${VERDICT_CHECK#FAIL:}"
  ERRORS+=("Check 6 (gate verdicts): $DETAIL")
fi
fi  # end branch-prefix guard for Check 6

# If any check failed, deny the PR creation
if [[ ${#ERRORS[@]} -gt 0 ]]; then
  ERROR_MSG=$(printf '%s; ' "${ERRORS[@]}")
  cat <<EOF
{"permissionDecision": "deny", "message": "PR gate blocked: ${ERROR_MSG}Run /verify to complete verification before creating a PR."}
EOF
  exit 0
fi

# All checks passed — allow
exit 0
