#!/usr/bin/env bash
# change-commit-gate.sh — Claude Code PreToolUse hook for Bash commands.
# Blocks final change/fix/upgrade commit unless G4 gate passed and
# verify-report.md exists with a passing build.

set -euo pipefail

# Read the hook payload from stdin
PAYLOAD=$(cat)

# Extract the command from tool_input.command
COMMAND=$(echo "$PAYLOAD" | python3 -c "import sys, json; d=json.load(sys.stdin); print(d.get('tool_input',{}).get('command',''))" 2>/dev/null || echo "")

# If the command doesn't contain `git commit`, allow it
if [[ "$COMMAND" != *"git commit"* ]]; then
  exit 0
fi

# If the current branch is not change/, feat/, fix/, or chore/harden, allow it
BRANCH=$(git branch --show-current 2>/dev/null || echo "")
if [[ ! "$BRANCH" =~ ^(change|feat|fix)/ ]] && [[ ! "$BRANCH" =~ ^chore/(harden|distribute|review) ]]; then
  exit 0
fi

# Exclude bootstrap branches (handled by bootstrap-commit-gate.sh)
if [[ "$BRANCH" =~ ^feat/bootstrap ]]; then
  exit 0
fi

# Handle chore/harden branches — only enforce at final step, require verify-report.md
if [[ "$BRANCH" =~ ^chore/harden ]]; then
  PROJECT_DIR="${CLAUDE_PROJECT_DIR:-.}"
  PLAN="$PROJECT_DIR/.claude/current-plan.md"
  if [[ -f "$PLAN" ]]; then
    HARDEN_CP=$(python3 -c "
import re
with open('$PLAN') as f:
    content = f.read()
m = re.search(r'checkpoint:\s*(\S+)', content)
print(m.group(1) if m else '')
" 2>/dev/null || echo "")
    if [[ -n "$HARDEN_CP" && "$HARDEN_CP" != "step3-pr" ]]; then
      exit 0  # Not at final step, allow
    fi
  else
    exit 0  # No plan file = not at final step
  fi
  # Final harden commit — require verify-report.md
  REPORT="$PROJECT_DIR/.claude/verify-report.md"
  if [[ ! -f "$REPORT" ]]; then
    cat <<EOF
{"permissionDecision": "deny", "message": "Harden commit blocked: verify-report.md missing — run /verify before final commit."}
EOF
    exit 0
  fi
  exit 0  # verify-report exists, allow
fi

# Handle chore/distribute branches — require verify-report.md before final commit
if [[ "$BRANCH" =~ ^chore/distribute ]]; then
  PROJECT_DIR="${CLAUDE_PROJECT_DIR:-.}"
  REPORT="$PROJECT_DIR/.claude/verify-report.md"
  if [[ -f "$REPORT" ]]; then
    exit 0  # verify-report exists, allow
  fi
  # Only block at final state (state 7+ completed = ready for verify+commit)
  CTX="$PROJECT_DIR/.claude/distribute-context.json"
  if [[ -f "$CTX" ]]; then
    AT_FINAL=$(python3 -c "
import json
d = json.load(open('$CTX'))
cs = [str(s) for s in d.get('completed_states', [])]
print('yes' if '7' in cs else 'no')
" 2>/dev/null || echo "no")
    if [[ "$AT_FINAL" == "yes" ]]; then
      cat <<EOF
{"permissionDecision": "deny", "message": "Distribute commit blocked: verify-report.md missing — run verify before final commit."}
EOF
      exit 0
    fi
  fi
  exit 0
fi

# Handle chore/review branches — require review-complete.json before final commit
if [[ "$BRANCH" =~ ^chore/review ]]; then
  PROJECT_DIR="${CLAUDE_PROJECT_DIR:-.}"
  CTX="$PROJECT_DIR/.claude/review-context.json"
  if [[ -f "$CTX" ]]; then
    AT_FINAL=$(python3 -c "
import json
d = json.load(open('$CTX'))
cs = [str(s) for s in d.get('completed_states', [])]
print('yes' if '4' in cs else 'no')
" 2>/dev/null || echo "no")
    if [[ "$AT_FINAL" == "yes" && ! -f "$PROJECT_DIR/.claude/review-complete.json" ]]; then
      cat <<EOF
{"permissionDecision": "deny", "message": "Review commit blocked: review-complete.json missing — complete review validation first."}
EOF
      exit 0
    fi
  fi
  exit 0
fi

# Only allow worktree merge commits through unconditionally
if [[ "$COMMAND" == *"Merge implementer"* ]]; then
  exit 0
fi

# Check current-plan.md checkpoint — only enforce on final commit (phase2-step8)
PROJECT_DIR="${CLAUDE_PROJECT_DIR:-.}"

# /resolve epilogue bypass: fix/ branches with observe-result.json skip G4/verify checks.
# /resolve does not produce G4 verdicts or verify-report.md — its observation is handled
# by skill-epilogue.md which writes observe-result.json.
if [[ "$BRANCH" =~ ^fix/ ]] && [[ -f "$PROJECT_DIR/.claude/observe-result.json" ]]; then
  exit 0
fi

PLAN="$PROJECT_DIR/.claude/current-plan.md"

if [[ -f "$PLAN" ]]; then
  CHECKPOINT=$(python3 -c "
import re
with open('$PLAN') as f:
    content = f.read()
m = re.search(r'checkpoint:\s*(\S+)', content)
print(m.group(1) if m else '')
" 2>/dev/null || echo "")
  # Only enforce on final commit (checkpoint at phase2-step8 or later)
  if [[ -n "$CHECKPOINT" && "$CHECKPOINT" != "phase2-step8" ]]; then
    exit 0
  fi
fi

# recover: commits allowed only when a plan exists (proves recovery from valid state)
if [[ "$COMMAND" == *"recover:"* ]]; then
  if [[ ! -f "$PLAN" ]]; then
    cat <<EOF
{"permissionDecision": "deny", "message": "recover: commit blocked — no current-plan.md found. Cannot recover without an existing plan."}
EOF
    exit 0
  fi
  exit 0
fi

# --- Final change commit detected — run gate checks ---

ERRORS=()

# Check 1: G4 verdict file exists with PASS
VERDICTS_DIR="$PROJECT_DIR/.claude/gate-verdicts"
if [[ ! -f "$VERDICTS_DIR/g4.json" ]]; then
  ERRORS+=("G4 Implementation Gate verdict missing — run G4 before committing")
else
  V=$(python3 -c "import json; print(json.load(open('$VERDICTS_DIR/g4.json')).get('verdict',''))" 2>/dev/null || echo "")
  if [[ "$V" != "PASS" ]]; then
    ERRORS+=("G4 verdict is $V, not PASS")
  fi
  # Freshness: G4 branch must match current branch
  G4_BRANCH=$(python3 -c "import json; print(json.load(open('$VERDICTS_DIR/g4.json')).get('branch',''))" 2>/dev/null || echo "")
  if [[ -n "$G4_BRANCH" && "$G4_BRANCH" != "$BRANCH" ]]; then
    ERRORS+=("G4 verdict is for branch '$G4_BRANCH', not current branch '$BRANCH'")
  fi
fi

# Check 2: verify-report.md exists with passing build
REPORT="$PROJECT_DIR/.claude/verify-report.md"
if [[ ! -f "$REPORT" ]]; then
  ERRORS+=("verify-report.md missing — run /verify before committing")
else
  BUILD_RESULT=$(python3 -c "
import re
with open('$REPORT') as f:
    content = f.read()
if 'Result: pass' in content or 'result: pass' in content:
    print('pass')
else:
    print('unknown')
" 2>/dev/null || echo "unknown")
  if [[ "$BUILD_RESULT" != "pass" ]]; then
    ERRORS+=("verify-report.md does not show build pass")
  fi
fi

# If any check failed, deny the commit
if [[ ${#ERRORS[@]} -gt 0 ]]; then
  ERROR_MSG=$(printf '%s; ' "${ERRORS[@]}")
  cat <<EOF
{"permissionDecision": "deny", "message": "Change commit blocked: ${ERROR_MSG}Complete G4 gate and verification before final commit."}
EOF
  exit 0
fi

# All checks passed — allow
exit 0
