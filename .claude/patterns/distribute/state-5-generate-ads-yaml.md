# STATE 5: GENERATE_ADS_YAML

**PRECONDITIONS:**
- Thresholds generated (STATE 4 POSTCONDITIONS met)

**ACTIONS:**

Write the complete `experiment/ads.yaml` file. Include `channel: <selected-channel>` as the first field. Follow the selected channel's stack file "Config Schema" section for the channel-specific structure. See `experiment/ads.example.yaml` for full schema examples across channels.

Present the full config for review.

**POSTCONDITIONS:**
- `experiment/ads.yaml` exists with complete campaign configuration
- `channel` is the first field in the file
- Config follows the selected channel's schema from its stack file
- Full config presented to the user for review

**VERIFY:**
```bash
test -f experiment/ads.yaml && head -1 experiment/ads.yaml | grep -q 'channel' && echo "OK" || echo "FAIL"
```

**STATE TRACKING:** After postconditions pass, mark this state complete:
```bash
bash .claude/scripts/advance-state.sh distribute 5
```

**NEXT:** Read [state-6-approval-gate.md](state-6-approval-gate.md) to continue.
