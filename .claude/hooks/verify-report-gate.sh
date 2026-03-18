#!/usr/bin/env bash
# verify-report-gate.sh — Claude Code PreToolUse hook for Write/Edit.
# Blocks writing verify-report.md unless durable artifacts exist.

set -euo pipefail

# Read the hook payload from stdin
PAYLOAD=$(cat)

# Extract file_path from tool_input
FILE_PATH=$(echo "$PAYLOAD" | python3 -c "import sys, json; d=json.load(sys.stdin); print(d.get('tool_input',{}).get('file_path',''))" 2>/dev/null || echo "")

# Only fire when file_path contains "verify-report"
if [[ "$FILE_PATH" != *"verify-report"* ]]; then
  exit 0
fi

# --- verify-report.md write detected — run artifact checks ---

PROJECT_DIR="${CLAUDE_PROJECT_DIR:-.}"
ERRORS=()

TOOL_NAME=$(echo "$PAYLOAD" | python3 -c "import sys, json; print(json.load(sys.stdin).get('tool_name',''))" 2>/dev/null || echo "")
CONTENT=""
if [[ "$TOOL_NAME" == "Write" ]]; then
  CONTENT=$(echo "$PAYLOAD" | python3 -c "import sys, json; print(json.load(sys.stdin).get('tool_input',{}).get('content',''))" 2>/dev/null || echo "")
elif [[ "$TOOL_NAME" == "Edit" ]]; then
  CONTENT=$(echo "$PAYLOAD" | python3 -c "import sys, json; print(json.load(sys.stdin).get('tool_input',{}).get('new_string',''))" 2>/dev/null || echo "")
fi

# Check 1: verify-context.json exists (STATE 0 ran)
if [[ ! -f "$PROJECT_DIR/.claude/verify-context.json" ]]; then
  ERRORS+=("verify-context.json not found — STATE 0 (Read Context) did not run")
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
    if isinstance(cp, list) and len(cp) > 0:
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

# Check 5: If scope is full/security, security-merge.json must exist
if [[ -f "$PROJECT_DIR/.claude/verify-context.json" ]]; then
  SCOPE=$(python3 -c "
import json, sys
try:
    d = json.load(open('$PROJECT_DIR/.claude/verify-context.json'))
    print(d.get('scope', ''))
except:
    print('')
" 2>/dev/null || echo "")
  if [[ "$SCOPE" == "full" || "$SCOPE" == "security" ]]; then
    if [[ ! -f "$PROJECT_DIR/.claude/security-merge.json" ]]; then
      ERRORS+=("security-merge.json not found — security merge step was skipped (scope=$SCOPE)")
    fi
  fi
fi

# Check 6: If fix-log.md has content beyond header, auto_observe must not be skipped-no-fixes
if [[ -f "$PROJECT_DIR/.claude/fix-log.md" ]]; then
  # Count non-empty lines after the header (first line)
  FIX_ENTRIES=$(tail -n +2 "$PROJECT_DIR/.claude/fix-log.md" | grep -c '[^[:space:]]' 2>/dev/null || echo "0")
  if [[ "$FIX_ENTRIES" -gt 0 ]]; then
    # Extract content being written — check for auto_observe: skipped-no-fixes
    if echo "$CONTENT" | grep -q 'auto_observe:.*skipped-no-fixes'; then
      ERRORS+=("fix-log.md has $FIX_ENTRIES fix entries but auto_observe is skipped-no-fixes — observer must run when fixes exist")
    fi
  fi
fi

# Check 7: e2e-result.json must exist (STATE 5 ran or explicitly skipped)
if [[ ! -f "$PROJECT_DIR/.claude/e2e-result.json" ]]; then
  ERRORS+=("e2e-result.json not found — E2E tests (STATE 5) did not run")
fi

# Check 8: If scope is full/visual AND archetype is web-app, design-ux-merge.json must exist
if [[ -f "$PROJECT_DIR/.claude/verify-context.json" ]]; then
  SCOPE_DUX=$(python3 -c "
import json, sys
try:
    d = json.load(open('$PROJECT_DIR/.claude/verify-context.json'))
    print(d.get('scope', ''))
except:
    print('')
" 2>/dev/null || echo "")
  ARCHETYPE_DUX=$(python3 -c "
import json, sys
try:
    d = json.load(open('$PROJECT_DIR/.claude/verify-context.json'))
    print(d.get('archetype', ''))
except:
    print('')
" 2>/dev/null || echo "")
  if [[ ("$SCOPE_DUX" == "full" || "$SCOPE_DUX" == "visual") && "$ARCHETYPE_DUX" == "web-app" ]]; then
    if [[ ! -f "$PROJECT_DIR/.claude/design-ux-merge.json" ]]; then
      ERRORS+=("design-ux-merge.json not found — Design-UX merge step was skipped (scope=$SCOPE_DUX, archetype=$ARCHETYPE_DUX)")
    fi
  fi
fi

# Check 9: design-critic hard gate
DC_TRACE="$TRACE_DIR/design-critic.json"
if [[ -f "$DC_TRACE" ]]; then
  DC_VERDICT=$(python3 -c "import json; d=json.load(open('$DC_TRACE')); print(d.get('verdict',''))" 2>/dev/null || echo "")
  DC_RECOVERY=$(python3 -c "import json; d=json.load(open('$DC_TRACE')); print('true' if d.get('recovery') else 'false')" 2>/dev/null || echo "false")
  if [[ "$DC_VERDICT" == "unresolved" || "$DC_RECOVERY" == "true" ]]; then
    if ! echo "$CONTENT" | grep -q 'hard_gate_failure: *true'; then
      ERRORS+=("design-critic verdict=$DC_VERDICT recovery=$DC_RECOVERY requires hard_gate_failure: true in report frontmatter")
    fi
  fi
fi

# Check 10: ux-journeyer hard gate
UX_TRACE="$TRACE_DIR/ux-journeyer.json"
if [[ -f "$UX_TRACE" ]]; then
  UX_VERDICT=$(python3 -c "import json; d=json.load(open('$UX_TRACE')); print(d.get('verdict',''))" 2>/dev/null || echo "")
  UX_UDE=$(python3 -c "import json; d=json.load(open('$UX_TRACE')); print(d.get('unresolved_dead_ends',0))" 2>/dev/null || echo "0")
  UX_RECOVERY=$(python3 -c "import json; d=json.load(open('$UX_TRACE')); print('true' if d.get('recovery') else 'false')" 2>/dev/null || echo "false")
  if [[ "$UX_VERDICT" == "blocked" || "$UX_UDE" -gt 0 || "$UX_RECOVERY" == "true" ]]; then
    if ! echo "$CONTENT" | grep -q 'hard_gate_failure: *true'; then
      ERRORS+=("ux-journeyer verdict=$UX_VERDICT unresolved_dead_ends=$UX_UDE recovery=$UX_RECOVERY requires hard_gate_failure: true in report frontmatter")
    fi
  fi
fi

# Check 11: security-fixer hard gate
SF_TRACE="$TRACE_DIR/security-fixer.json"
if [[ -f "$SF_TRACE" ]]; then
  SF_VERDICT=$(python3 -c "import json; d=json.load(open('$SF_TRACE')); print(d.get('verdict',''))" 2>/dev/null || echo "")
  SF_UC=$(python3 -c "import json; d=json.load(open('$SF_TRACE')); print(d.get('unresolved_critical',0))" 2>/dev/null || echo "0")
  SF_RECOVERY=$(python3 -c "import json; d=json.load(open('$SF_TRACE')); print('true' if d.get('recovery') else 'false')" 2>/dev/null || echo "false")
  if [[ ("$SF_VERDICT" == "partial" && "$SF_UC" -gt 0) || "$SF_RECOVERY" == "true" ]]; then
    if ! echo "$CONTENT" | grep -q 'hard_gate_failure: *true'; then
      ERRORS+=("security-fixer verdict=$SF_VERDICT unresolved_critical=$SF_UC recovery=$SF_RECOVERY requires hard_gate_failure: true in report frontmatter")
    fi
  fi
fi

# If any check failed, deny the write
if [[ ${#ERRORS[@]} -gt 0 ]]; then
  ERROR_MSG=$(printf '%s; ' "${ERRORS[@]}")
  cat <<EOF
{"permissionDecision": "deny", "message": "Verify report gate blocked: ${ERROR_MSG}Complete all verification steps before writing verify-report.md."}
EOF
  exit 0
fi

# All checks passed — allow
exit 0
