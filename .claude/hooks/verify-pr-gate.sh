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
fi

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
