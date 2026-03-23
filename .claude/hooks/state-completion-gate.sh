#!/usr/bin/env bash
# state-completion-gate.sh — Claude Code PreToolUse hook for Bash commands.
# Validates state postconditions before allowing completed_states updates.
# Works with advance-state.sh: when the LLM marks a state complete, this hook
# checks that the state's postcondition artifacts actually exist on disk.
# Supports all skills via per-skill registry in state-registry.json.
set -euo pipefail

PAYLOAD=$(cat)
COMMAND=$(echo "$PAYLOAD" | python3 -c "import sys, json; print(json.load(sys.stdin).get('tool_input',{}).get('command',''))" 2>/dev/null || echo "")

# Only fire on advance-state.sh calls
if [[ "$COMMAND" != *"advance-state.sh"* ]]; then
  exit 0
fi

# Extract skill name and state identifier from: advance-state.sh <skill> <state>
SKILL=$(echo "$COMMAND" | grep -oE 'advance-state\.sh[[:space:]]+([a-z-]+)' | awk '{print $NF}' || echo "")
STATE_ID=$(echo "$COMMAND" | grep -oE 'advance-state\.sh[[:space:]]+[a-z-]+[[:space:]]+([0-9a-z]+)' | awk '{print $NF}' || echo "")

if [[ -z "$SKILL" || -z "$STATE_ID" ]]; then
  exit 0
fi

PROJECT_DIR="${CLAUDE_PROJECT_DIR:-.}"
REGISTRY="$PROJECT_DIR/.claude/patterns/state-registry.json"

if [[ ! -f "$REGISTRY" ]]; then
  exit 0  # Fail-open if registry missing
fi

# Look up VERIFY command for this skill + state
VERIFY_CMD=$(python3 -c "
import json
reg = json.load(open('$REGISTRY'))
skill_reg = reg.get('$SKILL', {})
print(skill_reg.get('$STATE_ID', ''))
" 2>/dev/null || echo "")

if [[ -z "$VERIFY_CMD" || "$VERIFY_CMD" == "true" ]]; then
  exit 0  # No verify or always-pass (conditional postconditions handled by downstream hooks)
fi

# Run the verify command from project root
cd "$PROJECT_DIR"
if ! eval "$VERIFY_CMD" >/dev/null 2>&1; then
  cat <<EOF
{"permissionDecision": "deny", "message": "State completion gate: $SKILL STATE $STATE_ID postconditions not met. VERIFY failed: $VERIFY_CMD — complete this state's actions before marking it done."}
EOF
  exit 0
fi

# Postconditions verified — allow
exit 0
