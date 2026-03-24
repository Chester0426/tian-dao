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
SECURITY_CHECKS='{
  "traces": [
    {
      "trace_file": "security-defender.json",
      "merge_key": null,
      "missing_error": "security-defender.json trace not found — cannot validate merge",
      "fields": [
        {"trace_field": "fails_count", "merge_field": "defender_fails"}
      ]
    },
    {
      "trace_file": "security-attacker.json",
      "merge_key": null,
      "missing_error": "security-attacker.json trace not found — cannot validate merge",
      "fields": [
        {"trace_field": "findings_count", "merge_field": "attacker_findings"}
      ]
    }
  ],
  "self_checks": [
    {"type": "count_match", "array_field": "issues", "count_field": "merged_issues"}
  ]
}'
VALIDATION=$(echo "$CONTENT" | validate_merge_json "$SECURITY_CHECKS")

handle_validation "$VALIDATION" "Security merge gate" "Merge JSON must match source agent traces."

# All checks passed — allow
exit 0
