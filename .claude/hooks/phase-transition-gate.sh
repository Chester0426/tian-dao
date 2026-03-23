#!/usr/bin/env bash
# phase-transition-gate.sh — Claude Code PreToolUse hook for Agent tool.
# Blocks agents until their prerequisite state artifacts exist.
# Gates: Phase 2 (design-critic, ux-journeyer), security-fixer, observer.

set -euo pipefail

# Read the hook payload from stdin
PAYLOAD=$(cat)

# Extract subagent_type from tool_input (fail open on parse errors, log in verify context)
SUBAGENT_TYPE=$(echo "$PAYLOAD" | python3 -c "import sys, json; d=json.load(sys.stdin); print(d.get('tool_input',{}).get('subagent_type',''))" 2>/dev/null || {
  if [ -f "${CLAUDE_PROJECT_DIR:-.}/.claude/verify-context.json" ]; then
    echo "WARNING: phase-transition-gate: JSON parse error extracting subagent_type" >&2
  fi
  echo ""
})

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

# Check that all prerequisite states are in completed_states (Item 3: state tracking)
check_completed_states() {
  local REQUIRED_STATE="$1"
  if [[ -f "$PROJECT_DIR/.claude/verify-context.json" ]]; then
    local MISSING
    MISSING=$(python3 -c "
import json
d = json.load(open('$PROJECT_DIR/.claude/verify-context.json'))
cs = d.get('completed_states', [])
if not cs:
    print('NONE')  # Fail-open if field absent (backward compat)
else:
    missing = [s for s in range(0, $REQUIRED_STATE) if s not in cs]
    print(','.join(map(str, missing)) if missing else 'NONE')
" 2>/dev/null || echo "NONE")
    if [[ "$MISSING" != "NONE" ]]; then
      ERRORS+=("States [$MISSING] not in completed_states — prerequisite states were skipped")
    fi
  fi
}

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

# V6 fix: check build-result.json exists and shows passing build (STATE 1 postcondition)
check_build_result() {
  local BR_FILE="$PROJECT_DIR/.claude/build-result.json"
  if [[ ! -f "$BR_FILE" ]]; then
    ERRORS+=("build-result.json missing — STATE 1 (Build & Lint Loop) did not record its result")
    return
  fi
  local EXIT_CODE
  EXIT_CODE=$(python3 -c "import json; print(json.load(open('$BR_FILE')).get('exit_code', -1))" 2>/dev/null || echo "-1")
  if [[ "$EXIT_CODE" != "0" ]]; then
    ERRORS+=("build-result.json exit_code=$EXIT_CODE — build did not pass (STATE 1 incomplete)")
  fi
}

# V6 fix: validate FILE_BOUNDARY marker excludes shared paths for per-page design-critic
check_file_boundary() {
  local AGENT_NAME="$1"
  local PROMPT
  PROMPT=$(python3 -c "
import json,sys
d=json.loads(sys.stdin.read())
print(d.get('tool_input',{}).get('prompt',''))
" <<< "$PAYLOAD" 2>/dev/null || echo "")

  local BOUNDARY_RESULT
  BOUNDARY_RESULT=$(python3 -c "
import re, sys
prompt = sys.stdin.read()
m = re.search(r'FILE_BOUNDARY_START\n(.*?)FILE_BOUNDARY_END', prompt, re.DOTALL)
if not m:
    print('NO_MARKER')
else:
    files = m.group(1).strip()
    shared = [f for f in files.split('\n') if f.strip().startswith('src/components/') or f.strip().startswith('src/lib/')]
    if shared:
        print('SHARED:' + ';'.join(shared[:3]))
    else:
        print('OK')
" <<< "$PROMPT" 2>/dev/null || echo "OK")

  if [[ "$BOUNDARY_RESULT" == "NO_MARKER" ]]; then
    ERRORS+=("$AGENT_NAME prompt missing FILE_BOUNDARY marker — per-page agents must declare their file boundary")
  elif [[ "$BOUNDARY_RESULT" == SHARED:* ]]; then
    local SHARED_FILES="${BOUNDARY_RESULT#SHARED:}"
    ERRORS+=("$AGENT_NAME FILE_BOUNDARY contains shared paths ($SHARED_FILES) — per-page agents must NOT include src/components/ or src/lib/")
  fi
}

case "$SUBAGENT_TYPE" in
  design-critic|ux-journeyer)
    # State tracking: require states 0-1 completed
    check_completed_states 2
    # Postcondition check: STATE 0 artifacts must exist
    check_postcondition_artifacts 0
    # V6 fix: validate build passed (STATE 1 postcondition)
    check_build_result
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
    # V6 fix: per-page design-critic file boundary enforcement
    if [[ "$SUBAGENT_TYPE" == "design-critic" ]]; then
      IS_PER_PAGE=$(python3 -c "
import json, sys, re
d = json.loads(sys.stdin.read())
prompt = d.get('tool_input',{}).get('prompt','')
if re.search(r'design-critic-\w+\.json', prompt):
    print('yes')
else:
    print('no')
" <<< "$PAYLOAD" 2>/dev/null || echo "no")
      if [[ "$IS_PER_PAGE" == "yes" ]]; then
        check_file_boundary "design-critic (per-page)"
      fi
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
    # State tracking: require states 0-3 completed
    check_completed_states 4
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
    # Hard gate: design-ux-merge.json verdict must not be "fail"
    if [[ "$ARCH" == "web-app" && ( "$SCOPE" == "full" || "$SCOPE" == "visual" ) ]]; then
      if [[ -f "$PROJECT_DIR/.claude/design-ux-merge.json" ]]; then
        MERGE_VERDICT=$(python3 -c "import json; print(json.load(open('$PROJECT_DIR/.claude/design-ux-merge.json')).get('verdict',''))" 2>/dev/null || echo "")
        if [[ "$MERGE_VERDICT" == "fail" ]]; then
          ERRORS+=("design-ux-merge.json verdict=fail — hard gate failure, skip to STATE 7")
        fi
      fi
    fi
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
    # Epilogue path: relaxed requirements for skill-epilogue.md observers
    if [[ -f "$PROJECT_DIR/.claude/epilogue-context.json" ]] && \
       [[ ! -f "$PROJECT_DIR/.claude/verify-context.json" ]]; then
      # Only check observer-diffs.txt when fix-log has entries
      FIX_COUNT=$(grep -c '^\*\*Fix' "$PROJECT_DIR/.claude/fix-log.md" 2>/dev/null || echo "0")
      if [ "$FIX_COUNT" -gt 0 ] && [ ! -s "$PROJECT_DIR/.claude/observer-diffs.txt" ]; then
        ERRORS+=("observer-diffs.txt missing or empty — collect diffs before spawning observer (epilogue path)")
      fi
      # No efficiency directives or state tracking required for epilogue path
    else
      # Verify path: full prerequisites required
      # State tracking: require states 0-4 completed
      check_completed_states 5
      # Postcondition check: STATE 4 artifacts must exist
      check_postcondition_artifacts 4
      # Observer gate: e2e-result.json must exist (STATE 5 completed)
      if [[ ! -f "$PROJECT_DIR/.claude/e2e-result.json" ]]; then
        ERRORS+=("e2e-result.json not found — E2E tests (STATE 5) must complete before observer")
      fi
      # Cross-validate: if stack.testing exists, e2e-result.json can't claim "no testing stack"
      if [[ -f "$PROJECT_DIR/.claude/e2e-result.json" ]]; then
        HAS_TESTING=$(grep -c "testing:" "$PROJECT_DIR/experiment/experiment.yaml" 2>/dev/null || echo "0")
        if [[ "$HAS_TESTING" -gt 0 ]]; then
          E2E_REASON=$(python3 -c "import json; print(json.load(open('$PROJECT_DIR/.claude/e2e-result.json')).get('reason',''))" 2>/dev/null || echo "")
          if [[ "$E2E_REASON" == "no testing stack" ]]; then
            ERRORS+=("e2e-result.json says 'no testing stack' but experiment.yaml has stack.testing — STATE 5 was not executed correctly")
          fi
        fi
      fi
      # V3 fix: require observer-diffs.txt when fix-log has entries
      FIX_COUNT=$(grep -c '^\*\*Fix' "$PROJECT_DIR/.claude/fix-log.md" 2>/dev/null || echo "0")
      if [ "$FIX_COUNT" -gt 0 ] && [ ! -s "$PROJECT_DIR/.claude/observer-diffs.txt" ]; then
        ERRORS+=("observer-diffs.txt missing or empty — run diff collection script before spawning observer")
      fi
      check_efficiency_directives
    fi
    ;;

  # V6 fix: Phase 1 agents — validate STATE 0 + build result before spawning
  build-info-collector|security-defender|security-attacker|behavior-verifier|performance-reporter|accessibility-scanner|spec-reviewer)
    check_postcondition_artifacts 0
    check_build_result
    check_efficiency_directives
    ;;

  design-consistency-checker)
    check_postcondition_artifacts 0
    check_build_result
    # Require design-critic-shared.json when per-page traces report shared-component issues
    HAS_SHARED=$(python3 -c "
import json, glob
for f in glob.glob('$TRACES_DIR/design-critic-*.json'):
    if 'design-critic-shared' in f: continue
    try:
        d = json.load(open(f))
        if d.get('unresolved_shared', 0) > 0:
            print('yes'); break
    except: pass
else: print('no')
" 2>/dev/null || echo "no")
    if [[ "$HAS_SHARED" == "yes" ]]; then
      if [[ ! -f "$TRACES_DIR/design-critic-shared.json" ]]; then
        ERRORS+=("design-critic-shared.json missing — per-page agents reported shared-component issues")
      else
        check_trace_verdict "$TRACES_DIR/design-critic-shared.json" "shared-component agent may still be running"
      fi
    fi
    check_efficiency_directives
    ;;

  pattern-classifier)
    # State tracking: require states 0-6 completed
    check_completed_states 7
    # STATE 8 agent: only needs verify-context.json
    if [[ -f "$PROJECT_DIR/.claude/verify-context.json" ]]; then
      if [[ ! -f "$PROJECT_DIR/.claude/fix-log.md" ]]; then
        ERRORS+=("fix-log.md missing — cannot run pattern-classifier outside verify context")
      fi
    fi
    ;;

  implementer|visual-implementer)
    # Require G3 Spec Gate before implementation agents
    VERDICTS_DIR="$PROJECT_DIR/.claude/gate-verdicts"
    if [[ ! -f "$VERDICTS_DIR/g3.json" ]]; then
      ERRORS+=("G3 Spec Gate verdict missing — run G3 before spawning implementer agents")
    else
      G3_V=$(python3 -c "import json; print(json.load(open('$VERDICTS_DIR/g3.json')).get('verdict',''))" 2>/dev/null || echo "")
      if [[ "$G3_V" != "PASS" ]]; then
        ERRORS+=("G3 verdict is $G3_V, not PASS — fix spec issues before implementation")
      fi
      G3_BRANCH=$(python3 -c "import json; print(json.load(open('$VERDICTS_DIR/g3.json')).get('branch',''))" 2>/dev/null || echo "")
      CURRENT_BRANCH=$(git branch --show-current 2>/dev/null || echo "")
      if [[ -n "$G3_BRANCH" && "$G3_BRANCH" != "$CURRENT_BRANCH" ]]; then
        ERRORS+=("G3 verdict is for branch '$G3_BRANCH', not '$CURRENT_BRANCH'")
      fi
    fi
    ;;

  *)
    # Unknown agents in non-verify context (bootstrap, etc): fail-open
    if [[ -f "$PROJECT_DIR/.claude/verify-context.json" ]]; then
      echo "WARN: unrecognized subagent_type '$SUBAGENT_TYPE' during active verify run" >&2
    fi
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
