#!/usr/bin/env python3
"""Validate EVENTS.yaml structure: flat events map with funnel_stage tags."""

import sys

import yaml

data = yaml.safe_load(open("EVENTS.yaml"))
errors = []

if not data:
    errors.append("EVENTS.yaml is empty")
else:
    events = data.get("events")
    if events is None:
        errors.append('missing required key "events"')
    elif not isinstance(events, dict):
        errors.append('"events" must be a dict (flat map keyed by event name)')
    else:
        valid_stages = {"reach", "demand", "activate", "monetize", "retain"}
        for name, ev in events.items():
            if not isinstance(ev, dict):
                errors.append(f'events.{name} must be a dict')
                continue
            if "funnel_stage" not in ev:
                errors.append(f'events.{name} missing "funnel_stage"')
            elif ev["funnel_stage"] not in valid_stages:
                errors.append(
                    f'events.{name} funnel_stage "{ev["funnel_stage"]}" '
                    f'not in {sorted(valid_stages)}'
                )
            if "trigger" not in ev:
                errors.append(f'events.{name} missing "trigger"')

if errors:
    print("EVENTS.yaml issues:")
    for e in errors:
        print(f"  - {e}")
    sys.exit(1)
