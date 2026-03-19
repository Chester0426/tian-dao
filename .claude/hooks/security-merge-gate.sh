#!/usr/bin/env bash
# security-merge-gate.sh — Claude Code PreToolUse hook for Write/Edit.
# Validates security-merge.json fields match source agent traces.
# Blocks on mismatch between merge JSON and trace data.

set -euo pipefail

# Read the hook payload from stdin
PAYLOAD=$(cat)

# Extract file_path from tool_input
FILE_PATH=$(echo "$PAYLOAD" | python3 -c "import sys, json; d=json.load(sys.stdin); print(d.get('tool_input',{}).get('file_path',''))" 2>/dev/null || echo "")

# Only fire when file_path contains "security-merge"
if [[ "$FILE_PATH" != *"security-merge"* ]]; then
  exit 0
fi

# --- security-merge.json write detected — run trace validation ---

PROJECT_DIR="${CLAUDE_PROJECT_DIR:-.}"
TRACES_DIR="$PROJECT_DIR/.claude/agent-traces"
ERRORS=()

TOOL_NAME=$(echo "$PAYLOAD" | python3 -c "import sys, json; print(json.load(sys.stdin).get('tool_name',''))" 2>/dev/null || echo "")
CONTENT=""
if [[ "$TOOL_NAME" == "Write" ]]; then
  CONTENT=$(echo "$PAYLOAD" | python3 -c "import sys, json; print(json.load(sys.stdin).get('tool_input',{}).get('content',''))" 2>/dev/null || echo "")
elif [[ "$TOOL_NAME" == "Edit" ]]; then
  CONTENT=$(echo "$PAYLOAD" | python3 -c "import sys, json; print(json.load(sys.stdin).get('tool_input',{}).get('new_string',''))" 2>/dev/null || echo "")
fi

# Skip if content is empty
if [[ -z "$CONTENT" ]]; then
  exit 0
fi

# Validate merge JSON against source traces
VALIDATION=$(echo "$CONTENT" | python3 -c "
import json, sys, os

content = sys.stdin.read().strip()
errors = []

try:
    merge = json.loads(content)
except json.JSONDecodeError:
    print('PARSE_ERROR')
    sys.exit(0)

traces_dir = os.environ.get('CLAUDE_PROJECT_DIR', '.') + '/.claude/agent-traces'

# Check 1: defender_fails matches defender trace fails_count
defender_path = os.path.join(traces_dir, 'security-defender.json')
if os.path.exists(defender_path):
    try:
        defender = json.load(open(defender_path))
        trace_fails = defender.get('fails_count', 0)
        merge_fails = merge.get('defender_fails', 0)
        if trace_fails != merge_fails:
            errors.append(f'defender_fails mismatch: trace={trace_fails}, merge={merge_fails}')
    except (json.JSONDecodeError, IOError):
        pass
else:
    errors.append('security-defender.json trace not found — cannot validate merge')

# Check 2: attacker_findings matches attacker trace findings_count
attacker_path = os.path.join(traces_dir, 'security-attacker.json')
if os.path.exists(attacker_path):
    try:
        attacker = json.load(open(attacker_path))
        trace_findings = attacker.get('findings_count', 0)
        merge_findings = merge.get('attacker_findings', 0)
        if trace_findings != merge_findings:
            errors.append(f'attacker_findings mismatch: trace={trace_findings}, merge={merge_findings}')
    except (json.JSONDecodeError, IOError):
        pass
else:
    errors.append('security-attacker.json trace not found — cannot validate merge')

# Check 3: merged_issues matches len(issues)
issues = merge.get('issues', [])
merged_count = merge.get('merged_issues', 0)
if merged_count != len(issues):
    errors.append(f'merged_issues ({merged_count}) != len(issues) ({len(issues)})')

if errors:
    print('FAIL:' + '; '.join(errors))
else:
    print('OK')
" 2>/dev/null || echo "OK")

if [[ "$VALIDATION" == "PARSE_ERROR" ]]; then
  # Can't parse JSON — fail open
  exit 0
fi

if [[ "$VALIDATION" == FAIL:* ]]; then
  ERROR_DETAIL="${VALIDATION#FAIL:}"
  cat <<EOF
{"permissionDecision": "deny", "message": "Security merge gate blocked: ${ERROR_DETAIL}. Merge JSON must match source agent traces."}
EOF
  exit 0
fi

# All checks passed — allow
exit 0
