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
  # Check 2: BG1 Validation Gate must be checked off
  if ! grep -q '\- \[x\].*BG1' "$PLAN"; then
    ERRORS+=("BG1 Validation Gate not checked off in Process Checklist")
  fi

  # Check 3: BG2 Orchestration Gate must be checked off
  if ! grep -q '\- \[x\].*BG2 Orchestration' "$PLAN"; then
    ERRORS+=("BG2 Orchestration Gate not checked off in Process Checklist")
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
