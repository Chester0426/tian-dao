#!/usr/bin/env bash
# bootstrap-agent-gate.sh — Claude Code PreToolUse hook for Agent calls.
# Blocks scaffold-* subagents on feat/bootstrap* branches unless
# gate verdict files confirm prior gates passed.

set -euo pipefail

# Read the hook payload from stdin
PAYLOAD=$(cat)

# Extract subagent_type from tool_input
SUBAGENT_TYPE=$(echo "$PAYLOAD" | python3 -c "import sys, json; d=json.load(sys.stdin); print(d.get('tool_input',{}).get('subagent_type',''))" 2>/dev/null || echo "")

# If no subagent_type, allow (not an Agent call we care about)
if [[ -z "$SUBAGENT_TYPE" ]]; then
  exit 0
fi

# If the current branch is not feat/bootstrap*, allow
BRANCH=$(git branch --show-current 2>/dev/null || echo "")
if [[ "$BRANCH" != "feat/bootstrap" ]] && [[ ! "$BRANCH" =~ ^feat/bootstrap-[0-9]+$ ]]; then
  exit 0
fi

# Always allow gate-keeper and scaffold-externals unconditionally
if [[ "$SUBAGENT_TYPE" == "gate-keeper" ]] || [[ "$SUBAGENT_TYPE" == "scaffold-externals" ]]; then
  exit 0
fi

# For scaffold-* agents: require BG1 verdict PASS with matching branch
PROJECT_DIR="${CLAUDE_PROJECT_DIR:-.}"
VERDICTS_DIR="$PROJECT_DIR/.claude/gate-verdicts"

if [[ "$SUBAGENT_TYPE" == scaffold-* ]]; then
  # Check BG1 verdict file
  if [[ ! -f "$VERDICTS_DIR/bg1.json" ]]; then
    cat <<EOF
{"permissionDecision": "deny", "message": "Agent '$SUBAGENT_TYPE' blocked: BG1 verdict file missing at .claude/gate-verdicts/bg1.json. Run BG1 Validation Gate first."}
EOF
    exit 0
  fi

  BG1_VERDICT=$(python3 -c "import json; print(json.load(open('$VERDICTS_DIR/bg1.json')).get('verdict',''))" 2>/dev/null || echo "")
  if [[ "$BG1_VERDICT" != "PASS" ]]; then
    cat <<EOF
{"permissionDecision": "deny", "message": "Agent '$SUBAGENT_TYPE' blocked: BG1 verdict is '$BG1_VERDICT', not PASS. Fix BG1 issues before spawning scaffold agents."}
EOF
    exit 0
  fi

  BG1_BRANCH=$(python3 -c "import json; print(json.load(open('$VERDICTS_DIR/bg1.json')).get('branch',''))" 2>/dev/null || echo "")
  if [[ "$BG1_BRANCH" != "$BRANCH" ]]; then
    cat <<EOF
{"permissionDecision": "deny", "message": "Agent '$SUBAGENT_TYPE' blocked: BG1 verdict was for branch '$BG1_BRANCH', but current branch is '$BRANCH'. Re-run BG1 on the current branch."}
EOF
    exit 0
  fi

  # For scaffold-pages and scaffold-landing: require Phase A root files exist
  if [[ "$SUBAGENT_TYPE" == "scaffold-pages" ]] || [[ "$SUBAGENT_TYPE" == "scaffold-landing" ]]; then
    for REQUIRED_FILE in "src/app/layout.tsx" "src/app/not-found.tsx" "src/app/error.tsx"; do
      if [[ ! -f "$PROJECT_DIR/$REQUIRED_FILE" ]]; then
        cat <<EOF
{"permissionDecision": "deny", "message": "Agent '$SUBAGENT_TYPE' blocked: Phase A file '$REQUIRED_FILE' missing. Lead must create root files before spawning page/landing agents."}
EOF
        exit 0
      fi
    done
  fi

  # For scaffold-wire: additionally require BG2 verdict PASS
  if [[ "$SUBAGENT_TYPE" == "scaffold-wire" ]]; then
    if [[ ! -f "$VERDICTS_DIR/bg2.json" ]]; then
      cat <<EOF
{"permissionDecision": "deny", "message": "Agent 'scaffold-wire' blocked: BG2 verdict file missing at .claude/gate-verdicts/bg2.json. Run BG2 Orchestration Gate first."}
EOF
      exit 0
    fi

    BG2_VERDICT=$(python3 -c "import json; print(json.load(open('$VERDICTS_DIR/bg2.json')).get('verdict',''))" 2>/dev/null || echo "")
    if [[ "$BG2_VERDICT" != "PASS" ]]; then
      cat <<EOF
{"permissionDecision": "deny", "message": "Agent 'scaffold-wire' blocked: BG2 verdict is '$BG2_VERDICT', not PASS. Fix BG2 issues before wiring."}
EOF
      exit 0
    fi
  fi
fi

# All checks passed — allow
exit 0
