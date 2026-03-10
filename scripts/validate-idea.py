#!/usr/bin/env python3
"""Validate experiment.yaml structure: name format, archetype structure, required fields,
stack file existence, testing warning, and stack assumes consistency.

Exit codes:
  0 — all checks passed
  1 — hard error (validation failed)
  2 — passed with warnings (missing stack files, testing in stack, etc.)
"""

import os
import re
import sys

import yaml


data = yaml.safe_load(open("idea/experiment.yaml"))
warnings = False

# --- Name format ---
name = data.get("name", "")
if not re.fullmatch(r"[a-z][a-z0-9-]*", name):
    print(
        f'Error: name "{name}" must be lowercase, start with a letter, '
        "and use only a-z, 0-9, hyphens."
    )
    print("Example: my-experiment-1")
    sys.exit(1)

# --- Product type (optional) ---
idea_type = data.get("type")
if idea_type is not None:
    if not re.fullmatch(r"[a-z][a-z0-9-]*", str(idea_type)):
        print(
            f'Error: type "{idea_type}" must be lowercase, start with a letter, '
            "and use only a-z, 0-9, hyphens."
        )
        print("Example: web-app")
        sys.exit(1)
    archetype_path = f".claude/archetypes/{idea_type}.md"
    if not os.path.isfile(archetype_path):
        print(f"  Warning: type '{idea_type}' — no file at {archetype_path}")
        print(
            "  Claude will use general knowledge for this archetype. "
            "To fix: create the archetype file or change the type value."
        )
        warnings = True

# --- Resolve archetype metadata ---
effective_type = idea_type if idea_type is not None else "web-app"
archetype_path_resolved = f".claude/archetypes/{effective_type}.md"
archetype_fm = {}
if os.path.isfile(archetype_path_resolved):
    with open(archetype_path_resolved) as af:
        _content = af.read()
    _m = re.match(r"^---\n(.*?\n)---", _content, re.DOTALL)
    if _m:
        archetype_fm = yaml.safe_load(_m.group(1)) or {}
archetype_required = archetype_fm.get("required_idea_fields", ["pages"])

# --- Landing page (only for archetypes that require pages) ---
pages = data.get("pages", [])
if "pages" in archetype_required:
    if not any(p.get("name") == "landing" for p in pages):
        print("Error: pages must include an entry with name: landing")
        print("Add a landing page to the pages list in experiment.yaml.")
        sys.exit(1)

# --- Required fields ---
base_required = [
    "name", "title", "owner", "problem", "solution", "target_user",
    "distribution", "features", "primary_metric", "target_value",
    "measurement_window", "stack",
]
required = base_required + archetype_required
missing = [f for f in required if not data.get(f)]
if missing:
    print("Error: these required fields are missing or empty: " + ", ".join(missing))
    sys.exit(1)
# --- Variants validation (optional field) ---
variants = data.get("variants")
if variants is not None:
    if not isinstance(variants, list):
        print("Error: variants must be a list")
        sys.exit(1)
    if len(variants) < 2:
        print(
            "Error: variants must have at least 2 entries "
            "(testing 1 variant = no variants — remove the variants field)"
        )
        sys.exit(1)

    page_names = {p.get("name") for p in pages if isinstance(p, dict)}
    slugs_seen = set()
    default_count = 0

    for i, v in enumerate(variants):
        if not isinstance(v, dict):
            print(f"Error: variants[{i}] must be a mapping")
            sys.exit(1)

        for field in ["slug", "headline", "subheadline", "cta", "pain_points"]:
            val = v.get(field)
            if not val:
                print(f"Error: variants[{i}].{field} is missing or empty")
                sys.exit(1)

        slug = v.get("slug", "")
        if not re.fullmatch(r"[a-z][a-z0-9-]*", slug):
            print(
                f'Error: variants[{i}].slug "{slug}" must be lowercase, '
                "start with a letter, and use only a-z, 0-9, hyphens."
            )
            sys.exit(1)

        if slug in slugs_seen:
            print(f"Error: duplicate variant slug: {slug}")
            sys.exit(1)
        slugs_seen.add(slug)

        if slug in page_names:
            print(f"Error: variant slug '{slug}' collides with page name '{slug}'")
            sys.exit(1)

        pp = v.get("pain_points", [])
        if not isinstance(pp, list) or len(pp) != 3:
            print(f"Error: variants[{i}].pain_points must have exactly 3 items")
            sys.exit(1)

        # Optional enrichment fields (promise, proof, urgency)
        for enrich_field in ["promise", "proof", "urgency"]:
            enrich_val = v.get(enrich_field)
            if enrich_val is not None:
                if not isinstance(enrich_val, str) or not enrich_val.strip():
                    print(f"Error: variants[{i}].{enrich_field} must be a non-empty string (or remove it)")
                    sys.exit(1)

        if v.get("default"):
            default_count += 1

    if default_count > 1:
        print("Error: at most one variant may have default: true")
        sys.exit(1)

# --- Golden path validation (optional field) ---
golden_path = data.get("golden_path")
if golden_path is not None:
    if not isinstance(golden_path, list):
        print("Error: golden_path must be a list")
        sys.exit(1)
    if len(golden_path) < 2:
        print("Error: golden_path must have at least 2 entries")
        sys.exit(1)

    page_names = {p.get("name") for p in pages if isinstance(p, dict)}
    implicit_auth_pages = {"signup", "login"}
    has_value_moment = False

    for i, step in enumerate(golden_path):
        if not isinstance(step, dict):
            print(f"Error: golden_path[{i}] must be a mapping")
            sys.exit(1)

        step_page = step.get("page")
        step_action = step.get("action")
        if not step_page or not isinstance(step_page, str):
            print(f"Error: golden_path[{i}].page is missing or empty")
            sys.exit(1)
        if not step_action or not isinstance(step_action, str):
            print(f"Error: golden_path[{i}].action is missing or empty")
            sys.exit(1)

        if step_page not in page_names and step_page not in implicit_auth_pages:
            print(
                f"Error: golden_path[{i}].page '{step_page}' "
                "is not in the pages list and is not an implicit auth page"
            )
            sys.exit(1)

        if step.get("value_moment"):
            has_value_moment = True

    if not has_value_moment:
        print("Error: golden_path must have at least one entry with value_moment: true")
        sys.exit(1)

    if golden_path[0].get("page") != "landing":
        print("Error: golden_path first entry's page must be 'landing'")
        sys.exit(1)

# --- Target clicks validation (optional field) ---
target_clicks = data.get("target_clicks")
if target_clicks is not None:
    if not isinstance(target_clicks, int) or target_clicks < 1:
        print("Error: target_clicks must be a positive integer")
        sys.exit(1)

# --- Critical flows validation (optional field) ---
critical_flows = data.get("critical_flows")
if critical_flows is not None:
    if not isinstance(critical_flows, list):
        print("Error: critical_flows must be a list")
        sys.exit(1)
    if len(critical_flows) < 1:
        print("Error: critical_flows must have at least 1 entry")
        sys.exit(1)

    valid_actors = {"system", "admin", "cron"}
    flow_names_seen = set()

    for i, flow in enumerate(critical_flows):
        if not isinstance(flow, dict):
            print(f"Error: critical_flows[{i}] must be a mapping")
            sys.exit(1)

        flow_name = flow.get("name")
        if not flow_name or not isinstance(flow_name, str):
            print(f"Error: critical_flows[{i}].name is missing or empty")
            sys.exit(1)

        if flow_name in flow_names_seen:
            print(f"Error: duplicate critical_flows name: {flow_name}")
            sys.exit(1)
        flow_names_seen.add(flow_name)

        flow_trigger = flow.get("trigger")
        if not flow_trigger or not isinstance(flow_trigger, str):
            print(f"Error: critical_flows[{i}].trigger is missing or empty")
            sys.exit(1)

        flow_actor = flow.get("actor", "system")
        if flow_actor not in valid_actors:
            print(
                f'Error: critical_flows[{i}].actor "{flow_actor}" '
                f"must be one of: {', '.join(sorted(valid_actors))}"
            )
            sys.exit(1)

        flow_steps = flow.get("steps")
        if not isinstance(flow_steps, list) or len(flow_steps) < 1:
            print(f"Error: critical_flows[{i}].steps must be a list with at least 1 entry")
            sys.exit(1)

        flow_verify = flow.get("verify")
        if not flow_verify or not isinstance(flow_verify, str):
            print(f"Error: critical_flows[{i}].verify is missing or empty")
            sys.exit(1)

# --- Level validation (optional, /spec field) ---
level = data.get("level")
if level is not None:
    if not isinstance(level, int) or isinstance(level, bool) or level not in (1, 2, 3):
        print("Error: level must be 1, 2, or 3")
        sys.exit(1)

# --- Thesis validation (optional, /spec field) ---
thesis = data.get("thesis")
if thesis is not None:
    if not isinstance(thesis, str) or not thesis.strip():
        print("Error: thesis must be a non-empty string")
        sys.exit(1)

# --- Hypotheses validation (optional, /spec field) ---
hypotheses = data.get("hypotheses")
hypothesis_ids = set()
if hypotheses is not None:
    if not isinstance(hypotheses, list):
        print("Error: hypotheses must be a list"); sys.exit(1)

    VALID_CATEGORIES = {"demand", "reach", "feasibility", "monetize", "retain"}
    VALID_STATUSES = {"pending", "resolved"}
    depends_to_check = []  # (index, list_of_dep_ids)

    for i, h in enumerate(hypotheses):
        if not isinstance(h, dict):
            print(f"Error: hypotheses[{i}] must be a mapping"); sys.exit(1)

        # Required string fields
        for field in ["id", "category", "statement", "test_method", "success_metric", "threshold"]:
            if not h.get(field) or not isinstance(h.get(field), str):
                print(f"Error: hypotheses[{i}].{field} is missing or empty"); sys.exit(1)

        h_id = h["id"]
        if not re.fullmatch(r"h_[a-z]+_\d+", h_id):
            print(f'Error: hypotheses[{i}].id "{h_id}" must match h_<category>_<n>'); sys.exit(1)

        if h["category"] not in VALID_CATEGORIES:
            print(f'Error: hypotheses[{i}].category "{h["category"]}" must be: {", ".join(sorted(VALID_CATEGORIES))}'); sys.exit(1)

        # Required int fields
        ps = h.get("priority_score")
        if not isinstance(ps, int) or isinstance(ps, bool) or not (1 <= ps <= 10):
            print(f"Error: hypotheses[{i}].priority_score must be integer 1-10"); sys.exit(1)

        el = h.get("experiment_level")
        if not isinstance(el, int) or isinstance(el, bool) or el not in (1, 2, 3):
            print(f"Error: hypotheses[{i}].experiment_level must be 1, 2, or 3"); sys.exit(1)

        status = h.get("status")
        if not isinstance(status, str) or status not in VALID_STATUSES:
            print(f'Error: hypotheses[{i}].status must be: {", ".join(sorted(VALID_STATUSES))}'); sys.exit(1)

        # Unique ID
        if h_id in hypothesis_ids:
            print(f"Error: duplicate hypothesis id: {h_id}"); sys.exit(1)
        hypothesis_ids.add(h_id)

        # depends_on (optional)
        deps = h.get("depends_on")
        if deps is not None:
            if not isinstance(deps, list):
                print(f"Error: hypotheses[{i}].depends_on must be a list"); sys.exit(1)
            depends_to_check.append((i, deps))

    # Second pass: depends_on references exist
    for i, deps in depends_to_check:
        for dep_id in deps:
            if dep_id not in hypothesis_ids:
                print(f'Error: hypotheses[{i}].depends_on references unknown id "{dep_id}"'); sys.exit(1)

    # Cross-field: experiment_level <= top-level level
    if level is not None:
        for i, h in enumerate(hypotheses):
            if h.get("experiment_level", 0) > level:
                print(f"Error: hypotheses[{i}].experiment_level ({h['experiment_level']}) exceeds top-level level ({level})"); sys.exit(1)

# --- Behaviors validation (optional, /spec field) ---
behaviors = data.get("behaviors")
if behaviors is not None:
    if not isinstance(behaviors, list):
        print("Error: behaviors must be a list"); sys.exit(1)

    behavior_ids = set()
    for i, b in enumerate(behaviors):
        if not isinstance(b, dict):
            print(f"Error: behaviors[{i}] must be a mapping"); sys.exit(1)

        for field in ["id", "hypothesis_id", "given", "when", "then"]:
            if not b.get(field) or not isinstance(b.get(field), str):
                print(f"Error: behaviors[{i}].{field} is missing or empty"); sys.exit(1)

        b_id = b["id"]
        if not re.fullmatch(r"b_\d+", b_id):
            print(f'Error: behaviors[{i}].id "{b_id}" must match b_<n>'); sys.exit(1)

        if b_id in behavior_ids:
            print(f"Error: duplicate behavior id: {b_id}"); sys.exit(1)
        behavior_ids.add(b_id)

        b_level = b.get("level")
        if not isinstance(b_level, int) or isinstance(b_level, bool) or b_level not in (1, 2, 3):
            print(f"Error: behaviors[{i}].level must be 1, 2, or 3"); sys.exit(1)

        # Cross-ref: hypothesis_id must exist if hypotheses section present
        h_id_ref = b["hypothesis_id"]
        if hypotheses is not None:
            if h_id_ref not in hypothesis_ids:
                print(f'Error: behaviors[{i}].hypothesis_id "{h_id_ref}" not found in hypotheses'); sys.exit(1)
        elif hypothesis_ids is not None:
            # hypotheses absent but behaviors reference them — soft warning
            print(f'  Warning: behaviors[{i}].hypothesis_id "{h_id_ref}" — hypotheses section is absent')
            warnings = True

# --- Funnel validation (optional, /spec field) ---
funnel = data.get("funnel")
if funnel is not None:
    if not isinstance(funnel, dict):
        print("Error: funnel must be a mapping"); sys.exit(1)

    thresholds = funnel.get("thresholds")
    if not isinstance(thresholds, dict) or not thresholds:
        print("Error: funnel.thresholds is required and must be a non-empty mapping"); sys.exit(1)
    for k, v in thresholds.items():
        if not isinstance(v, str) or not v.strip():
            print(f'Error: funnel.thresholds.{k} must be a non-empty string'); sys.exit(1)

    df = funnel.get("decision_framework")
    if not isinstance(df, str) or not df.strip():
        print("Error: funnel.decision_framework is required and must be a non-empty string"); sys.exit(1)

if not data.get("template_repo"):
    print(
        "  Warning: template_repo not set. "
        "/retro will ask where to file the retrospective."
    )

# --- Stack file existence ---
stack = data.get("stack", {})
stack_warnings = [
    f"stack.{k}: {v} — no file at .claude/stacks/{k}/{v}.md"
    for k, v in stack.items()
    if not os.path.isfile(f".claude/stacks/{k}/{v}.md")
]
if stack_warnings:
    for w in stack_warnings:
        print(f"  Warning: {w}")
    print(
        "  Claude will use general knowledge for these. "
        "To fix: create the stack file or change the value."
    )
    warnings = True

# --- Surface validation ---
effective_surface = stack.get("surface")
if effective_surface is None:
    # Infer from hosting presence
    effective_surface = "co-located" if "hosting" in stack else "detached"

# Validate surface value format
if effective_surface not in ("co-located", "detached", "none"):
    print(f'Error: stack.surface "{effective_surface}" must be one of: co-located, detached, none')
    sys.exit(1)

# Validate surface + archetype combination
invalid_combos = {
    ("service", "detached"): "Services have a server — use co-located (surface at root URL) or none.",
    ("cli", "co-located"): "CLIs have no server — use detached (Vercel static site) or none.",
}
combo = (effective_type, effective_surface)
if combo in invalid_combos:
    print(f"Error: type '{effective_type}' + surface '{effective_surface}' is invalid. {invalid_combos[combo]}")
    sys.exit(1)

# Check surface stack file existence
if effective_surface != "none":
    sf_path = f".claude/stacks/surface/{effective_surface}.md"
    if not os.path.isfile(sf_path):
        print(f"  Warning: surface '{effective_surface}' — no file at {sf_path}")
        warnings = True

# --- Stack assumes consistency ---
assumes_warnings = []
for cat, val in stack.items():
    sf = f".claude/stacks/{cat}/{val}.md"
    if not os.path.isfile(sf):
        continue
    with open(sf) as f:
        content = f.read()
    m = re.match(r"^---\n(.*?\n)---", content, re.DOTALL)
    if not m:
        continue
    fm = yaml.safe_load(m.group(1)) or {}
    for assume in fm.get("assumes") or []:
        parts = assume.split("/")
        if len(parts) != 2:
            continue
        a_cat, a_val = parts
        actual = stack.get(a_cat)
        if actual is None:
            assumes_warnings.append(
                f"stack.{cat}/{val} assumes {assume}, but stack.{a_cat} is not set"
            )
        elif actual != a_val:
            assumes_warnings.append(
                f"stack.{cat}/{val} assumes {assume}, but stack.{a_cat} is {actual}"
            )

if assumes_warnings:
    print("  Warning: stack assumes mismatches:")
    for w in assumes_warnings:
        print(f"    - {w}")
    print(
        "  /bootstrap will reject these. "
        "Fix experiment.yaml stack values or create compatible stack files."
    )
    warnings = True

sys.exit(2 if warnings else 0)
