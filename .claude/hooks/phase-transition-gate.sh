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

# Helper: read field from verify-context.json
read_verify_field() {
  local FIELD="$1"
  if [[ -f "$PROJECT_DIR/.claude/verify-context.json" ]]; then
    python3 -c "
import json, sys
try:
    d = json.load(open('$PROJECT_DIR/.claude/verify-context.json'))
    print(d.get('$FIELD', ''))
except:
    print('')
" 2>/dev/null || echo ""
  else
    echo ""
  fi
}

read_scope() { read_verify_field "scope"; }
read_archetype() { read_verify_field "archetype"; }

check_trace_verdict() {
  local TRACE_FILE="$1"
  local CONTEXT="$2"
  if [[ -f "$TRACE_FILE" ]]; then
    local HAS_VERDICT
    HAS_VERDICT=$(python3 -c "import json; d=json.load(open('$TRACE_FILE')); print('yes' if 'verdict' in d else 'no')" 2>/dev/null || echo "no")
    if [[ "$HAS_VERDICT" != "yes" ]]; then
      local BASENAME
      BASENAME=$(basename "$TRACE_FILE")
      ERRORS+=("$BASENAME trace incomplete (no verdict) — $CONTEXT")
    fi
  fi
}

check_trace_run_id() {
  local TRACE_FILE="$1"
  if [[ ! -f "$TRACE_FILE" ]] || [[ ! -f "$PROJECT_DIR/.claude/verify-context.json" ]]; then
    return 0
  fi
  local RESULT
  RESULT=$(python3 -c "
import json
ctx = json.load(open('$PROJECT_DIR/.claude/verify-context.json'))
trace = json.load(open('$TRACE_FILE'))
ctx_run_id = ctx.get('run_id', '')
trace_run_id = trace.get('run_id', '')
if not trace_run_id:
    print('WARN')  # No run_id in trace — fail-open during transition
elif not ctx_run_id:
    print('OK')  # No run_id in context — skip check
elif trace_run_id != ctx_run_id:
    print('STALE')  # run_id mismatch — stale trace from prior run
else:
    print('OK')
" 2>/dev/null || echo "OK")
  if [[ "$RESULT" == "STALE" ]]; then
    local BASENAME
    BASENAME=$(basename "$TRACE_FILE")
    ERRORS+=("$BASENAME has stale run_id — trace is from a prior /verify run, not the current one")
  fi
  # WARN is logged but does not block (fail-open for transition period)
}

case "$SUBAGENT_TYPE" in
  design-critic|ux-journeyer)
    # Phase 2 gate: Phase 1 traces must exist
    if [[ ! -f "$TRACES_DIR/build-info-collector.json" ]]; then
      ERRORS+=("build-info-collector.json trace missing — Phase 1 has not completed")
    fi
    check_trace_verdict "$TRACES_DIR/build-info-collector.json" "agent may still be running or exhausted turns"
    check_trace_run_id "$TRACES_DIR/build-info-collector.json"

    SCOPE=$(read_scope)
    if [[ "$SCOPE" == "full" || "$SCOPE" == "security" ]]; then
      for AGENT in security-defender security-attacker behavior-verifier; do
        if [[ ! -f "$TRACES_DIR/$AGENT.json" ]]; then
          ERRORS+=("$AGENT.json trace missing — Phase 1 agent incomplete (scope=$SCOPE)")
        else
          check_trace_verdict "$TRACES_DIR/$AGENT.json" "agent may still be running or exhausted turns"
          check_trace_run_id "$TRACES_DIR/$AGENT.json"
        fi
      done
    fi
    ;;

  security-fixer)
    # Security-fixer gate: Phase 2 traces must exist
    if [[ ! -f "$TRACES_DIR/build-info-collector.json" ]]; then
      ERRORS+=("build-info-collector.json trace missing — Phase 1 has not completed")
    fi
    check_trace_verdict "$TRACES_DIR/build-info-collector.json" "agent may still be running or exhausted turns"
    check_trace_run_id "$TRACES_DIR/build-info-collector.json"

    SCOPE=$(read_scope)
    ARCH=$(read_archetype)
    # design-critic/ux-journeyer only run for web-app archetype (scope table footnote)
    if [[ "$ARCH" == "web-app" && ( "$SCOPE" == "full" || "$SCOPE" == "visual" ) ]]; then
      for AGENT in design-critic ux-journeyer; do
        if [[ ! -f "$TRACES_DIR/$AGENT.json" ]]; then
          ERRORS+=("$AGENT.json trace missing — Phase 2 agent incomplete (scope=$SCOPE, archetype=$ARCH)")
        else
          check_trace_verdict "$TRACES_DIR/$AGENT.json" "agent may still be running or exhausted turns"
          check_trace_run_id "$TRACES_DIR/$AGENT.json"
        fi
      done
    fi
    if [[ "$SCOPE" == "security" ]]; then
      if [[ ! -f "$TRACES_DIR/behavior-verifier.json" ]]; then
        ERRORS+=("behavior-verifier.json trace missing — Phase 1 agent incomplete (scope=$SCOPE)")
      fi
      check_trace_verdict "$TRACES_DIR/behavior-verifier.json" "agent may still be running or exhausted turns"
      check_trace_run_id "$TRACES_DIR/behavior-verifier.json"
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
