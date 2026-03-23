#!/usr/bin/env bash
# advance-state.sh — Advances the verify state machine by adding a state to completed_states.
# Usage: bash .claude/scripts/advance-state.sh <state_number>
# Guarded by state-completion-gate.sh hook which validates postconditions before allowing execution.
set -euo pipefail
STATE_NUM="$1"
PROJECT_DIR="${CLAUDE_PROJECT_DIR:-.}"
CTX="$PROJECT_DIR/.claude/verify-context.json"
python3 -c "
import json
f='$CTX'; d=json.load(open(f))
cs=d.get('completed_states',[])
if $STATE_NUM not in cs: cs.append($STATE_NUM)
d['completed_states']=cs; json.dump(d,open(f,'w'))
"
