#!/usr/bin/env bash
# verify-report-gate.sh — Claude Code PreToolUse hook for Write/Edit.
# Blocks writing verify-report.md unless durable artifacts exist.

set -euo pipefail

source "$(dirname "$0")/lib.sh"
parse_payload

FILE_PATH=$(read_payload_field "tool_input.file_path")

# Only fire when file_path contains "verify-report"
if [[ "$FILE_PATH" != *"verify-report"* ]]; then
  exit 0
fi

# --- verify-report.md write detected — run artifact checks ---

PROJECT_DIR="${CLAUDE_PROJECT_DIR:-.}"
ERRORS=()
WARNINGS=()

extract_write_content

# ═══════════════════════════════════════════════════════════════════
# === Section A: Artifact Presence (Checks 1-7, 15) ===
# ═══════════════════════════════════════════════════════════════════

# Check 1: verify-context.json exists (STATE 0 ran)
if [[ ! -f "$PROJECT_DIR/.claude/verify-context.json" ]]; then
  ERRORS+=("verify-context.json not found — STATE 0 (Read Context) did not run")
else
  # Check 1b: verify-context.json has required fields
  CTX_VALID=$(python3 -c "
import json
try:
    d = json.load(open('$PROJECT_DIR/.claude/verify-context.json'))
    required = ['scope', 'archetype', 'run_id', 'timestamp']
    missing = [k for k in required if k not in d or not d[k]]
    print('yes' if not missing else 'no:' + ','.join(missing))
except:
    print('no:parse-error')
" 2>/dev/null || echo "no:python-error")
  if [[ "$CTX_VALID" != "yes" ]]; then
    ERRORS+=("verify-context.json missing required fields: ${CTX_VALID#no:}")
  fi
fi

# Check 2: fix-log.md exists (STATE 0 ran)
if [[ ! -f "$PROJECT_DIR/.claude/fix-log.md" ]]; then
  ERRORS+=("fix-log.md not found — STATE 0 (Read Context) did not run")
fi

# Check 3: agent-traces/ has ≥1 trace file
TRACE_DIR="$PROJECT_DIR/.claude/agent-traces"
if [[ ! -d "$TRACE_DIR" ]]; then
  ERRORS+=("agent-traces/ directory not found — no agents were spawned")
else
  TRACE_COUNT=$(find "$TRACE_DIR" -name '*.json' -type f 2>/dev/null | wc -l | tr -d ' ')
  if [[ "$TRACE_COUNT" -lt 1 ]]; then
    ERRORS+=("agent-traces/ has 0 trace files — no agents completed")
  fi
fi

# Check 4: Each trace file has checks_performed JSON array
if [[ -d "$TRACE_DIR" ]]; then
  for TRACE in "$TRACE_DIR"/*.json; do
    [[ -f "$TRACE" ]] || continue
    HAS_CHECKS=$(python3 -c "
import json, sys
try:
    d = json.load(open('$TRACE'))
    cp = d.get('checks_performed', None)
    is_recovery = d.get('recovery', False)
    if is_recovery and isinstance(cp, list):
        print('yes')
    elif isinstance(cp, list) and len(cp) > 0:
        print('yes')
    else:
        print('no')
except:
    print('no')
" 2>/dev/null || echo "no")
    if [[ "$HAS_CHECKS" != "yes" ]]; then
      BASENAME=$(basename "$TRACE")
      ERRORS+=("$BASENAME missing checks_performed array — agent used old trace format")
    fi
  done
fi

# Detect hard_gate_failure in report content — when true, STATEs 4-6 artifacts
# are correctly absent (hard gate skips them). Checks 5, 7, 15 become conditional.
HAS_HARD_GATE=0
if [[ -n "$CONTENT" ]]; then
  HAS_HARD_GATE=$(echo "$CONTENT" | grep -c 'hard_gate_failure: *true' || echo "0")
fi

# Check 5: If scope is full/security, security-merge.json must exist (skip on hard gate)
if [[ "$HAS_HARD_GATE" -eq 0 ]] && [[ -f "$PROJECT_DIR/.claude/verify-context.json" ]]; then
  SCOPE=$(read_json_field "$PROJECT_DIR/.claude/verify-context.json" "scope")
  if [[ "$SCOPE" == "full" || "$SCOPE" == "security" ]]; then
    if [[ ! -f "$PROJECT_DIR/.claude/security-merge.json" ]]; then
      ERRORS+=("security-merge.json not found — security merge step was skipped (scope=$SCOPE)")
    fi
  fi
fi

# Check 6: If fix-log.md has content beyond header, auto_observe must not be skipped-no-fixes
# (Skip on hard gate — observer was correctly not spawned when STATEs 4-6 skipped)
if [[ "$HAS_HARD_GATE" -eq 0 ]] && [[ -f "$PROJECT_DIR/.claude/fix-log.md" ]]; then
  # Count non-empty lines after the header (first line)
  FIX_ENTRIES=$(tail -n +2 "$PROJECT_DIR/.claude/fix-log.md" | grep -c '[^[:space:]]' 2>/dev/null || echo "0")
  if [[ "$FIX_ENTRIES" -gt 0 ]]; then
    # Extract content being written — check for auto_observe: skipped-no-fixes
    if echo "$CONTENT" | grep -q 'auto_observe:.*skipped-no-fixes'; then
      ERRORS+=("fix-log.md has $FIX_ENTRIES fix entries but auto_observe is skipped-no-fixes — observer must run when fixes exist")
    fi
  fi
fi

# Check 7: e2e-result.json must exist and passed field validated (skip on hard gate)
if [[ "$HAS_HARD_GATE" -eq 0 ]]; then
  if [[ ! -f "$PROJECT_DIR/.claude/e2e-result.json" ]]; then
    ERRORS+=("e2e-result.json not found — E2E tests (STATE 5) did not run")
  else
    E2E_PASSED=$(read_json_field "$PROJECT_DIR/.claude/e2e-result.json" "passed")
    if [[ "$E2E_PASSED" != "True" ]]; then
      WARNINGS+=("e2e-result.json: passed=false — E2E tests failed")
    fi
  fi
fi

# Check 15: All STATE postcondition artifacts exist (backstop for agent-state-gate.sh)
# When hard_gate_failure: true, STATEs 4-6 are correctly skipped — their artifacts are optional.
if [[ -f "$PROJECT_DIR/.claude/verify-context.json" ]]; then
  POSTCOND_CHECK=$(HAS_HARD_GATE="$HAS_HARD_GATE" python3 -c "
import json, os
project = os.environ.get('CLAUDE_PROJECT_DIR', '.')
ctx = json.load(open(os.path.join(project, '.claude/verify-context.json')))
scope, arch = ctx.get('scope', ''), ctx.get('archetype', '')
hard_gate = int(os.environ.get('HAS_HARD_GATE', '0')) > 0
errors = []
for f in ['verify-context.json', 'fix-log.md']:
    if not os.path.exists(os.path.join(project, '.claude', f)):
        errors.append(f'{f} missing (STATE 0)')
if scope in ('full', 'visual') and arch == 'web-app':
    if not os.path.exists(os.path.join(project, '.claude/design-ux-merge.json')):
        errors.append('design-ux-merge.json missing (STATE 3)')
if not hard_gate:
    if scope in ('full', 'security'):
        if not os.path.exists(os.path.join(project, '.claude/security-merge.json')):
            errors.append('security-merge.json missing (STATE 4)')
    if not os.path.exists(os.path.join(project, '.claude/e2e-result.json')):
        errors.append('e2e-result.json missing (STATE 5)')
if not os.path.exists(os.path.join(project, '.claude/build-result.json')):
    errors.append('build-result.json missing (STATE 1)')
if errors: print('FAIL:' + '; '.join(errors))
else: print('OK')
" 2>/dev/null || echo "OK")
  if [[ "$POSTCOND_CHECK" == FAIL:* ]]; then
    POSTCOND_DETAIL="${POSTCOND_CHECK#FAIL:}"
    ERRORS+=("Check 15: Missing postcondition artifacts: $POSTCOND_DETAIL")
  fi
fi

# ═══════════════════════════════════════════════════════════════════
# === Section B: Agent Trace Verdicts (Checks 8-11, 13-14) ===
# ═══════════════════════════════════════════════════════════════════

# Check 8: If scope is full/visual AND archetype is web-app, design-ux-merge.json must exist
if [[ -f "$PROJECT_DIR/.claude/verify-context.json" ]]; then
  SCOPE_DUX=$(read_json_field "$PROJECT_DIR/.claude/verify-context.json" "scope")
  ARCHETYPE_DUX=$(read_json_field "$PROJECT_DIR/.claude/verify-context.json" "archetype")
  if [[ ("$SCOPE_DUX" == "full" || "$SCOPE_DUX" == "visual") && "$ARCHETYPE_DUX" == "web-app" ]]; then
    if [[ ! -f "$PROJECT_DIR/.claude/design-ux-merge.json" ]]; then
      ERRORS+=("design-ux-merge.json not found — Design-UX merge step was skipped (scope=$SCOPE_DUX, archetype=$ARCHETYPE_DUX)")
    fi
  fi
fi

# Check 9: design-critic hard gate
DC_TRACE="$TRACE_DIR/design-critic.json"
if [[ -f "$DC_TRACE" ]]; then
  DC_VERDICT=$(read_json_field "$DC_TRACE" "verdict")
  DC_RECOVERY=$(read_json_field "$DC_TRACE" "recovery")
  if [[ "$DC_VERDICT" == "unresolved" || "$DC_RECOVERY" == "True" ]]; then
    if ! echo "$CONTENT" | grep -q 'hard_gate_failure: *true'; then
      ERRORS+=("design-critic verdict=$DC_VERDICT recovery=$DC_RECOVERY requires hard_gate_failure: true in report frontmatter")
    fi
  fi
fi

# Check 10: ux-journeyer hard gate
UX_TRACE="$TRACE_DIR/ux-journeyer.json"
if [[ -f "$UX_TRACE" ]]; then
  UX_VERDICT=$(read_json_field "$UX_TRACE" "verdict")
  UX_UDE=$(read_json_field "$UX_TRACE" "unresolved_dead_ends")
  UX_RECOVERY=$(read_json_field "$UX_TRACE" "recovery")
  if [[ "$UX_VERDICT" == "blocked" || "$UX_UDE" -gt 0 || "$UX_RECOVERY" == "True" ]]; then
    if ! echo "$CONTENT" | grep -q 'hard_gate_failure: *true'; then
      ERRORS+=("ux-journeyer verdict=$UX_VERDICT unresolved_dead_ends=$UX_UDE recovery=$UX_RECOVERY requires hard_gate_failure: true in report frontmatter")
    fi
  fi
fi

# Check 11: security-fixer hard gate
SF_TRACE="$TRACE_DIR/security-fixer.json"
if [[ -f "$SF_TRACE" ]]; then
  SF_VERDICT=$(read_json_field "$SF_TRACE" "verdict")
  SF_UC=$(read_json_field "$SF_TRACE" "unresolved_critical")
  SF_RECOVERY=$(read_json_field "$SF_TRACE" "recovery")
  if [[ ("$SF_VERDICT" == "partial" && "$SF_UC" -gt 0) || "$SF_RECOVERY" == "True" ]]; then
    if ! echo "$CONTENT" | grep -q 'hard_gate_failure: *true'; then
      ERRORS+=("security-fixer verdict=$SF_VERDICT unresolved_critical=$SF_UC recovery=$SF_RECOVERY requires hard_gate_failure: true in report frontmatter")
    fi
  fi
fi

# Check 13: design-consistency-checker trace required for full/visual + web-app
SCOPE_13=$(read_json_field "$PROJECT_DIR/.claude/verify-context.json" "scope")
ARCH_13=$(read_json_field "$PROJECT_DIR/.claude/verify-context.json" "archetype")
if [[ "$SCOPE_13" =~ ^(full|visual)$ ]] && [[ "$ARCH_13" == "web-app" ]]; then
  if [ ! -f "$PROJECT_DIR/.claude/agent-traces/design-consistency-checker.json" ]; then
    ERRORS+=("Check 13: design-consistency-checker.json trace missing for scope=$SCOPE_13 archetype=$ARCH_13")
  fi
fi

# Check 13b: design-critic-shared trace required when per-page agents report shared-component issues
if [[ "$SCOPE_13" =~ ^(full|visual)$ ]] && [[ "$ARCH_13" == "web-app" ]]; then
  HAS_SHARED_ISSUES=$(python3 -c "
import json, glob, os
traces_dir = os.environ.get('CLAUDE_PROJECT_DIR', '.') + '/.claude/agent-traces'
for f in glob.glob(os.path.join(traces_dir, 'design-critic-*.json')):
    if 'design-critic-shared' in f: continue
    try:
        d = json.load(open(f))
        if d.get('unresolved_shared', 0) > 0:
            print('yes'); break
    except: pass
else: print('no')
" 2>/dev/null || echo "no")
  if [[ "$HAS_SHARED_ISSUES" == "yes" ]]; then
    if [ ! -f "$PROJECT_DIR/.claude/agent-traces/design-critic-shared.json" ]; then
      ERRORS+=("Check 13b: design-critic-shared.json missing but per-page agents reported shared-component issues")
    fi
  fi
fi

# Check 14: Fix count cross-reference — trace fixes[] vs fix-log.md entries (WARN, not BLOCK)
if [[ -d "$TRACE_DIR" && -f "$PROJECT_DIR/.claude/fix-log.md" ]]; then
  FIX_CROSS_CHECK=$(python3 -c "
import json, glob, os
traces_dir = os.environ.get('CLAUDE_PROJECT_DIR', '.') + '/.claude/agent-traces'
fix_log = open(os.environ.get('CLAUDE_PROJECT_DIR', '.') + '/.claude/fix-log.md').read()
warnings = []
agent_prefix_map = {
    'design-critic': 'Fix (design-critic):',
    'ux-journeyer': 'Fix (ux-journeyer):',
    'security-fixer': 'Fix (security-fixer):'
}
for trace_file in glob.glob(os.path.join(traces_dir, '*.json')):
    name = os.path.basename(trace_file).replace('.json', '')
    if name.startswith('design-critic-'):
        continue
    try:
        d = json.load(open(trace_file))
        trace_fixes = d.get('fixes', None)
        if trace_fixes is None:
            continue
        prefix = agent_prefix_map.get(name, f'Fix ({name}):')
        if len(trace_fixes) != fix_log.count(prefix):
            warnings.append(f'{name}: trace={len(trace_fixes)}, log={fix_log.count(prefix)}')
    except: pass
if warnings: print('WARN:' + '; '.join(warnings))
else: print('OK')
" 2>/dev/null || echo "OK")
  if [[ "$FIX_CROSS_CHECK" == WARN:* ]]; then
    echo "WARN: Fix count mismatch: ${FIX_CROSS_CHECK#WARN:}" >&2
  fi
fi

# ═══════════════════════════════════════════════════════════════════
# === Section C: Cross-Artifact Consistency (Checks 12, 16-19) ===
# ═══════════════════════════════════════════════════════════════════

# Check 12: agent_verdicts in report must match actual trace verdicts
if [[ -d "$TRACE_DIR" && -n "$CONTENT" ]]; then
  VERDICTS_MISMATCH=$(REPORT_CONTENT="$CONTENT" python3 -c "
import json, glob, re, sys, os

content = os.environ['REPORT_CONTENT']
traces_dir = os.environ.get('CLAUDE_PROJECT_DIR', '.') + '/.claude/agent-traces'
errors = []

# Extract agent_verdicts from frontmatter
match = re.search(r'agent_verdicts:\s*(.+)', content)
if match:
    try:
        report_verdicts = json.loads(match.group(1).strip())
        # Compare against actual traces
        for name, report_verdict in report_verdicts.items():
            trace_path = os.path.join(traces_dir, name + '.json')
            if os.path.exists(trace_path):
                try:
                    trace = json.load(open(trace_path))
                    trace_verdict = trace.get('verdict', 'missing')
                    if str(report_verdict) != str(trace_verdict):
                        errors.append(f'{name}: report={report_verdict}, trace={trace_verdict}')
                except (json.JSONDecodeError, IOError):
                    pass
    except json.JSONDecodeError:
        pass  # Can't parse agent_verdicts — fail open

if errors:
    print('FAIL:' + '; '.join(errors))
else:
    print('OK')
" 2>/dev/null || echo "OK")
  if [[ "$VERDICTS_MISMATCH" == FAIL:* ]]; then
    MISMATCH_DETAIL="${VERDICTS_MISMATCH#FAIL:}"
    ERRORS+=("agent_verdicts mismatch with traces: $MISMATCH_DETAIL")
  fi
fi

# Check 16: hard_gate_failure field must be present (true or false)
if [[ -n "$CONTENT" ]]; then
  if ! echo "$CONTENT" | grep -q 'hard_gate_failure:'; then
    ERRORS+=("Check 16: hard_gate_failure field missing from report frontmatter — must be 'true' or 'false'")
  fi
fi

# Check 17: process_violation field must be present (true or false)
if [[ -n "$CONTENT" ]]; then
  if ! echo "$CONTENT" | grep -q 'process_violation:'; then
    ERRORS+=("Check 17: process_violation field missing from report frontmatter — must be 'true' or 'false'")
  fi
fi

# Check 18: Lead-side trace field validation (pages_reviewed, unresolved counts)
if [[ -d "$TRACE_DIR" && -n "$CONTENT" ]]; then
  LEAD_VALIDATION=$(python3 -c "
import json, os
traces_dir = os.environ.get('CLAUDE_PROJECT_DIR', '.') + '/.claude/agent-traces'
errors = []

# design-critic: pages_reviewed must be numeric and > 0
dc = os.path.join(traces_dir, 'design-critic.json')
if os.path.exists(dc):
    d = json.load(open(dc))
    pr = d.get('pages_reviewed', 0)
    if not isinstance(pr, int) or pr < 1:
        errors.append('design-critic pages_reviewed=%s (expected int >= 1)' % pr)

# ux-journeyer: unresolved_dead_ends must be numeric if present
ux = os.path.join(traces_dir, 'ux-journeyer.json')
if os.path.exists(ux):
    d = json.load(open(ux))
    ude = d.get('unresolved_dead_ends', None)
    if ude is not None and not isinstance(ude, int):
        errors.append('ux-journeyer unresolved_dead_ends=%s (expected int)' % ude)

# security-fixer: unresolved_critical must be numeric if present
sf = os.path.join(traces_dir, 'security-fixer.json')
if os.path.exists(sf):
    d = json.load(open(sf))
    uc = d.get('unresolved_critical', None)
    if uc is not None and not isinstance(uc, int):
        errors.append('security-fixer unresolved_critical=%s (expected int)' % uc)

if errors:
    print('FAIL:' + '; '.join(errors))
else:
    print('OK')
" 2>/dev/null || echo "OK")
  if [[ "$LEAD_VALIDATION" == FAIL:* ]]; then
    LEAD_DETAIL="${LEAD_VALIDATION#FAIL:}"
    ERRORS+=("Check 18: Lead-side trace field validation failed: $LEAD_DETAIL")
  fi
fi

# Check 19: Q-score recorded — verify-history.jsonl has entry matching current run_id
if [[ -f "$PROJECT_DIR/.claude/verify-context.json" ]]; then
  QCHECK=$(python3 -c "
import json, os
ctx = json.load(open('$PROJECT_DIR/.claude/verify-context.json'))
run_id = ctx.get('run_id', '')
history_path = '$PROJECT_DIR/.claude/verify-history.jsonl'
if not os.path.exists(history_path):
    print('FAIL:verify-history.jsonl missing — Q-score not calculated (STATE 7 step 7 incomplete)')
else:
    lines = [l.strip() for l in open(history_path) if l.strip()]
    if not lines:
        print('FAIL:verify-history.jsonl is empty — Q-score not recorded')
    else:
        last = json.loads(lines[-1])
        if last.get('run_id') != run_id:
            print('FAIL:verify-history.jsonl last run_id (' + str(last.get('run_id','?')) + ') != current (' + run_id + ') — Q-score not recorded for this run')
        else:
            print('OK')
" 2>/dev/null || echo "OK")
  if [[ "$QCHECK" == FAIL:* ]]; then
    DETAIL="${QCHECK#FAIL:}"
    ERRORS+=("Check 19: $DETAIL")
  fi
fi

# Output warnings to stderr (non-blocking)
if [[ ${#WARNINGS[@]} -gt 0 ]]; then
  for w in "${WARNINGS[@]}"; do
    echo "WARN: $w" >&2
  done
fi

# If any check failed, deny the write
if [[ ${#ERRORS[@]} -gt 0 ]]; then
  deny_errors "Verify report gate blocked: " "Complete all verification steps before writing verify-report.md."
fi

# All checks passed — allow
exit 0
