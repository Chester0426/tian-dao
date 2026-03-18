#!/usr/bin/env bash
# phase-transition-gate.sh — Claude Code PreToolUse hook for Agent tool.
# Blocks agents until their prerequisite state artifacts exist.
# Gates: Phase 2 (design-critic, ux-journeyer), security-fixer, observer.

set -euo pipefail

# Read the hook payload from stdin
PAYLOAD=$(cat)

# Extract subagent_type from tool_input (fail open on parse errors)
SUBAGENT_TYPE=$(echo "$PAYLOAD" | python3 -c "import sys, json; d=json.load(sys.stdin); print(d.get('tool_input',{}).get('subagent_type',''))" 2>/dev/null || echo "")

PROJECT_DIR="${CLAUDE_PROJECT_DIR:-.}"
TRACES_DIR="$PROJECT_DIR/.claude/agent-traces"
ERRORS=()

# Helper: read scope from verify-context.json
read_scope() {
  if [[ -f "$PROJECT_DIR/.claude/verify-context.json" ]]; then
    python3 -c "
import json, sys
try:
    d = json.load(open('$PROJECT_DIR/.claude/verify-context.json'))
    print(d.get('scope', ''))
except:
    print('')
" 2>/dev/null || echo ""
  else
    echo ""
  fi
}

case "$SUBAGENT_TYPE" in
  design-critic|ux-journeyer)
    # Phase 2 gate: Phase 1 traces must exist
    if [[ ! -f "$TRACES_DIR/build-info-collector.json" ]]; then
      ERRORS+=("build-info-collector.json trace missing — Phase 1 has not completed")
    fi

    SCOPE=$(read_scope)
    if [[ "$SCOPE" == "full" || "$SCOPE" == "security" ]]; then
      for AGENT in security-defender security-attacker behavior-verifier; do
        if [[ ! -f "$TRACES_DIR/$AGENT.json" ]]; then
          ERRORS+=("$AGENT.json trace missing — Phase 1 agent incomplete (scope=$SCOPE)")
        fi
      done
    fi
    ;;

  security-fixer)
    # Security-fixer gate: Phase 2 traces must exist
    if [[ ! -f "$TRACES_DIR/build-info-collector.json" ]]; then
      ERRORS+=("build-info-collector.json trace missing — Phase 1 has not completed")
    fi

    SCOPE=$(read_scope)
    if [[ "$SCOPE" == "full" || "$SCOPE" == "visual" ]]; then
      for AGENT in design-critic ux-journeyer; do
        if [[ ! -f "$TRACES_DIR/$AGENT.json" ]]; then
          ERRORS+=("$AGENT.json trace missing — Phase 2 agent incomplete (scope=$SCOPE)")
        fi
      done
    fi
    if [[ "$SCOPE" == "security" ]]; then
      if [[ ! -f "$TRACES_DIR/behavior-verifier.json" ]]; then
        ERRORS+=("behavior-verifier.json trace missing — Phase 1 agent incomplete (scope=$SCOPE)")
      fi
    fi
    ;;

  observer)
    # Observer gate: e2e-result.json must exist (STATE 5 completed)
    if [[ ! -f "$PROJECT_DIR/.claude/e2e-result.json" ]]; then
      ERRORS+=("e2e-result.json not found — E2E tests (STATE 5) must complete before observer")
    fi
    ;;

  *)
    # All other agents: no gate
    exit 0
    ;;
esac

# If any check failed, deny spawning the agent
if [[ ${#ERRORS[@]} -gt 0 ]]; then
  ERROR_MSG=$(printf '%s; ' "${ERRORS[@]}")
  cat <<EOF
{"permissionDecision": "deny", "message": "State gate blocked: ${ERROR_MSG}Complete prerequisite states before spawning $SUBAGENT_TYPE."}
EOF
  exit 0
fi

# All checks passed — allow
exit 0
