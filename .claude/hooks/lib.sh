#!/usr/bin/env bash
# lib.sh — shared functions for Claude Code hooks.
# Source from hooks: source "$(dirname "$0")/lib.sh"
# Call parse_payload first — it reads stdin into PAYLOAD.
# Do NOT register this file in settings.json — it is sourced, not invoked.

# --- parse_payload ---
# Reads stdin into global PAYLOAD. Must be called before any read_payload_field.
parse_payload() {
  PAYLOAD=$(cat)
}

# --- get_branch ---
# Returns current git branch. Caches in CURRENT_BRANCH on first call.
get_branch() {
  if [[ -z "${CURRENT_BRANCH+x}" ]]; then
    CURRENT_BRANCH=$(git branch --show-current 2>/dev/null || echo "")
  fi
  echo "$CURRENT_BRANCH"
}

# --- deny ---
# Outputs deny JSON and exits 0. Used for single-message denials.
# IMPORTANT: This calls exit 0 — it terminates the hook process.
# Never call deny() inside a subshell like $(deny "msg").
# Usage: deny "Your message here"
deny() {
  local msg="$1"
  printf '{"permissionDecision": "deny", "message": "%s"}\n' "$msg"
  exit 0
}

# --- deny_errors ---
# Joins global ERRORS array with "; ", outputs deny JSON, exits 0.
# Usage: deny_errors "Prefix: " "Suffix."
deny_errors() {
  local prefix="$1"
  local suffix="$2"
  local joined
  joined=$(printf '%s; ' "${ERRORS[@]}")
  printf '{"permissionDecision": "deny", "message": "%s%s%s"}\n' "$prefix" "$joined" "$suffix"
  exit 0
}

# --- read_payload_field ---
# Extracts a field from PAYLOAD by dotted path. Returns "" on missing/error.
# Handles root-level (tool_name) and nested (tool_input.command) paths.
# Usage: VAL=$(read_payload_field "tool_input.command")
read_payload_field() {
  local field_path="$1"
  echo "$PAYLOAD" | python3 -c "
import sys, json
d = json.load(sys.stdin)
for p in '$field_path'.split('.'):
    if isinstance(d, dict):
        d = d.get(p, '')
    else:
        d = ''
        break
print('' if isinstance(d, (dict, list)) else d)
" 2>/dev/null || echo ""
}

# --- read_json_field ---
# Reads a single field from a JSON file. Returns "" if file missing or error.
# Stringifies scalars (int 0 → "0", bool → "True"/"False").
# Usage: VAL=$(read_json_field "/path/to/file.json" "verdict")
read_json_field() {
  local file="$1"
  local field="$2"
  if [[ ! -f "$file" ]]; then
    echo ""
    return
  fi
  python3 -c "
import json
try:
    val = json.load(open('$file')).get('$field', '')
    print('' if isinstance(val, (dict, list)) else val)
except:
    print('')
" 2>/dev/null || echo ""
}

# --- extract_write_content ---
# Sets globals TOOL_NAME and CONTENT from Write or Edit payload.
# Must be called after parse_payload.
extract_write_content() {
  TOOL_NAME=$(read_payload_field "tool_name")
  CONTENT=""
  if [[ "$TOOL_NAME" == "Write" ]]; then
    CONTENT=$(read_payload_field "tool_input.content")
  elif [[ "$TOOL_NAME" == "Edit" ]]; then
    CONTENT=$(read_payload_field "tool_input.new_string")
  fi
}

# --- handle_validation ---
# Processes VALIDATION result from python3 content checks.
# OK → return, PARSE_ERROR → exit 0 (fail open), FAIL:... → deny with detail.
# Usage: handle_validation "$VALIDATION" "Gate name" "Suffix message."
handle_validation() {
  local result="$1"
  local gate_name="$2"
  local suffix="${3:-}"
  if [[ "$result" == "PARSE_ERROR" ]]; then
    exit 0
  fi
  if [[ "$result" == FAIL:* ]]; then
    local detail="${result#FAIL:}"
    deny "${gate_name} blocked: ${detail}. ${suffix}"
  fi
}

# --- normalize_states ---
# Reads completed_states from a context JSON file. Normalizes all entries
# to strings (int 0 → "0", mixed types handled). Outputs space-separated list.
# Returns empty string if file missing, field absent, or parse error.
# Usage: STATES=$(normalize_states "/path/to/context.json")
normalize_states() {
  local ctx_file="$1"
  [[ ! -f "$ctx_file" ]] && { echo ""; return; }
  python3 -c "
import json
try:
    d = json.load(open('$ctx_file'))
    print(' '.join(str(s) for s in d.get('completed_states', [])))
except: print('')
" 2>/dev/null || echo ""
}

# --- get_required_states ---
# Reads _required_states array from agent_gates[$SKILL] in state-registry.json.
# Returns space-separated list of state IDs. Empty string if skill or key missing.
# Usage: REQUIRED=$(get_required_states "bootstrap")
get_required_states() {
  local skill="$1"
  local registry="${CLAUDE_PROJECT_DIR:-.}/.claude/patterns/state-registry.json"
  [[ ! -f "$registry" ]] && { echo ""; return; }
  python3 -c "
import json
d = json.load(open('$registry'))
rs = d.get('agent_gates',{}).get('$skill',{}).get('_required_states',[])
print(' '.join(str(s) for s in rs))
" 2>/dev/null || echo ""
}

# --- check_verdict_gates ---
# Loops over gate verdict files, checks existence + PASS verdict + optional branch match.
# Appends errors to the global ERRORS array. Does not exit — caller decides.
# $1: space-separated list of gate names (e.g., "bg1 bg2 bg2.5 bg4")
# $2: verdicts directory path
# $3: (optional) branch name — when set, also validates verdict.branch matches
# Usage: check_verdict_gates "bg1 bg2 bg2.5 bg4" "$VERDICTS_DIR"
#        check_verdict_gates "g4 g5 g6" "$VERDICTS_DIR" "$BRANCH"
check_verdict_gates() {
  local gates_list="$1" verdicts_dir="$2" branch="${3:-}"
  for gate in $gates_list; do
    local gf="$verdicts_dir/$gate.json"
    if [[ ! -f "$gf" ]]; then
      ERRORS+=("${gate^^} verdict missing")
      continue
    fi
    local v; v=$(read_json_field "$gf" "verdict")
    [[ "$v" != "PASS" ]] && ERRORS+=("${gate^^} verdict is ${v:-?}, not PASS")
    if [[ -n "$branch" ]]; then
      local vb; vb=$(read_json_field "$gf" "branch")
      [[ -n "$vb" && "$vb" != "$branch" ]] && ERRORS+=("${gate^^} verdict is for branch $vb, not $branch")
    fi
  done
}

# --- validate_merge_json ---
# Parameterized JSON validation for merge gate hooks. Reads merge content from stdin.
# Parses merge content, loads traces, compares fields per check definitions.
# Returns "OK", "PARSE_ERROR", or "FAIL:<details>" — caller passes to handle_validation.
# $1: check definitions JSON string (declarative field comparisons)
# Usage: VALIDATION=$(echo "$CONTENT" | validate_merge_json "$CHECK_DEFS")
validate_merge_json() {
  local check_defs="$1"
  python3 -c "
import json, sys, os

content = sys.stdin.read().strip()
errors = []

try:
    merge = json.loads(content)
except json.JSONDecodeError:
    print('PARSE_ERROR')
    sys.exit(0)

traces_dir = os.environ.get('CLAUDE_PROJECT_DIR', '.') + '/.claude/agent-traces'
checks = json.loads('''$check_defs''')

for trace_def in checks.get('traces', []):
    trace_path = os.path.join(traces_dir, trace_def['trace_file'])
    if not os.path.exists(trace_path):
        errors.append(trace_def.get('missing_error', trace_def['trace_file'] + ' not found'))
        continue
    try:
        trace = json.load(open(trace_path))
    except (json.JSONDecodeError, IOError):
        continue

    merge_key = trace_def.get('merge_key')
    merge_section = merge.get(merge_key, {}) if merge_key else merge

    for fdef in trace_def.get('fields', []):
        t_val = trace.get(fdef['trace_field'])
        m_val = merge_section.get(fdef['merge_field'])
        if fdef.get('null_ok') and (t_val is None or m_val is None):
            continue
        if t_val != m_val:
            prefix = (merge_key + '.') if merge_key else ''
            errors.append(f'{prefix}{fdef[\"merge_field\"]} mismatch: trace={t_val}, merge={m_val}')

    for sub in trace_def.get('sub_traces', []):
        sub_path = os.path.join(traces_dir, sub['trace_file'])
        if sub.get('condition') == 'exists' and not os.path.exists(sub_path):
            continue
        try:
            sub_trace = json.load(open(sub_path))
        except (json.JSONDecodeError, IOError):
            continue
        for fdef in sub.get('fields', []):
            t_val = sub_trace.get(fdef['trace_field'])
            m_val = merge_section.get(fdef['merge_field'])
            if fdef.get('null_ok') and (t_val is None or m_val is None):
                continue
            if t_val != m_val:
                prefix = (merge_key + '.') if merge_key else ''
                errors.append(f'{prefix}{fdef[\"merge_field\"]} mismatch: trace={t_val}, merge={m_val}')

for sc in checks.get('self_checks', []):
    if sc['type'] == 'count_match':
        arr = merge.get(sc['array_field'], [])
        count = merge.get(sc['count_field'], 0)
        if count != len(arr):
            errors.append(f'{sc[\"count_field\"]} ({count}) != len({sc[\"array_field\"]}) ({len(arr)})')

if errors:
    print('FAIL:' + '; '.join(errors))
else:
    print('OK')
" 2>/dev/null || echo "OK"
}

# --- check_trace_verdict ---
# Checks a single field in a trace JSON file against an expected value.
# Returns "yes" (match), "no" (mismatch), or "missing" (file/field absent).
# Usage: RESULT=$(check_trace_verdict "/path/to/trace.json" "verdict" "PASS")
check_trace_verdict() {
  local trace_file="$1" field="$2" expected="$3"
  [[ ! -f "$trace_file" ]] && { echo "missing"; return; }
  python3 -c "
import json
try:
    d = json.load(open('$trace_file'))
    val = d.get('$field')
    if val is None: print('missing')
    elif str(val) == '$expected': print('yes')
    else: print('no')
except: print('missing')
" 2>/dev/null || echo "missing"
}
