#!/usr/bin/env bash
# bootstrap-commit-gate.sh — Claude Code PreToolUse hook for Bash commands.
# Blocks final bootstrap commit unless BG1 and BG2 gates are checked off
# in the Process Checklist.

set -euo pipefail

# Read the hook payload from stdin
PAYLOAD=$(cat)

# Extract the command from tool_input.command
COMMAND=$(echo "$PAYLOAD" | python3 -c "import sys, json; d=json.load(sys.stdin); print(d.get('tool_input',{}).get('command',''))" 2>/dev/null || echo "")

# If the command doesn't contain `git commit`, allow it
if [[ "$COMMAND" != *"git commit"* ]]; then
  exit 0
fi

# If the current branch is not feat/bootstrap or feat/bootstrap-N, allow it
BRANCH=$(git branch --show-current 2>/dev/null || echo "")
if [[ "$BRANCH" != "feat/bootstrap" ]] && [[ ! "$BRANCH" =~ ^feat/bootstrap-[0-9]+$ ]]; then
  exit 0
fi

# If the commit message doesn't contain "Bootstrap" (WIP commits allowed), allow it
if [[ "$COMMAND" != *"Bootstrap"* ]]; then
  exit 0
fi

# --- Final bootstrap commit detected — run gate checks ---

PROJECT_DIR="${CLAUDE_PROJECT_DIR:-.}"
PLAN="$PROJECT_DIR/.claude/current-plan.md"
ERRORS=()

# Check 1: current-plan.md exists
if [[ ! -f "$PLAN" ]]; then
  ERRORS+=("current-plan.md not found — Process Checklist missing")
fi

if [[ -f "$PLAN" ]]; then
  # Primary: verdict files
  VERDICTS_DIR="$PROJECT_DIR/.claude/gate-verdicts"
  for GATE in bg1 bg2 bg2.5 bg4; do
    if [[ ! -f "$VERDICTS_DIR/$GATE.json" ]]; then
      ERRORS+=("$GATE verdict file missing")
    else
      V=$(python3 -c "import json; print(json.load(open('$VERDICTS_DIR/$GATE.json')).get('verdict',''))" 2>/dev/null || echo "")
      if [[ "$V" != "PASS" ]]; then
        ERRORS+=("$GATE verdict is $V, not PASS")
      fi
    fi
  done

  # Freshness: BG1 timestamp > branch creation
  BRANCH_CREATED=$(git log --format=%aI "$(git merge-base main HEAD)" -1 2>/dev/null || echo "")
  if [[ -n "$BRANCH_CREATED" && -f "$VERDICTS_DIR/bg1.json" ]]; then
    VERDICT_TS=$(python3 -c "import json; print(json.load(open('$VERDICTS_DIR/bg1.json')).get('timestamp',''))" 2>/dev/null || echo "")
    if [[ -n "$VERDICT_TS" ]]; then
      IS_FRESH=$(python3 -c "from datetime import datetime; bt=datetime.fromisoformat('$BRANCH_CREATED'.rstrip('Z')); vt=datetime.fromisoformat('$VERDICT_TS'.rstrip('Z')); print('yes' if vt>=bt else 'no')" 2>/dev/null || echo "yes")
      [[ "$IS_FRESH" == "no" ]] && ERRORS+=("BG1 verdict older than branch creation")
    fi
  fi

  # Secondary: checklist checks
  # Check 2: BG1 Validation Gate must be checked off
  if ! grep -q '\- \[x\].*BG1' "$PLAN"; then
    ERRORS+=("BG1 Validation Gate not checked off in Process Checklist")
  fi

  # Check 3: BG2 Orchestration Gate must be checked off
  if ! grep -q '\- \[x\].*BG2 Orchestration' "$PLAN"; then
    ERRORS+=("BG2 Orchestration Gate not checked off in Process Checklist")
  fi

  # Check 4: BG2.5 Externals Gate must be checked off
  if ! grep -q '\- \[x\].*BG2\.5' "$PLAN"; then
    ERRORS+=("BG2.5 Externals Gate not checked off in Process Checklist")
  fi
fi

# If any check failed, deny the commit
if [[ ${#ERRORS[@]} -gt 0 ]]; then
  ERROR_MSG=$(printf '%s; ' "${ERRORS[@]}")
  cat <<EOF
{"permissionDecision": "deny", "message": "Bootstrap commit blocked: ${ERROR_MSG}Complete all gate checks before committing."}
EOF
  exit 0
fi

# All checks passed — allow
exit 0
