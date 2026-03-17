#!/usr/bin/env bash
# phase-transition-gate.sh — Claude Code PreToolUse hook for Agent tool.
# Blocks Phase 2 agents (design-critic, ux-journeyer) until Phase 1 traces exist.

set -euo pipefail

# Read the hook payload from stdin
PAYLOAD=$(cat)

# Extract subagent_type from tool_input (fail open on parse errors)
SUBAGENT_TYPE=$(echo "$PAYLOAD" | python3 -c "import sys, json; d=json.load(sys.stdin); print(d.get('tool_input',{}).get('subagent_type',''))" 2>/dev/null || echo "")

# Only gate Phase 2 agents: design-critic and ux-journeyer
if [[ "$SUBAGENT_TYPE" != "design-critic" && "$SUBAGENT_TYPE" != "ux-journeyer" ]]; then
  exit 0
fi

# --- Phase 2 agent detected — check Phase 1 traces ---

PROJECT_DIR="${CLAUDE_PROJECT_DIR:-.}"
TRACES_DIR="$PROJECT_DIR/.claude/agent-traces"
ERRORS=()

# Minimum requirement: build-info-collector trace must exist (always runs in Phase 1)
if [[ ! -f "$TRACES_DIR/build-info-collector.json" ]]; then
  ERRORS+=("build-info-collector.json trace missing — Phase 1 has not completed")
fi

# If verify-context.json exists, check scope-required Phase 1 traces
if [[ -f "$PROJECT_DIR/.claude/verify-context.json" ]]; then
  SCOPE=$(python3 -c "
import json, sys
try:
    d = json.load(open('$PROJECT_DIR/.claude/verify-context.json'))
    print(d.get('scope', ''))
except:
    print('')
" 2>/dev/null || echo "")

  # For full/security scope, security agents and behavior-verifier must have traces
  if [[ "$SCOPE" == "full" || "$SCOPE" == "security" ]]; then
    for AGENT in security-defender security-attacker behavior-verifier; do
      if [[ ! -f "$TRACES_DIR/$AGENT.json" ]]; then
        ERRORS+=("$AGENT.json trace missing — Phase 1 agent incomplete (scope=$SCOPE)")
      fi
    done
  fi
fi

# If any check failed, deny spawning the Phase 2 agent
if [[ ${#ERRORS[@]} -gt 0 ]]; then
  ERROR_MSG=$(printf '%s; ' "${ERRORS[@]}")
  cat <<EOF
{"permissionDecision": "deny", "message": "Phase 2 blocked: ${ERROR_MSG}All Phase 1 agents must complete before spawning $SUBAGENT_TYPE."}
EOF
  exit 0
fi

# All checks passed — allow
exit 0
