#!/usr/bin/env bash
# state-completion-gate.sh — Claude Code PreToolUse hook for Bash commands.
# Validates verify state postconditions before allowing completed_states updates.
# Works with advance-state.sh: when the LLM marks a state complete, this hook
# checks that the state's postcondition artifacts actually exist on disk.
set -euo pipefail

PAYLOAD=$(cat)
COMMAND=$(echo "$PAYLOAD" | python3 -c "import sys, json; print(json.load(sys.stdin).get('tool_input',{}).get('command',''))" 2>/dev/null || echo "")

# Only fire on advance-state.sh calls
if [[ "$COMMAND" != *"advance-state.sh"* ]]; then
  exit 0
fi

# Extract state number (last numeric argument after advance-state.sh)
STATE_NUM=$(echo "$COMMAND" | grep -oE 'advance-state\.sh[[:space:]]+([0-9]+)' | grep -oE '[0-9]+$' || echo "")
if [[ -z "$STATE_NUM" ]]; then
  exit 0
fi

PROJECT_DIR="${CLAUDE_PROJECT_DIR:-.}"
REGISTRY="$PROJECT_DIR/.claude/patterns/verify/state-registry.json"

if [[ ! -f "$REGISTRY" ]]; then
  exit 0  # Fail-open if registry missing
fi

# Look up VERIFY command for this state
VERIFY_CMD=$(python3 -c "
import json
reg = json.load(open('$REGISTRY'))
print(reg.get(str($STATE_NUM), ''))
" 2>/dev/null || echo "")

if [[ -z "$VERIFY_CMD" || "$VERIFY_CMD" == "true" ]]; then
  exit 0  # No verify or always-pass (conditional postconditions handled by downstream hooks)
fi

# Run the verify command from project root
cd "$PROJECT_DIR"
if ! eval "$VERIFY_CMD" >/dev/null 2>&1; then
  cat <<EOF
{"permissionDecision": "deny", "message": "State completion gate: STATE $STATE_NUM postconditions not met. VERIFY failed: $VERIFY_CMD — complete this state's actions before marking it done."}
EOF
  exit 0
fi

# Postconditions verified — allow
exit 0
