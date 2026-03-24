#!/usr/bin/env bash
# security-merge-gate.sh — Claude Code PreToolUse hook for Write/Edit.
# Validates security-merge.json fields match source agent traces.
# Blocks on mismatch between merge JSON and trace data.

set -euo pipefail

source "$(dirname "$0")/lib.sh"
parse_payload

FILE_PATH=$(read_payload_field "tool_input.file_path")

# Only fire when file_path contains "security-merge"
if [[ "$FILE_PATH" != *"security-merge"* ]]; then
  exit 0
fi

# --- security-merge.json write detected — run trace validation ---

extract_write_content

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

handle_validation "$VALIDATION" "Security merge gate" "Merge JSON must match source agent traces."

# All checks passed — allow
exit 0
