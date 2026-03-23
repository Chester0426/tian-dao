#!/usr/bin/env bash
# design-ux-merge-gate.sh — Claude Code PreToolUse hook for Write/Edit.
# Validates design-ux-merge.json fields match source agent traces.
# Blocks on mismatch between merge JSON and trace data.

set -euo pipefail

# Read the hook payload from stdin
PAYLOAD=$(cat)

# Extract file_path from tool_input
FILE_PATH=$(echo "$PAYLOAD" | python3 -c "import sys, json; d=json.load(sys.stdin); print(d.get('tool_input',{}).get('file_path',''))" 2>/dev/null || echo "")

# Only fire when file_path contains "design-ux-merge"
if [[ "$FILE_PATH" != *"design-ux-merge"* ]]; then
  exit 0
fi

# --- design-ux-merge.json write detected — run trace validation ---

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

# Check design-critic trace
dc_trace_path = os.path.join(traces_dir, 'design-critic.json')
if os.path.exists(dc_trace_path):
    try:
        dc = json.load(open(dc_trace_path))
        dc_merge = merge.get('design_critic', {})

        # Compare verdict
        if dc.get('verdict', '') != dc_merge.get('verdict', ''):
            errors.append(f'design_critic.verdict mismatch: trace={dc.get(\"verdict\",\"\")}, merge={dc_merge.get(\"verdict\",\"\")}')

        # Compare min_score
        if dc.get('min_score') is not None and dc_merge.get('min_score') is not None:
            if dc.get('min_score') != dc_merge.get('min_score'):
                errors.append(f'design_critic.min_score mismatch: trace={dc.get(\"min_score\")}, merge={dc_merge.get(\"min_score\")}')
    except (json.JSONDecodeError, IOError):
        pass

    # Validate shared_fixes_applied if design-critic-shared.json exists
    shared_path = os.path.join(traces_dir, 'design-critic-shared.json')
    if os.path.exists(shared_path):
        try:
            shared = json.load(open(shared_path))
            merge_shared = dc_merge.get('shared_fixes_applied', None)
            trace_shared = shared.get('fixes_applied', 0)
            if merge_shared is not None and merge_shared != trace_shared:
                errors.append(f'design_critic.shared_fixes_applied mismatch: trace={trace_shared}, merge={merge_shared}')
        except (json.JSONDecodeError, IOError):
            pass
else:
    errors.append('design-critic.json trace not found — cannot validate merge')

# Check ux-journeyer trace
ux_trace_path = os.path.join(traces_dir, 'ux-journeyer.json')
if os.path.exists(ux_trace_path):
    try:
        ux = json.load(open(ux_trace_path))
        ux_merge = merge.get('ux_journeyer', {})

        # Compare verdict
        if ux.get('verdict', '') != ux_merge.get('verdict', ''):
            errors.append(f'ux_journeyer.verdict mismatch: trace={ux.get(\"verdict\",\"\")}, merge={ux_merge.get(\"verdict\",\"\")}')

        # Compare clicks_to_value
        if ux.get('clicks_to_value') is not None and ux_merge.get('clicks_to_value') is not None:
            if ux.get('clicks_to_value') != ux_merge.get('clicks_to_value'):
                errors.append(f'ux_journeyer.clicks_to_value mismatch: trace={ux.get(\"clicks_to_value\")}, merge={ux_merge.get(\"clicks_to_value\")}')

        # Compare dead_ends
        if ux.get('dead_ends') is not None and ux_merge.get('dead_ends') is not None:
            if ux.get('dead_ends') != ux_merge.get('dead_ends'):
                errors.append(f'ux_journeyer.dead_ends mismatch: trace={ux.get(\"dead_ends\")}, merge={ux_merge.get(\"dead_ends\")}')
    except (json.JSONDecodeError, IOError):
        pass
else:
    errors.append('ux-journeyer.json trace not found — cannot validate merge')

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
{"permissionDecision": "deny", "message": "Design-UX merge gate blocked: ${ERROR_DETAIL}. Merge JSON must match source agent traces."}
EOF
  exit 0
fi

# All checks passed — allow
exit 0
