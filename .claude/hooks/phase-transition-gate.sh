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

check_postcondition_artifacts() {
  local PREV_STATE="$1"
  case "$PREV_STATE" in
    0)
      [[ -f "$PROJECT_DIR/.claude/verify-context.json" ]] || ERRORS+=("verify-context.json missing — STATE 0 incomplete")
      [[ -f "$PROJECT_DIR/.claude/fix-log.md" ]] || ERRORS+=("fix-log.md missing — STATE 0 incomplete")
      [[ -d "$TRACES_DIR" ]] || ERRORS+=("agent-traces/ directory missing — STATE 0 incomplete")
      ;;
    3)
      local S3_SCOPE S3_ARCH
      S3_SCOPE=$(read_scope)
      S3_ARCH=$(read_archetype)
      if [[ ("$S3_SCOPE" == "full" || "$S3_SCOPE" == "visual") && "$S3_ARCH" == "web-app" ]]; then
        [[ -f "$PROJECT_DIR/.claude/design-ux-merge.json" ]] || ERRORS+=("design-ux-merge.json missing — STATE 3 incomplete")
      fi
      ;;
    4)
      local S4_SCOPE
      S4_SCOPE=$(read_scope)
      if [[ "$S4_SCOPE" == "full" || "$S4_SCOPE" == "security" ]]; then
        [[ -f "$PROJECT_DIR/.claude/security-merge.json" ]] || ERRORS+=("security-merge.json missing — STATE 4 incomplete")
      fi
      ;;
  esac
}

check_tier1_retry_complete() {
  local AGENT_PATTERN="$1"
  local TDIR="$2"
  for TRACE in "$TDIR"/${AGENT_PATTERN}.json; do
    [ -f "$TRACE" ] || continue
    local STATE
    STATE=$(python3 -c "
import json
d = json.load(open('$TRACE'))
has_verdict = 'verdict' in d
retry = d.get('retry_attempted', False)
status = d.get('status', '')
if has_verdict: print('COMPLETE')
elif status in ('started','exhausted') and not has_verdict and not retry: print('NEEDS_RETRY')
else: print('OK')
" 2>/dev/null || echo "OK")
    if [ "$STATE" = "NEEDS_RETRY" ]; then
      ERRORS+=("$(basename "$TRACE") exhausted without retry — must retry before proceeding")
    fi
  done
}

# V5 fix: check efficiency directives marker in prompt (verify flow only)
check_efficiency_directives() {
  if [ -f "$PROJECT_DIR/.claude/verify-context.json" ]; then
    local PROMPT
    PROMPT=$(python3 -c "
import json,sys
d=json.loads(sys.stdin.read())
print(d.get('tool_input',{}).get('prompt',''))
" <<< "$PAYLOAD" 2>/dev/null || echo "")
    if ! echo "$PROMPT" | grep -q "DIRECTIVES:batch_search,pr_changed_first,context_digest,pre_existing"; then
      ERRORS+=("Agent prompt missing efficiency directives — append .claude/agent-prompt-footer.md content")
    fi
  fi
}

case "$SUBAGENT_TYPE" in
  design-critic|ux-journeyer)
    # Postcondition check: STATE 0 artifacts must exist
    check_postcondition_artifacts 0
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
    # When spawning ux-journeyer (not design-critic), check design-critic retry complete
    if [[ "$SUBAGENT_TYPE" == "ux-journeyer" ]]; then
      check_tier1_retry_complete "design-critic-*" "$TRACES_DIR"
      check_tier1_retry_complete "design-critic" "$TRACES_DIR"
      # V1 fix: require design-consistency-checker when scope warrants it
      SCOPE_V1=$(read_scope)
      ARCH_V1=$(read_archetype)
      if [[ "$SCOPE_V1" =~ ^(full|visual)$ ]] && [[ "$ARCH_V1" == "web-app" ]]; then
        if [ ! -f "$TRACES_DIR/design-consistency-checker.json" ]; then
          ERRORS+=("design-consistency-checker.json trace missing — spawn consistency checker before ux-journeyer")
        else
          check_trace_verdict "$TRACES_DIR/design-consistency-checker.json" "consistency checker may still be running or exhausted turns"
        fi
      fi
    fi
    check_efficiency_directives
    ;;

  security-fixer)
    # Postcondition check: STATE 3 artifacts must exist
    check_postcondition_artifacts 3
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
    # Check ux-journeyer retry complete before security-fixer
    check_tier1_retry_complete "ux-journeyer" "$TRACES_DIR"
    if [[ "$SCOPE" == "security" ]]; then
      if [[ ! -f "$TRACES_DIR/behavior-verifier.json" ]]; then
        ERRORS+=("behavior-verifier.json trace missing — Phase 1 agent incomplete (scope=$SCOPE)")
      fi
      check_trace_verdict "$TRACES_DIR/behavior-verifier.json" "agent may still be running or exhausted turns"
      check_trace_run_id "$TRACES_DIR/behavior-verifier.json"
    fi
    check_efficiency_directives
    ;;

  observer)
    # Postcondition check: STATE 4 artifacts must exist
    check_postcondition_artifacts 4
    # Observer gate: e2e-result.json must exist (STATE 5 completed)
    if [[ ! -f "$PROJECT_DIR/.claude/e2e-result.json" ]]; then
      ERRORS+=("e2e-result.json not found — E2E tests (STATE 5) must complete before observer")
    fi
    # V3 fix: require observer-diffs.txt when fix-log has entries
    FIX_COUNT=$(grep -c '^\*\*Fix' "$PROJECT_DIR/.claude/fix-log.md" 2>/dev/null || echo "0")
    if [ "$FIX_COUNT" -gt 0 ] && [ ! -s "$PROJECT_DIR/.claude/observer-diffs.txt" ]; then
      ERRORS+=("observer-diffs.txt missing or empty — run diff collection script before spawning observer")
    fi
    check_efficiency_directives
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
