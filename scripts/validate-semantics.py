#!/usr/bin/env python3
"""Validate semantic correctness across stack files, skill files, and fixtures.

Checks:
  1. Import Completeness in TSX Templates — JSX components have matching imports
  2. Makefile Target Guards — npm/node targets guard on package.json
  3. Fixture Validation — test fixture files are structurally correct
  4. Frontmatter ↔ Content Sync — code block headers match frontmatter files
  5. Conditional Dependency References — optional stack references have guards
  6. Required Fields Consistency — Makefile and validator agree on required fields
  7. Fixture Stack Coverage — every stack file has at least one fixture
  8. Tool & Prereq Validity — referenced tools exist
  9. Env Loading Outside Next.js Runtime — non-src templates load env config
  10. Validate Warning Differentiation — success message varies with warnings
  11. Hardcoded Provider Names Match Assumes — code blocks match assumes
  12. Prose File References in Reads Frontmatter — referenced files in reads
  13. Fixture Branching Coverage — conditional stack paths have fixtures
  14. Stack Fallback When Assumes Not Met — fallback section for missing deps
  15. Makefile Deploy Hosting Guard — deploy target checks hosting stack
  16. Change Payment-Auth Dependency — change skill validates payment requires auth
  17. Stack File Env Vars Prose-Frontmatter Sync — env vars in prose match frontmatter
  18. Change Payment-Database Dependency — change skill validates payment requires database
  19. Fixture Coverage for Testing Partial Assumes — testing fixtures cover partial-met assumes
  20. Makefile Help Text No Conditional Env Var Names — help comments don't hardcode optional env vars
  21. Stack File Packages Prose-Frontmatter Sync — packages in prose match frontmatter
  22. Bootstrap Payment-Database Dependency — bootstrap validates payment requires database
  23. Testing CI Template Payment Env Vars — testing CI template includes payment env vars when ci.yml does
  24. Testing No-Auth Fallback CI Template — testing stack no-auth fallback includes CI job template
  25. Change Test Type Testing Stack Addition — change skill Test type permits adding testing to experiment.yaml stack
  26. Testing Env Frontmatter Assumes Dependency — testing stack env frontmatter excludes assumes-dependent vars
  27. Auth Template Post-Auth Redirects — auth page templates contain router.push/redirect after auth success
  28. Change Assumes Validation Matches Bootstrap — change skill value-matches assumes, not just category-exists
  29. Change Payment Validation Before Plan Phase — payment dependency checks appear before plan phase
  30. Analytics Dashboard Navigation Section — analytics stack files include Dashboard Navigation
  31. Change Testing Assumes Revalidation — change skill revalidates testing assumes for all change types
  32. Analytics Test Blocking Section — analytics stack files include Test Blocking
  33. Skill Prose Phantom Event Names — backtick-wrapped event names in skill prose exist in experiment/EVENTS.yaml
  34. Stack Files Conditional Files Frontmatter — fallback stacks annotate conditional files in frontmatter
  35. No-Auth CI Template Database Env Vars — no-auth CI template includes database placeholder env vars if full-auth template does
  36. (removed)
  37. Change Classification Before Dependent Checks — classification step precedes classification-dependent checks
  38. Ads.yaml Schema Validation — channel-aware required keys, creative constraints, budget limits
  39. Ads.yaml Campaign Name Matches experiment.yaml Name — campaign_name starts with experiment.name
  40. Distribute Skill Prose Event Names — distribute.md contains feedback_submitted event definition
  41. Distribution Docs References Exist — docs/*.md files referenced in distribute.md or distribution stack files exist
  42. Distribute Skill Validates Analytics Stack — distribute.md preconditions validate stack.analytics
  43. Distribute Skill Validates experiment/EVENTS.yaml events Structure — distribute.md preconditions validate events is a dict
  44. Bootstrap Skill Validates Variants — bootstrap.md Step 3 contains variant validation logic
  45. visit_landing Has Variant Property — experiment/EVENTS.yaml visit_landing event includes variant property
  46. Iterate Skill Experiment Verdict — iterate.md contains verdict/GO/NO-GO with pace logic
  47. Deploy Dashboard Setup — deploy.md contains analytics dashboard and scheduled digest setup
  48. Iterate Next Check-in — iterate.md contains Next Check-in schedule section
  49. Bootstrap Email-Auth-Database Dependency — bootstrap validates email requires auth and database
  50. Change Email-Auth-Database Dependency — change validates email requires auth and database
  51. trackServerEvent Signature — trackServerEvent calls pass string as distinctId, not object
  52. trackServerEvent Awaited — trackServerEvent calls are awaited in stack file code blocks
  53. Supabase Delete Flag Syntax — supabase projects delete uses --project-ref flag
  59. Framework-Archetype Compatibility — bootstrap and change validate framework matches archetype
"""

import glob
import json
import os
import re
import sys

import yaml

ERRORS: list[str] = []


def read_skill_with_states(skill_path: str) -> str:
    """Read a skill file and append content from its state files if they exist.

    When skills are decomposed into state files (e.g., .claude/patterns/bootstrap/state-*.md),
    the semantic checks need to search both the orchestrator and the state files.
    """
    content = ""
    if os.path.isfile(skill_path):
        with open(skill_path) as f:
            content = f.read()
    # Derive skill name from path: .claude/commands/<skill>.md -> <skill>
    skill_name = os.path.splitext(os.path.basename(skill_path))[0]
    state_dir = f".claude/patterns/{skill_name}"
    if os.path.isdir(state_dir):
        # Sort numerically by state number (state-0, state-1, ..., state-10, state-11)
        # not alphabetically (which would put state-10 before state-2)
        state_files = glob.glob(f"{state_dir}/state-*.md")
        def state_sort_key(path: str) -> tuple:
            name = os.path.basename(path)
            # Extract the state ID between "state-" and the next "-"
            parts = name.replace("state-", "", 1).split("-", 1)
            state_id = parts[0]
            try:
                return (0, int(state_id), name)
            except ValueError:
                return (1, 0, name)  # Non-numeric (3a, 3b) sort after numeric
        for state_file in sorted(state_files, key=state_sort_key):
            with open(state_file) as f:
                content += "\n" + f.read()
    return content


def error(msg: str) -> None:
    ERRORS.append(msg)
    print(f"FAIL: {msg}", file=sys.stderr)


def parse_frontmatter(filepath: str) -> dict | None:
    """Extract YAML frontmatter from a markdown file."""
    with open(filepath) as f:
        content = f.read()
    m = re.match(r"^---\n(.*?\n)---", content, re.DOTALL)
    if not m:
        return None
    return yaml.safe_load(m.group(1))


def extract_code_blocks(content: str, lang_filter: set[str] | None = None) -> list[dict]:
    """Extract fenced code blocks from markdown content.

    Returns list of dicts with keys: lang, code, start_line.
    If lang_filter is provided, only blocks with matching language tags are returned.
    """
    blocks = []
    pattern = re.compile(r"^```(\w+)?\s*\n(.*?)^```", re.MULTILINE | re.DOTALL)
    for m in pattern.finditer(content):
        lang = m.group(1) or ""
        if lang_filter and lang not in lang_filter:
            continue
        start_line = content[: m.start()].count("\n") + 1
        blocks.append({"lang": lang, "code": m.group(2), "start_line": start_line})
    return blocks


def extract_prose(content: str) -> str:
    """Extract text outside of fenced code blocks."""
    return re.sub(r"```\w*\s*\n.*?```", "", content, flags=re.MULTILINE | re.DOTALL)


# ---------------------------------------------------------------------------
# Extracted check functions — importable and unit-testable
# Each receives parsed data (not file paths) and returns a list of error strings.
# ---------------------------------------------------------------------------

BUILTIN_COMPONENTS = {"Fragment", "Suspense", "StrictMode"}


def check_1_import_completeness(stack_contents: dict[str, str]) -> list[str]:
    """Check 1: JSX components used in code blocks have matching imports."""
    errors: list[str] = []
    for sf, content in stack_contents.items():
        blocks = extract_code_blocks(content, {"tsx", "jsx"})
        for block in blocks:
            code = block["code"]
            used_components = set(re.findall(r"<([A-Z][a-zA-Z]+)", code))
            used_components -= BUILTIN_COMPONENTS

            imported: set[str] = set()
            for m in re.finditer(
                r"import\s+(?:type\s+)?(?:\{([^}]+)\}|(\w+))\s+from", code
            ):
                if m.group(1):
                    for name in m.group(1).split(","):
                        name = name.strip()
                        if " as " in name:
                            name = name.split(" as ")[1].strip()
                        if name:
                            imported.add(name)
                if m.group(2):
                    imported.add(m.group(2))

            locally_defined: set[str] = set()
            for m in re.finditer(r"\bfunction\s+([A-Z][a-zA-Z]+)\s*\(", code):
                locally_defined.add(m.group(1))
            for m in re.finditer(r"\b(?:const|let)\s+([A-Z][a-zA-Z]+)\s*=", code):
                locally_defined.add(m.group(1))

            missing = used_components - imported - locally_defined
            for comp in sorted(missing):
                errors.append(
                    f"[1] {sf}:{block['start_line']}: JSX component <{comp}> used but "
                    f"not imported in code block"
                )
    return errors


def check_3_fixture_validation(
    fixture_files: list[str],
    fixture_data: dict[str, dict],
    get_required_fields_fn,
) -> tuple[list[str], dict[str, str]]:
    """Check 3: Fixture files are structurally correct.

    Args:
        fixture_files: list of fixture file paths
        fixture_data: mapping of filepath -> parsed YAML dict
        get_required_fields_fn: callable(type) -> list[str] for required experiment fields

    Returns:
        (errors, fixture_type_map) where fixture_type_map maps filepath -> archetype type
    """
    errors: list[str] = []
    fixture_type_map: dict[str, str] = {}

    if not fixture_files:
        errors.append(f"[3] tests/fixtures: no fixture files found")
        return errors, fixture_type_map

    for ff in fixture_files:
        fixture = fixture_data.get(ff)
        if fixture is None:
            continue  # YAML parse errors handled upstream
        if not isinstance(fixture, dict):
            errors.append(f"[3] {ff}: fixture must be a YAML mapping")
            continue

        for key in ["experiment", "events", "assertions"]:
            if key not in fixture:
                errors.append(f"[3] {ff}: missing required key '{key}'")

        experiment = fixture.get("experiment", {})
        if not isinstance(experiment, dict):
            errors.append(f"[3] {ff}: 'experiment' must be a mapping")
            continue

        name = experiment.get("name", "")
        if not re.match(r"^[a-z][a-z0-9-]*$", str(name)):
            errors.append(
                f"[3] {ff}: experiment.name '{name}' must be lowercase, start with "
                f"a letter, and use only a-z, 0-9, hyphens"
            )

        fixture_type = experiment.get("type", "web-app")
        fixture_type_map[ff] = fixture_type
        fixture_required = get_required_fields_fn(fixture_type)

        for field in fixture_required:
            if not experiment.get(field):
                errors.append(f"[3] {ff}: experiment.{field} is missing or empty")

        if "pages" in fixture_required:
            pages = experiment.get("pages", [])
            if isinstance(pages, list):
                has_landing = any(
                    isinstance(p, dict) and p.get("name") == "landing" for p in pages
                )
                if not has_landing:
                    errors.append(f"[3] {ff}: experiment.pages must include a 'landing' entry")
        else:
            pages = []

        assertions = fixture.get("assertions", {})
        if isinstance(assertions, dict):
            stack = experiment.get("stack", {})
            has_payment = "payment" in stack if isinstance(stack, dict) else False
            payment_required = assertions.get("payment_events_required", False)
            if payment_required and not has_payment:
                errors.append(
                    f"[3] {ff}: assertions.payment_events_required is true but "
                    f"experiment.stack has no payment entry"
                )

            skippable = assertions.get("skippable_events", [])
            if "pages" in fixture_required:
                has_signup = False
                if isinstance(pages, list):
                    has_signup = any(
                        isinstance(p, dict) and p.get("name") == "signup"
                        for p in pages
                    )
                if not has_signup:
                    for ev in ["signup_start", "signup_complete"]:
                        if ev not in skippable:
                            errors.append(
                                f"[3] {ff}: no signup page but '{ev}' not in "
                                f"assertions.skippable_events"
                            )
            else:
                fixture_stack = experiment.get("stack", {})
                effective_surface = fixture_stack.get("surface")
                if effective_surface is None:
                    effective_surface = "co-located" if "hosting" in fixture_stack else "detached"
                non_webapp_skippable = ["signup_start", "signup_complete"]
                if effective_surface == "none":
                    non_webapp_skippable.append("visit_landing")
                for ev in non_webapp_skippable:
                    if ev not in skippable:
                        errors.append(
                            f"[3] {ff}: {fixture_type} type but '{ev}' not in "
                            f"assertions.skippable_events"
                        )

            min_pages = assertions.get("min_pages")
            if min_pages is not None and isinstance(pages, list):
                if len(pages) < min_pages:
                    errors.append(
                        f"[3] {ff}: experiment has {len(pages)} page(s) but "
                        f"assertions.min_pages is {min_pages}"
                    )

            endpoints = experiment.get("endpoints", [])
            min_endpoints = assertions.get("min_endpoints")
            if min_endpoints is not None and isinstance(endpoints, list):
                if len(endpoints) < min_endpoints:
                    errors.append(
                        f"[3] {ff}: experiment has {len(endpoints)} endpoint(s) but "
                        f"assertions.min_endpoints is {min_endpoints}"
                    )

            commands = experiment.get("commands", [])
            min_commands = assertions.get("min_commands")
            if min_commands is not None and isinstance(commands, list):
                if len(commands) < min_commands:
                    errors.append(
                        f"[3] {ff}: experiment has {len(commands)} command(s) but "
                        f"assertions.min_commands is {min_commands}"
                    )

            experiment_variants = experiment.get("variants")
            has_variants_assertion = assertions.get("has_variants")
            variant_count_assertion = assertions.get("variant_count")

            if experiment_variants is not None:
                if not isinstance(experiment_variants, list):
                    errors.append(f"[3] {ff}: experiment.variants must be a list")
                elif len(experiment_variants) < 2:
                    errors.append(f"[3] {ff}: experiment.variants must have at least 2 entries")
                else:
                    variant_slugs_seen: set[str] = set()
                    for vi, vv in enumerate(experiment_variants):
                        if not isinstance(vv, dict):
                            errors.append(f"[3] {ff}: experiment.variants[{vi}] must be a mapping")
                            continue
                        for vfield in ["slug", "headline", "subheadline", "cta", "pain_points"]:
                            if not vv.get(vfield):
                                errors.append(
                                    f"[3] {ff}: experiment.variants[{vi}].{vfield} is missing or empty"
                                )
                        vslug = vv.get("slug", "")
                        if vslug in variant_slugs_seen:
                            errors.append(f"[3] {ff}: duplicate variant slug: {vslug}")
                        variant_slugs_seen.add(vslug)
                        vpp = vv.get("pain_points", [])
                        if isinstance(vpp, list) and len(vpp) != 3:
                            errors.append(
                                f"[3] {ff}: experiment.variants[{vi}].pain_points must have exactly 3 items"
                            )

                if has_variants_assertion is not None and not has_variants_assertion:
                    errors.append(
                        f"[3] {ff}: experiment has variants but assertions.has_variants is false"
                    )
                if (
                    variant_count_assertion is not None
                    and isinstance(experiment_variants, list)
                    and len(experiment_variants) != variant_count_assertion
                ):
                    errors.append(
                        f"[3] {ff}: experiment has {len(experiment_variants)} variant(s) but "
                        f"assertions.variant_count is {variant_count_assertion}"
                    )
            else:
                if has_variants_assertion:
                    errors.append(
                        f"[3] {ff}: assertions.has_variants is true but experiment has no variants field"
                    )

        events = fixture.get("events", {})
        if isinstance(events, dict):
            if not has_payment:
                for ename, edef in events.items():
                    if isinstance(edef, dict) and "payment" in (edef.get("requires") or []):
                        errors.append(
                            f"[3] {ff}: events.{ename} has requires: [payment] but "
                            f"experiment.stack has no payment entry"
                        )

    return errors, fixture_type_map


def check_4_frontmatter_content_sync(
    stack_files: list[str],
    stack_contents: dict[str, str],
    makefile_content: str | None,
) -> list[str]:
    """Check 4: Code block headers match frontmatter files; Makefile clean matches clean frontmatter."""
    errors: list[str] = []

    # 4a: Code block section headers
    for sf in stack_files:
        content = stack_contents.get(sf, "")
        fm = parse_frontmatter_from_content(content)
        if not fm:
            continue
        fm_files = set(fm.get("files", []) or [])
        header_paths = set(re.findall(r"###\s+`([^`]+)`", content))
        for path in sorted(header_paths):
            if path not in fm_files:
                errors.append(
                    f"[4] {sf}: code block header path '{path}' not listed in frontmatter 'files'"
                )

    # 4b: Makefile clean lines
    if makefile_content:
        clean_match = re.search(
            r"^clean:.*?\n((?:\t.*\n)*)", makefile_content, re.MULTILINE
        )
        if clean_match:
            clean_recipe = clean_match.group(1)
            makefile_clean_items: dict[str, set[str]] = {}
            for line in clean_recipe.splitlines():
                line_s = line.strip()
                if not line_s:
                    continue
                tag_match = re.search(r"#\s+(\w+/\w+)\s*$", line_s)
                if not tag_match:
                    continue
                tag = tag_match.group(1)
                line_body = line_s[: tag_match.start()].strip()
                rm_match = re.match(r"rm\s+(?:-rf|-f)\s+(.*)", line_body)
                if rm_match:
                    items = rm_match.group(1).split()
                    makefile_clean_items.setdefault(tag, set()).update(items)

            for sf in stack_files:
                content = stack_contents.get(sf, "")
                fm = parse_frontmatter_from_content(content)
                if not fm or "clean" not in fm:
                    continue
                cat_val = sf.replace(".claude/stacks/", "").replace(".md", "")
                clean_fm = fm.get("clean", {}) or {}
                fm_clean_files = set(clean_fm.get("files", []) or [])
                fm_clean_dirs = set(clean_fm.get("dirs", []) or [])
                fm_all = fm_clean_files | fm_clean_dirs
                if not fm_all:
                    continue
                if cat_val not in makefile_clean_items:
                    errors.append(
                        f"[4] {sf}: clean frontmatter has entries but no "
                        f"Makefile clean line tagged '# {cat_val}'"
                    )
                    continue
                mk_items = makefile_clean_items[cat_val]
                for item in sorted(fm_all - mk_items):
                    errors.append(
                        f"[4] {sf}: clean item '{item}' not in Makefile clean target (# {cat_val})"
                    )
                for item in sorted(mk_items - fm_all):
                    errors.append(
                        f"[4] Makefile clean (# {cat_val}): item '{item}' not in "
                        f"{sf} clean frontmatter"
                    )
    return errors


def parse_frontmatter_from_content(content: str) -> dict | None:
    """Extract YAML frontmatter from markdown content string."""
    m = re.match(r"^---\n(.*?\n)---", content, re.DOTALL)
    if not m:
        return None
    return yaml.safe_load(m.group(1))


def check_5_conditional_dependency_refs(skill_contents: dict[str, str]) -> list[str]:
    """Check 5: References to optional stack categories have conditional guards."""
    errors: list[str] = []
    optional_categories = {"database", "auth", "payment", "email", "testing"}
    for sf, content in skill_contents.items():
        prose = extract_prose(content)
        for m in re.finditer(r"from the (\w+) stack file", prose):
            category = m.group(1)
            if category not in optional_categories:
                continue
            start = max(0, m.start() - 150)
            context_before = prose[start : m.start()]
            has_guard = bool(
                re.search(
                    rf"(?i)(?:if\s+.*(?:stack\.{category}|`stack\.{category}`)|"
                    rf"if\b.*\b{category}\b.*\bpresent\b)",
                    context_before,
                    re.DOTALL,
                )
            )
            if not has_guard:
                match_text = m.group(0)
                pos = content.find(match_text)
                line_num = content[:pos].count("\n") + 1 if pos >= 0 else "?"
                errors.append(
                    f"[5] {sf}:{line_num}: reference to optional '{category}' "
                    f"stack file lacks conditional guard within 150 chars"
                )
    return errors


def check_7_fixture_stack_coverage(
    fixture_files: list[str],
    fixture_data: dict[str, dict],
    stack_files: list[str],
    fixture_type_map: dict[str, str],
    bootstrap_content: str | None,
) -> list[str]:
    """Check 7: Every stack file is covered by at least one fixture."""
    errors: list[str] = []

    stack_pairs = set()
    for sf in stack_files:
        pair = sf.replace(".claude/stacks/", "").replace(".md", "")
        if pair.startswith("distribution/"):
            continue
        stack_pairs.add(pair)

    fixture_stack_coverage: dict[str, set[str]] = {}
    all_fixture_stacks: set[str] = set()

    for ff in fixture_files:
        fixture = fixture_data.get(ff, {})
        if not isinstance(fixture, dict):
            continue
        experiment = fixture.get("experiment", {})
        stack = experiment.get("stack", {})
        if isinstance(stack, dict):
            pairs = {f"{k}/{v}" for k, v in stack.items()}
            fixture_stack_coverage[ff] = pairs
            all_fixture_stacks |= pairs

    for pair in sorted(stack_pairs):
        if pair not in all_fixture_stacks:
            errors.append(
                f"[7] Stack file .claude/stacks/{pair}.md has no "
                f"fixture coverage in tests/fixtures/"
            )

    if bootstrap_content:
        always_match = re.search(
            r"always:\s*([^;)]+?)(?:\)|;|$)", bootstrap_content
        )
        if always_match:
            mandatory_cats = [
                c.strip().rstrip(",")
                for c in always_match.group(1).split(",")
                if c.strip()
            ]
            for ff, pairs in fixture_stack_coverage.items():
                fixture_cats = {p.split("/")[0] for p in pairs}
                ft = fixture_type_map.get(ff, "web-app")
                excluded: set[str] = set()
                arch_path = f".claude/archetypes/{ft}.md"
                if os.path.isfile(arch_path):
                    afm = parse_frontmatter(arch_path)
                    if afm:
                        excluded = set(afm.get("excluded_stacks", []))
                for cat in mandatory_cats:
                    if cat in excluded:
                        continue
                    if cat not in fixture_cats:
                        errors.append(
                            f"[7] {ff}: missing mandatory stack category "
                            f"'{cat}' (must be in all fixtures)"
                        )
    return errors


def check_11_hardcoded_provider_names(stack_contents: dict[str, str]) -> list[str]:
    """Check 11: Code blocks using provider identifiers must have matching assumes."""
    errors: list[str] = []
    provider_identifiers: dict[str, str] = {
        "posthog": "analytics/posthog",
        "amplitude": "analytics/amplitude",
        "segment": "analytics/segment",
        "stripe": "payment/stripe",
    }
    for sf, content in stack_contents.items():
        fm = parse_frontmatter_from_content(content)
        if not fm:
            continue
        assumes = set(fm.get("assumes", []) or [])
        blocks = extract_code_blocks(content, {"ts", "tsx", "js", "jsx"})
        for block in blocks:
            code_lower = block["code"].lower()
            for identifier, category_value in provider_identifiers.items():
                if identifier in code_lower:
                    cat_val = sf.replace(".claude/stacks/", "").replace(".md", "")
                    if cat_val == category_value:
                        continue
                    if category_value not in assumes:
                        errors.append(
                            f"[11] {sf}:{block['start_line']}: code block uses "
                            f"'{identifier}' but '{category_value}' not in assumes frontmatter"
                        )
                        break
    return errors


def check_16_change_payment_auth(change_content: str, change_path: str) -> list[str]:
    """Check 16: change.md validates payment requires auth."""
    errors: list[str] = []
    change_prose = extract_prose(change_content)
    has_payment_ref = bool(
        re.search(r"(?i)adding\s+.*payment|payment.*stack", change_prose)
    )
    if has_payment_ref:
        has_auth_check = bool(
            re.search(
                r"(?i)payment.*auth.*present|auth.*present.*payment|"
                r"payment\s+requires\s+auth",
                change_prose,
            )
        )
        if not has_auth_check:
            errors.append(
                f"[16] {change_path}: mentions adding payment stack "
                f"category without a preceding auth-presence validation"
            )
    return errors


def check_17_env_vars_prose_frontmatter_sync(stack_contents: dict[str, str]) -> list[str]:
    """Check 17: Env vars in prose match frontmatter declarations."""
    errors: list[str] = []
    env_var_pattern = re.compile(
        r"`?(NEXT_PUBLIC_[A-Z_]+|[A-Z][A-Z_]{3,}(?:_KEY|_URL|_ID|_SECRET|_TOKEN|_ANON_KEY|_ROLE_KEY))`?"
    )
    for sf, content in stack_contents.items():
        fm = parse_frontmatter_from_content(content)
        if not fm:
            continue
        env_section = fm.get("env", {}) or {}
        fm_server = set(env_section.get("server", []) or [])
        fm_client = set(env_section.get("client", []) or [])
        fm_all_env = fm_server | fm_client

        env_section_match = re.search(
            r"##\s+Environment Variables\s*\n(.*?)(?=\n##\s|\Z)",
            content,
            re.DOTALL,
        )
        if not env_section_match:
            continue

        env_prose = env_section_match.group(1)
        env_prose_no_code = re.sub(r"```.*?```", "", env_prose, flags=re.DOTALL)
        prose_env_vars: set[str] = set()
        for m in env_var_pattern.finditer(env_prose_no_code):
            var_name = m.group(1) or m.group(0).strip("`")
            prose_env_vars.add(var_name)

        for var in sorted(prose_env_vars - fm_all_env):
            line_num = content[: env_section_match.start()].count("\n") + 1
            errors.append(
                f"[17] {sf}:{line_num}: Environment Variables prose mentions "
                f"'{var}' but it's not in frontmatter env.server or env.client"
            )
    return errors


def check_18_change_payment_database(change_content: str, change_path: str) -> list[str]:
    """Check 18: change.md Feature constraints validate payment requires database."""
    errors: list[str] = []
    # Search Feature constraints section
    feature_constraints_match = re.search(
        r"(?i)####?\s+Feature constraints\s*\n(.*?)(?=\n####?\s|\Z)",
        change_content,
        re.DOTALL,
    )
    # Also search preconditions section (payment validation may be there)
    preconditions_match = re.search(
        r"(?i)(?:## Step \d+:.*?preconditions|# STATE \d+:\s*CHECK_PRECONDITIONS)\s*\n(.*?)(?=\n## Step \d|\n## Phase|\n# STATE|\Z)",
        change_content,
        re.DOTALL,
    )
    search_text = ""
    if feature_constraints_match:
        search_text += feature_constraints_match.group(1)
    if preconditions_match:
        search_text += "\n" + preconditions_match.group(1)

    if search_text:
        has_db_check = bool(
            re.search(
                r"(?i)payment.*database.*present|database.*present.*payment|"
                r"payment\s+requires.*database|"
                r"stack\.database.*(?:missing|present|also)|"
                r"both.*stack\.auth.*stack\.database",
                search_text,
            )
        )
        if not has_db_check:
            errors.append(
                f"[18] {change_path}: Feature constraints section "
                f"doesn't validate that `payment` in the stack requires "
                f"`database` to also be present"
            )
    return errors


def check_21_packages_prose_frontmatter_sync(stack_contents: dict[str, str]) -> list[str]:
    """Check 21: Packages in prose match frontmatter declarations."""
    errors: list[str] = []
    package_install_pattern = re.compile(r"^npm install\s+(.+)$", re.MULTILINE)

    for sf, content in stack_contents.items():
        fm = parse_frontmatter_from_content(content)
        if not fm:
            continue
        pkg_section = fm.get("packages", {}) or {}
        fm_runtime = set(pkg_section.get("runtime", []) or [])
        fm_dev = set(pkg_section.get("dev", []) or [])
        fm_all_packages = fm_runtime | fm_dev

        pkg_section_match = re.search(
            r"##\s+Packages\s*\n(.*?)(?=\n##\s|\Z)",
            content,
            re.DOTALL,
        )
        if not pkg_section_match:
            continue

        pkg_prose = pkg_section_match.group(1)
        code_blocks_in_section = re.findall(
            r"```(?:bash|sh)\s*\n(.*?)```", pkg_prose, re.DOTALL
        )
        prose_packages: set[str] = set()
        for code_block in code_blocks_in_section:
            for m in package_install_pattern.finditer(code_block):
                tokens = m.group(1).strip().split()
                pkgs = [t for t in tokens if not t.startswith("-")]
                prose_packages.update(pkgs)

        for pkg in sorted(prose_packages - fm_all_packages):
            line_num = content[: pkg_section_match.start()].count("\n") + 1
            errors.append(
                f"[21] {sf}:{line_num}: Packages prose contains 'npm install {pkg}' "
                f"but '{pkg}' is not in frontmatter packages.runtime or packages.dev"
            )
    return errors


def check_33_phantom_event_names(
    skill_contents: dict[str, str],
    defined_events: set[str],
    global_props: set[str],
    event_props: set[str],
) -> list[str]:
    """Check 33: Backtick-wrapped event names in skill prose exist in experiment/EVENTS.yaml."""
    errors: list[str] = []
    skip_tokens = {
        "stack", "testing", "payment", "analytics", "database",
        "auth", "posthog", "supabase", "stripe", "nextjs",
        "funnel_stage", "events",
        "object_action", "track", "event_name",
        "name", "title", "owner", "problem", "solution",
        "target_user", "distribution", "thesis",
        "description", "behaviors",
        "page_name", "feature", "features", "pages", "variants",
    }

    for sf, content in skill_contents.items():
        prose = extract_prose(content)

        skill_defined_events: set[str] = set()
        skill_defined_props: set[str] = set()
        for yblock in extract_code_blocks(content, {"yaml"}):
            try:
                ydata = yaml.safe_load(yblock["code"])
            except yaml.YAMLError:
                continue
            event_items: list[dict] = []
            if isinstance(ydata, list):
                event_items = [item for item in ydata if isinstance(item, dict)]
            elif isinstance(ydata, dict):
                if "event" in ydata:
                    event_items = [ydata]
                elif "funnel_stage" in ydata:
                    # Single event definition in new flat format
                    event_items = [ydata]
                else:
                    # Flat events map: each value is an event definition
                    for key, val in ydata.items():
                        if isinstance(val, dict) and ("trigger" in val or "funnel_stage" in val):
                            edef = dict(val)
                            edef["event"] = key
                            event_items.append(edef)
            for item in event_items:
                if "event" in item:
                    skill_defined_events.add(item["event"])
                    for prop_name in (item.get("properties", {}) or {}).keys():
                        skill_defined_props.add(prop_name)

        for m in re.finditer(r"`([a-z][a-z0-9_]+)`", prose):
            token = m.group(1)
            if "/" in token or "." in token:
                continue
            start = max(0, m.start() - 100)
            end = min(len(prose), m.end() + 100)
            context = prose[start:end].lower()
            if not re.search(r"\bevent\b|\bfire\b", context):
                continue
            if token in defined_events:
                continue
            if token in global_props:
                continue
            if token in event_props:
                continue
            if token in skill_defined_events or token in skill_defined_props:
                continue
            context_before = prose[start:m.start()].lower()
            if re.search(r"(?:from|in)\s+events\.yaml", context_before):
                continue
            if re.search(r"events\.yaml", context.lower()):
                continue
            if token in skip_tokens:
                continue
            pos = content.find(f"`{token}`")
            line_num = content[:pos].count("\n") + 1 if pos >= 0 else "?"
            errors.append(
                f"[33] {sf}:{line_num}: prose references event name "
                f"'{token}' near event/fire context, but it is not "
                f"defined in experiment/EVENTS.yaml"
            )
    return errors


def check_38_ads_yaml_schema(ads_data: dict, ads_path: str) -> list[str]:
    """Check 38: Ads.yaml has valid schema."""
    errors: list[str] = []
    ads_channel = ads_data.get("channel", "google-ads")

    ads_universal_keys = [
        "campaign_name", "project_name", "landing_url",
        "budget", "targeting", "conversions", "guardrails", "thresholds",
    ]
    for key in ads_universal_keys:
        if key not in ads_data:
            errors.append(f"[38] {ads_path}: missing required key '{key}'")

    if ads_channel == "google-ads":
        for key in ("keywords", "ads"):
            if key not in ads_data:
                errors.append(f"[38] {ads_path}: missing required key '{key}' (channel: google-ads)")

        kw = ads_data.get("keywords", {})
        if isinstance(kw, dict):
            if len(kw.get("exact", []) or []) < 3:
                errors.append(f"[38] {ads_path}: keywords.exact needs at least 3 entries")
            if len(kw.get("phrase", []) or []) < 2:
                errors.append(f"[38] {ads_path}: keywords.phrase needs at least 2 entries")
            if len(kw.get("broad", []) or []) < 1:
                errors.append(f"[38] {ads_path}: keywords.broad needs at least 1 entry")
            if len(kw.get("negative", []) or []) < 2:
                errors.append(f"[38] {ads_path}: keywords.negative needs at least 2 entries")

        ads_list = ads_data.get("ads", [])
        if isinstance(ads_list, list):
            if len(ads_list) < 2:
                errors.append(f"[38] {ads_path}: ads needs at least 2 variations")
            for i, ad in enumerate(ads_list):
                if isinstance(ad, dict):
                    headlines = ad.get("headlines", []) or []
                    descriptions = ad.get("descriptions", []) or []
                    if len(headlines) < 5:
                        errors.append(f"[38] {ads_path}: ads[{i}] needs at least 5 headlines")
                    if len(descriptions) < 2:
                        errors.append(f"[38] {ads_path}: ads[{i}] needs at least 2 descriptions")

    elif ads_channel == "twitter":
        if "tweets" not in ads_data:
            errors.append(f"[38] {ads_path}: missing required key 'tweets' (channel: twitter)")
        tweets = ads_data.get("tweets", [])
        if isinstance(tweets, list):
            if len(tweets) < 2:
                errors.append(f"[38] {ads_path}: tweets needs at least 2 variations")
            for i, tw in enumerate(tweets):
                if isinstance(tw, dict):
                    text = tw.get("text", "")
                    if len(text) > 280:
                        errors.append(f"[38] {ads_path}: tweets[{i}] text exceeds 280 chars")

    elif ads_channel == "reddit":
        if "posts" not in ads_data:
            errors.append(f"[38] {ads_path}: missing required key 'posts' (channel: reddit)")
        posts = ads_data.get("posts", [])
        if isinstance(posts, list):
            if len(posts) < 2:
                errors.append(f"[38] {ads_path}: posts needs at least 2 variations")
            for i, post in enumerate(posts):
                if isinstance(post, dict):
                    headline = post.get("headline", "")
                    if len(headline) > 300:
                        errors.append(f"[38] {ads_path}: posts[{i}] headline exceeds 300 chars")

    budget = ads_data.get("budget", {})
    if isinstance(budget, dict):
        total = budget.get("total_budget_cents", 0) or 0
        if total > 50000:
            errors.append(
                f"[38] {ads_path}: budget.total_budget_cents ({total}) exceeds max 50000 ($500)"
            )

    guardrails = ads_data.get("guardrails", {})
    if isinstance(guardrails, dict):
        if ads_channel == "google-ads":
            max_cpc = guardrails.get("max_cpc_cents")
            if max_cpc is None:
                errors.append(f"[38] {ads_path}: missing guardrails.max_cpc_cents")
            elif not isinstance(max_cpc, int) or max_cpc <= 0:
                errors.append(
                    f"[38] {ads_path}: guardrails.max_cpc_cents must be an integer > 0 (got {max_cpc!r})"
                )

    thresholds = ads_data.get("thresholds", {})
    if isinstance(thresholds, dict):
        exp_act = thresholds.get("expected_activations")
        if exp_act is None:
            errors.append(f"[38] {ads_path}: missing thresholds.expected_activations")
        elif not isinstance(exp_act, int) or exp_act < 0:
            errors.append(
                f"[38] {ads_path}: thresholds.expected_activations must be an integer >= 0 (got {exp_act!r})"
            )
        go_signal = thresholds.get("go_signal")
        if not go_signal or not isinstance(go_signal, str) or not go_signal.strip():
            errors.append(f"[38] {ads_path}: thresholds.go_signal must be a non-empty string")
        no_go_signal = thresholds.get("no_go_signal")
        if not no_go_signal or not isinstance(no_go_signal, str) or not no_go_signal.strip():
            errors.append(f"[38] {ads_path}: thresholds.no_go_signal must be a non-empty string")

    return errors


def check_39_ads_campaign_name(ads_data: dict, idea_data: dict, ads_path: str) -> list[str]:
    """Check 39: ads.yaml campaign_name matches experiment.yaml name."""
    errors: list[str] = []
    idea_name = idea_data.get("name", "")
    campaign_name = ads_data.get("campaign_name", "")
    if idea_name and campaign_name:
        if not str(campaign_name).startswith(str(idea_name)):
            errors.append(
                f"[39] {ads_path}: campaign_name '{campaign_name}' does not start with "
                f"experiment.yaml name '{idea_name}'"
            )
    return errors


def check_46_iterate_verdict(iterate_content: str) -> list[str]:
    """Check 46: iterate.md contains verdict/GO/NO-GO with pace logic."""
    errors: list[str] = []
    if not re.search(r"(?i)verdict", iterate_content):
        errors.append("[46] iterate.md: missing experiment verdict section")
    if not re.search(r"(?i)NO.GO", iterate_content):
        errors.append("[46] iterate.md: missing GO/NO-GO verdict terminology")
    if not re.search(r"(?i)pace", iterate_content):
        errors.append("[46] iterate.md: missing pace-based progress metric")
    return errors


def check_53_supabase_delete_flag(file_contents: dict[str, str]) -> list[str]:
    """Check 53: supabase projects delete uses --project-ref flag."""
    errors: list[str] = []
    for sf, content in file_contents.items():
        code_blocks = extract_code_blocks(content, {"bash", "sh"})
        for block in code_blocks:
            if "supabase projects delete" in block["code"]:
                if "--project-ref" not in block["code"]:
                    errors.append(
                        f"[53] {sf}: `supabase projects delete` without --project-ref flag "
                        f"near line {block['start_line']}"
                    )
    return errors


def check_54_procedure_production_branch(procedure_files: dict[str, str]) -> list[str]:
    """Check 54: Procedure files for Feature/Upgrade/Fix have production branches."""
    errors: list[str] = []
    target_procedures = {"change-feature.md", "change-upgrade.md", "change-fix.md"}
    for path, content in procedure_files.items():
        basename = os.path.basename(path)
        if basename not in target_procedures:
            continue
        if not re.search(r"quality:\s*production|quality.*production", content):
            errors.append(
                f"[54] {path}: procedure file missing production branch "
                f"(expected 'quality: production' or 'quality.*production')"
            )
    return errors


def check_55_production_references_tdd(procedure_files: dict[str, str]) -> list[str]:
    """Check 55: Production sections in procedure files reference TDD."""
    errors: list[str] = []
    target_procedures = {"change-feature.md", "change-upgrade.md", "change-fix.md"}
    for path, content in procedure_files.items():
        basename = os.path.basename(path)
        if basename not in target_procedures:
            continue
        # Find production sections (content after quality: production mention)
        prod_match = re.search(r"quality.*production", content, re.IGNORECASE)
        if not prod_match:
            continue
        prod_content = content[prod_match.start():]
        if not re.search(r"tdd\.md|patterns/tdd", prod_content):
            errors.append(
                f"[55] {path}: production section does not reference tdd.md"
            )
    return errors


def check_56_production_references_implementer(procedure_files: dict[str, str]) -> list[str]:
    """Check 56: Production sections reference implementer agent.

    Only checks feature and upgrade procedures — fix uses a simpler single-task
    TDD path (regression test + minimal fix) without implementer agents.
    """
    errors: list[str] = []
    target_procedures = {"change-feature.md", "change-upgrade.md"}
    for path, content in procedure_files.items():
        basename = os.path.basename(path)
        if basename not in target_procedures:
            continue
        prod_match = re.search(r"quality.*production", content, re.IGNORECASE)
        if not prod_match:
            continue
        prod_content = content[prod_match.start():]
        if not re.search(r"implementer\.md|agents/implementer|implementer agent", prod_content):
            errors.append(
                f"[56] {path}: production section does not reference implementer agent"
            )
    return errors


def check_57_change_production_precondition(change_content: str) -> list[str]:
    """Check 57: change.md production block validates stack.testing."""
    errors: list[str] = []
    # Find production quality block
    prod_match = re.search(r"quality.*production", change_content, re.IGNORECASE)
    if not prod_match:
        return errors  # No production block — check doesn't apply
    # Check that stack.testing is validated near the production block
    prod_context = change_content[max(0, prod_match.start() - 200):prod_match.end() + 500]
    if not re.search(r"stack\.testing", prod_context):
        errors.append(
            "[57] change.md: quality:production block does not validate stack.testing"
        )
    return errors


def check_58_agent_tool_consistency(agent_files: dict[str, str]) -> list[str]:
    """Check 58: Agent tool declarations are consistent with their roles."""
    errors: list[str] = []
    for path, content in agent_files.items():
        basename = os.path.basename(path)
        fm = parse_frontmatter_from_content(content)
        if not fm:
            continue
        tools = fm.get("tools", []) or []
        disallowed = fm.get("disallowedTools", []) or []

        if basename == "implementer.md":
            for required in ["Edit", "Write", "Bash"]:
                if required not in tools:
                    errors.append(
                        f"[58] {path}: implementer agent missing required tool '{required}'"
                    )

        if basename == "spec-reviewer.md":
            for forbidden in ["Edit", "Write"]:
                if forbidden in tools:
                    errors.append(
                        f"[58] {path}: spec-reviewer agent has write tool '{forbidden}' "
                        f"but should be read-only"
                    )
                if forbidden not in disallowed:
                    errors.append(
                        f"[58] {path}: spec-reviewer agent should disallow '{forbidden}'"
                    )
    return errors


def check_59_framework_archetype_compatibility(
    bootstrap_content: str, change_content: str
) -> list[str]:
    """Check 59: bootstrap.md and change.md validate framework-archetype compatibility."""
    errors: list[str] = []
    for label, content, path in [
        ("bootstrap.md", bootstrap_content, ".claude/commands/bootstrap.md"),
        ("change.md", change_content, ".claude/commands/change.md"),
    ]:
        # Must mention web-app requiring nextjs
        if not re.search(r"web-app.*requires.*nextjs|web-app.*nextjs", content, re.IGNORECASE):
            errors.append(
                f"[59] {path}: missing framework-archetype validation "
                f"(web-app requires nextjs)"
            )
        # Must mention cli requiring commander
        if not re.search(r"cli.*requires.*commander|cli.*commander", content, re.IGNORECASE):
            errors.append(
                f"[59] {path}: missing framework-archetype validation "
                f"(cli requires commander)"
            )
    return errors


def check_60_settings_hook_paths() -> list[str]:
    """Check 60: Every hook command path in settings.json must resolve to an existing file."""
    errors: list[str] = []
    settings_path = ".claude/settings.json"
    if not os.path.isfile(settings_path):
        return errors
    try:
        with open(settings_path) as f:
            settings = json.loads(f.read())
    except (json.JSONDecodeError, OSError):
        return errors
    hooks = settings.get("hooks", {})
    for _matcher, hook_list in hooks.items():
        if not isinstance(hook_list, list):
            continue
        for entry in hook_list:
            if not isinstance(entry, dict):
                continue
            hook_entries = entry.get("hooks", [entry])
            if not isinstance(hook_entries, list):
                hook_entries = [hook_entries]
            for hook in hook_entries:
                if not isinstance(hook, dict):
                    continue
                cmd = hook.get("command", "")
                # Normalize: strip quotes and replace $CLAUDE_PROJECT_DIR with .
                normalized = cmd.replace('"', "").replace("'", "")
                normalized = normalized.replace("$CLAUDE_PROJECT_DIR/", "")
                # Extract just the script path (first token)
                script_path = normalized.split()[0] if normalized.split() else ""
                if script_path and script_path.endswith(".sh"):
                    if not os.path.isfile(script_path):
                        errors.append(
                            f"[60] {settings_path}: hook path '{script_path}' "
                            f"does not resolve to an existing file"
                        )
    return errors


def check_61_footer_directive_sync() -> list[str]:
    """Check 61: Directive marker in agent-prompt-footer.md must match phase-transition-gate.sh grep."""
    errors: list[str] = []
    footer_path = ".claude/agent-prompt-footer.md"
    hook_path = ".claude/hooks/phase-transition-gate.sh"
    if not os.path.isfile(footer_path) or not os.path.isfile(hook_path):
        return errors
    with open(footer_path) as f:
        first_line = f.readline().strip()
    # Extract directive marker from HTML comment: <!-- DIRECTIVES:... -->
    marker = first_line
    if marker.startswith("<!--"):
        marker = marker[4:]
    if marker.endswith("-->"):
        marker = marker[:-3]
    marker = marker.strip()
    if not marker.startswith("DIRECTIVES:"):
        return errors
    with open(hook_path) as f:
        hook_content = f.read()
    if marker not in hook_content:
        errors.append(
            f"[61] {hook_path}: directive grep pattern does not match "
            f"agent-prompt-footer.md marker '{marker}'"
        )
    return errors


def main() -> int:
    """Run all semantic checks. Returns exit code (0=pass, 1=fail)."""
    global ERRORS
    ERRORS = []

    # ---------------------------------------------------------------------------
    # Collect files
    # ---------------------------------------------------------------------------

    stack_files = sorted(
        f
        for f in glob.glob(".claude/stacks/**/*.md", recursive=True)
        if "TEMPLATE" not in f
    )
    skill_files = sorted(glob.glob(".claude/commands/*.md"))

    # Pre-read all file contents
    stack_contents: dict[str, str] = {}
    for sf in stack_files:
        with open(sf) as f:
            stack_contents[sf] = f.read()

    skill_contents: dict[str, str] = {}
    for sf in skill_files:
        with open(sf) as f:
            skill_contents[sf] = f.read()

    # Required fields for experiment.yaml — used by Check 3 (fixtures) and Check 6 (consistency)
    BASE_REQUIRED_EXPERIMENT_FIELDS = [
        "name",
        "owner",
        "type",
        "description",
        "thesis",
        "target_user",
        "distribution",
        "behaviors",
        "stack",
    ]


    def get_required_experiment_fields(experiment_type: str | None = None) -> list[str]:
        """Return required experiment.yaml fields based on archetype type."""
        effective = experiment_type if experiment_type else "web-app"
        archetype_path = f".claude/archetypes/{effective}.md"
        extra = ["pages"]  # fallback if archetype file missing
        if os.path.isfile(archetype_path):
            fm = parse_frontmatter(archetype_path)
            if fm and "required_experiment_fields" in fm:
                extra = fm["required_experiment_fields"]
        return BASE_REQUIRED_EXPERIMENT_FIELDS + extra


    # Default for web-app — used by Check 6 (consistency with Makefile)
    REQUIRED_EXPERIMENT_FIELDS = get_required_experiment_fields("web-app")

    # ---------------------------------------------------------------------------
    # Check 1: Import Completeness in TSX Templates
    # ---------------------------------------------------------------------------

    for e in check_1_import_completeness(stack_contents):
        error(e)

    # ---------------------------------------------------------------------------
    # Check 2: Makefile Target Guards
    # ---------------------------------------------------------------------------

    makefile_path = "Makefile"
    if os.path.isfile(makefile_path):
        with open(makefile_path) as f:
            makefile_content = f.read()

        # Targets that don't need guards:
        # - Pre-bootstrap / meta: validate, clean, clean-all, help
        # - Post-bootstrap only: dev, deploy, test-e2e (user runs these after
        #   bootstrap; npm errors are self-explanatory in this context)
        EXEMPT_TARGETS = {
            "validate",
            "clean",
            "clean-all",
            "help",
            "test-e2e",
            "supabase-start",
            "supabase-stop",
        }

        # Parse Makefile targets and their recipe lines
        # A target line looks like: target-name: [deps] ## comment
        # Recipe lines follow, indented with a tab
        target_pattern = re.compile(r"^([a-zA-Z0-9_-]+)\s*:(?!=)", re.MULTILINE)
        targets = {}
        matches = list(target_pattern.finditer(makefile_content))
        for i, m in enumerate(matches):
            name = m.group(1)
            start = m.end()
            end = matches[i + 1].start() if i + 1 < len(matches) else len(makefile_content)
            recipe = makefile_content[start:end]
            targets[name] = recipe

        for target_name, recipe in targets.items():
            if target_name in EXEMPT_TARGETS:
                continue
            if target_name.startswith("."):
                continue

            # Check if this target uses npm or node commands
            uses_npm = bool(re.search(r"\bnpm\b|\bnpx\b|\bnode\b", recipe))
            if not uses_npm:
                continue

            # Check for a package.json guard
            has_guard = bool(
                re.search(r"if\s+\[.*package\.json", recipe)
                or re.search(r"test\s+-f\s+package\.json", recipe)
                or re.search(r"-f\s+package\.json", recipe)
                or re.search(r"-e\s+package\.json", recipe)
            )

            if not has_guard:
                line_num = makefile_content[
                    : makefile_content.index(f"{target_name}:")
                ].count("\n") + 1
                error(
                    f"[2] {makefile_path}:{line_num}: target '{target_name}' uses "
                    f"npm/node but has no package.json guard"
                )

    # ---------------------------------------------------------------------------
    # Check 3: Fixture Validation
    # ---------------------------------------------------------------------------

    fixture_dir = "tests/fixtures"
    fixture_type_map: dict[str, str] = {}
    if os.path.isdir(fixture_dir):
        fixture_files = sorted(glob.glob(os.path.join(fixture_dir, "*.yaml")))

        if not fixture_files:
            error(f"[3] {fixture_dir}: no fixture files found")

        for ff in fixture_files:
            with open(ff) as f:
                try:
                    fixture = yaml.safe_load(f)
                except yaml.YAMLError as e:
                    error(f"[3] {ff}: invalid YAML: {e}")
                    continue

            if not isinstance(fixture, dict):
                error(f"[3] {ff}: fixture must be a YAML mapping")
                continue

            # Check required top-level keys
            for key in ["experiment", "events", "assertions"]:
                if key not in fixture:
                    error(f"[3] {ff}: missing required key '{key}'")

            experiment = fixture.get("experiment", {})
            if not isinstance(experiment, dict):
                error(f"[3] {ff}: 'experiment' must be a mapping")
                continue

            # Validate experiment.name format
            name = experiment.get("name", "")
            if not re.match(r"^[a-z][a-z0-9-]*$", str(name)):
                error(
                    f"[3] {ff}: experiment.name '{name}' must be lowercase, start with "
                    f"a letter, and use only a-z, 0-9, hyphens"
                )

            # Resolve per-fixture archetype required fields
            fixture_type = experiment.get("type", "web-app")
            fixture_type_map[ff] = fixture_type
            fixture_required = get_required_experiment_fields(fixture_type)

            # Validate required experiment fields
            for field in fixture_required:
                if not experiment.get(field):
                    error(f"[3] {ff}: experiment.{field} is missing or empty")

            # Validate golden_path includes landing (only for archetypes requiring golden_path)
            if "golden_path" in fixture_required:
                golden_path = experiment.get("golden_path", [])
                if isinstance(golden_path, list):
                    has_landing = any(
                        isinstance(entry, dict) and entry.get("page") == "landing"
                        for entry in golden_path
                    )
                    if not has_landing:
                        error(f"[3] {ff}: experiment.golden_path must include a 'landing' entry")
                    # Derive pages from golden_path for downstream checks
                    pages = [
                        {"name": entry.get("page")}
                        for entry in golden_path
                        if isinstance(entry, dict) and entry.get("page")
                    ]
                    # Deduplicate by page name
                    seen_pages: set[str] = set()
                    unique_pages: list[dict] = []
                    for p in pages:
                        if p["name"] not in seen_pages:
                            seen_pages.add(p["name"])
                            unique_pages.append(p)
                    pages = unique_pages
                else:
                    pages = []
            elif "pages" in fixture_required:
                pages = experiment.get("pages", [])
                if isinstance(pages, list):
                    has_landing = any(
                        isinstance(p, dict) and p.get("name") == "landing" for p in pages
                    )
                    if not has_landing:
                        error(f"[3] {ff}: experiment.pages must include a 'landing' entry")
            else:
                pages = []  # no pages for service archetype

            # Validate assertions
            assertions = fixture.get("assertions", {})
            if isinstance(assertions, dict):
                # If no payment stack, events with requires: [payment] should not exist
                stack = experiment.get("stack", {})
                has_payment = "payment" in stack if isinstance(stack, dict) else False
                payment_required = assertions.get("payment_events_required", False)
                if payment_required and not has_payment:
                    error(
                        f"[3] {ff}: assertions.payment_events_required is true but "
                        f"experiment.stack has no payment entry"
                    )

                # Signup and landing event checks — archetype-aware
                skippable = assertions.get("skippable_events", [])
                if "golden_path" in fixture_required or "pages" in fixture_required:
                    # Web-app: if no signup page, signup events should be in skippable
                    has_signup = False
                    if isinstance(pages, list):
                        has_signup = any(
                            isinstance(p, dict) and p.get("name") == "signup"
                            for p in pages
                        )
                    if not has_signup:
                        for ev in ["signup_start", "signup_complete"]:
                            if ev not in skippable:
                                error(
                                    f"[3] {ff}: no signup page but '{ev}' not in "
                                    f"assertions.skippable_events"
                                )
                else:
                    # Non-web-app (service, cli, etc.): determine which events must be skippable
                    # visit_landing is skippable only when surface is none;
                    # when a surface is configured, visit_landing fires on the surface page
                    fixture_stack = experiment.get("stack", {})
                    effective_surface = fixture_stack.get("surface")
                    if effective_surface is None:
                        effective_surface = "co-located" if "hosting" in fixture_stack else "detached"
                    non_webapp_skippable = ["signup_start", "signup_complete"]
                    if effective_surface == "none":
                        non_webapp_skippable.append("visit_landing")
                    for ev in non_webapp_skippable:
                        if ev not in skippable:
                            error(
                                f"[3] {ff}: {fixture_type} type but '{ev}' not in "
                                f"assertions.skippable_events"
                            )

                # Validate min_pages matches actual page count
                min_pages = assertions.get("min_pages")
                if min_pages is not None and isinstance(pages, list):
                    if len(pages) < min_pages:
                        error(
                            f"[3] {ff}: experiment has {len(pages)} page(s) but "
                            f"assertions.min_pages is {min_pages}"
                        )

                # Validate min_endpoints matches actual endpoint count
                endpoints = experiment.get("endpoints", [])
                min_endpoints = assertions.get("min_endpoints")
                if min_endpoints is not None and isinstance(endpoints, list):
                    if len(endpoints) < min_endpoints:
                        error(
                            f"[3] {ff}: experiment has {len(endpoints)} endpoint(s) but "
                            f"assertions.min_endpoints is {min_endpoints}"
                        )

                # Validate min_commands matches actual command count
                commands = experiment.get("commands", [])
                min_commands = assertions.get("min_commands")
                if min_commands is not None and isinstance(commands, list):
                    if len(commands) < min_commands:
                        error(
                            f"[3] {ff}: experiment has {len(commands)} command(s) but "
                            f"assertions.min_commands is {min_commands}"
                        )

                # Validate variant assertions and structure
                experiment_variants = experiment.get("variants")
                has_variants_assertion = assertions.get("has_variants")
                variant_count_assertion = assertions.get("variant_count")

                if experiment_variants is not None:
                    # Fixture has variants — validate structure
                    if not isinstance(experiment_variants, list):
                        error(f"[3] {ff}: experiment.variants must be a list")
                    elif len(experiment_variants) < 2:
                        error(
                            f"[3] {ff}: experiment.variants must have at least 2 entries"
                        )
                    else:
                        variant_slugs_seen: set[str] = set()
                        for vi, vv in enumerate(experiment_variants):
                            if not isinstance(vv, dict):
                                error(
                                    f"[3] {ff}: experiment.variants[{vi}] must be a mapping"
                                )
                                continue
                            for vfield in [
                                "slug", "headline", "subheadline", "cta", "pain_points"
                            ]:
                                if not vv.get(vfield):
                                    error(
                                        f"[3] {ff}: experiment.variants[{vi}].{vfield} "
                                        f"is missing or empty"
                                    )
                            vslug = vv.get("slug", "")
                            if vslug in variant_slugs_seen:
                                error(
                                    f"[3] {ff}: duplicate variant slug: {vslug}"
                                )
                            variant_slugs_seen.add(vslug)
                            vpp = vv.get("pain_points", [])
                            if isinstance(vpp, list) and len(vpp) != 3:
                                error(
                                    f"[3] {ff}: experiment.variants[{vi}].pain_points "
                                    f"must have exactly 3 items"
                                )

                    # Validate has_variants assertion
                    if has_variants_assertion is not None and not has_variants_assertion:
                        error(
                            f"[3] {ff}: experiment has variants but "
                            f"assertions.has_variants is false"
                        )

                    # Validate variant_count assertion
                    if (
                        variant_count_assertion is not None
                        and isinstance(experiment_variants, list)
                        and len(experiment_variants) != variant_count_assertion
                    ):
                        error(
                            f"[3] {ff}: experiment has {len(experiment_variants)} variant(s) "
                            f"but assertions.variant_count is "
                            f"{variant_count_assertion}"
                        )
                else:
                    # No variants — assertions should not claim variants exist
                    if has_variants_assertion:
                        error(
                            f"[3] {ff}: assertions.has_variants is true but "
                            f"experiment has no variants field"
                        )

            # Validate events structure (flat map)
            events = fixture.get("events", {})
            if isinstance(events, dict):
                # If no payment stack, events with requires: [payment] should not exist
                if not has_payment:
                    for ename, edef in events.items():
                        if isinstance(edef, dict) and "payment" in (edef.get("requires") or []):
                            error(
                                f"[3] {ff}: events.{ename} has requires: [payment] but "
                                f"experiment.stack has no payment entry"
                            )
    else:
        # No fixture directory is not an error — fixtures are optional pre-creation
        pass

    # ---------------------------------------------------------------------------
    # Check 4: Frontmatter ↔ Content Sync
    # ---------------------------------------------------------------------------

    # 4a: Code block section headers (### `path`) should be in files: frontmatter
    for sf, content in stack_contents.items():
        fm = parse_frontmatter(sf)
        if not fm:
            continue

        fm_files = set(fm.get("files", []) or [])
        header_paths = set(re.findall(r"###\s+`([^`]+)`", content))

        for path in sorted(header_paths):
            if path not in fm_files:
                error(
                    f"[4] {sf}: code block header path '{path}' not listed in "
                    f"frontmatter 'files'"
                )

    # 4b: Makefile clean lines should match clean.files/clean.dirs frontmatter
    if os.path.isfile(makefile_path):
        clean_match = re.search(
            r"^clean:.*?\n((?:\t.*\n)*)", makefile_content, re.MULTILINE
        )
        if clean_match:
            clean_recipe = clean_match.group(1)

            makefile_clean_items: dict[str, set[str]] = {}
            for line in clean_recipe.splitlines():
                line_s = line.strip()
                if not line_s:
                    continue
                tag_match = re.search(r"#\s+(\w+/\w+)\s*$", line_s)
                if not tag_match:
                    continue
                tag = tag_match.group(1)
                line_body = line_s[: tag_match.start()].strip()
                rm_match = re.match(r"rm\s+(?:-rf|-f)\s+(.*)", line_body)
                if rm_match:
                    items = rm_match.group(1).split()
                    makefile_clean_items.setdefault(tag, set()).update(items)

            for sf in stack_files:
                fm = parse_frontmatter(sf)
                if not fm or "clean" not in fm:
                    continue
                cat_val = sf.replace(".claude/stacks/", "").replace(".md", "")
                clean_fm = fm.get("clean", {}) or {}
                fm_clean_files = set(clean_fm.get("files", []) or [])
                fm_clean_dirs = set(clean_fm.get("dirs", []) or [])
                fm_all = fm_clean_files | fm_clean_dirs

                if not fm_all:
                    continue

                if cat_val not in makefile_clean_items:
                    error(
                        f"[4] {sf}: clean frontmatter has entries but no "
                        f"Makefile clean line tagged '# {cat_val}'"
                    )
                    continue

                mk_items = makefile_clean_items[cat_val]

                for item in sorted(fm_all - mk_items):
                    error(
                        f"[4] {sf}: clean item '{item}' not in Makefile "
                        f"clean target (# {cat_val})"
                    )
                for item in sorted(mk_items - fm_all):
                    error(
                        f"[4] Makefile clean (# {cat_val}): item '{item}' not in "
                        f"{sf} clean frontmatter"
                    )

    # ---------------------------------------------------------------------------
    # Check 5: Conditional Dependency References
    # ---------------------------------------------------------------------------

    for e in check_5_conditional_dependency_refs(skill_contents):
        error(e)

    OPTIONAL_CATEGORIES = {"database", "auth", "payment", "email", "testing"}

    # ---------------------------------------------------------------------------
    # Check 6: Required Fields Consistency
    # ---------------------------------------------------------------------------

    if os.path.isfile(makefile_path):
        mk_required_match = re.search(
            r"required\s*=\s*\[([^\]]+)\]", makefile_content
        )
        if mk_required_match:
            mk_fields_raw = mk_required_match.group(1)
            mk_fields = [
                f.strip().strip("'\"")
                for f in mk_fields_raw.split(",")
                if f.strip()
            ]
            mk_fields_set = set(mk_fields)
            sem_fields_set = set(REQUIRED_EXPERIMENT_FIELDS)

            for field in sorted(mk_fields_set - sem_fields_set):
                error(
                    f"[6] Makefile validate has required field '{field}' "
                    f"missing from validate-semantics.py"
                )
            for field in sorted(sem_fields_set - mk_fields_set):
                error(
                    f"[6] validate-semantics.py has required field '{field}' "
                    f"missing from Makefile validate"
                )

    # ---------------------------------------------------------------------------
    # Check 7: Fixture Stack Coverage
    # ---------------------------------------------------------------------------

    if os.path.isdir(fixture_dir):
        fixture_files_cov = sorted(glob.glob(os.path.join(fixture_dir, "*.yaml")))

        # Collect category/value pairs from stack file paths
        # Exclude distribution/ — distribution is not a bootstrap stack category;
        # it's a runtime choice made at /distribute time and has no experiment.yaml stack entry.
        # Exclude ai/ — ai is an optional add-on for agent experiments, not a core
        # bootstrap category; no fixture currently exercises it.
        stack_pairs = set()
        for sf in stack_files:
            pair = sf.replace(".claude/stacks/", "").replace(".md", "")
            if pair.startswith("distribution/") or pair.startswith("ai/"):
                continue
            stack_pairs.add(pair)

        # Collect stack coverage from all fixtures
        fixture_stack_coverage: dict[str, set[str]] = {}
        all_fixture_stacks: set[str] = set()

        for ff in fixture_files_cov:
            with open(ff) as f:
                try:
                    fixture = yaml.safe_load(f)
                except yaml.YAMLError:
                    continue
            if not isinstance(fixture, dict):
                continue
            experiment = fixture.get("experiment", {})
            stack = experiment.get("stack", {})
            if isinstance(stack, dict):
                pairs: set[str] = set()
                # Map per-service keys to stack file directories
                SERVICE_KEY_TO_DIR = {
                    "runtime": "framework",
                    "hosting": "hosting",
                    "ui": "ui",
                    "testing": "testing",
                }
                for k, v in stack.items():
                    if k == "services":
                        continue  # handled below
                    pairs.add(f"{k}/{v}")
                # Extract per-service stacks from services[] array
                services = stack.get("services", [])
                if isinstance(services, list):
                    for svc in services:
                        if isinstance(svc, dict):
                            for svc_key, stack_dir in SERVICE_KEY_TO_DIR.items():
                                if svc_key in svc:
                                    pairs.add(f"{stack_dir}/{svc[svc_key]}")
                fixture_stack_coverage[ff] = pairs
                all_fixture_stacks |= pairs

        # Each stack file should be covered by at least one fixture
        for pair in sorted(stack_pairs):
            if pair not in all_fixture_stacks:
                error(
                    f"[7] Stack file .claude/stacks/{pair}.md has no "
                    f"fixture coverage in {fixture_dir}/"
                )

        # Parse bootstrap.md for mandatory categories
        bootstrap_path = ".claude/commands/bootstrap.md"
        if os.path.isfile(bootstrap_path):
            with open(bootstrap_path) as f:
                bootstrap_content = f.read()

            always_match = re.search(
                r"always:\s*([^;)]+?)(?:\)|;|$)", bootstrap_content
            )
            if always_match:
                mandatory_cats = [
                    c.strip().rstrip(",")
                    for c in always_match.group(1).split(",")
                    if c.strip()
                ]

                for ff, pairs in fixture_stack_coverage.items():
                    fixture_cats = {p.split("/")[0] for p in pairs}
                    # Read archetype excluded_stacks for this fixture
                    ft = fixture_type_map.get(ff, "web-app")
                    excluded: set[str] = set()
                    arch_path = f".claude/archetypes/{ft}.md"
                    if os.path.isfile(arch_path):
                        afm = parse_frontmatter(arch_path)
                        if afm:
                            excluded = set(afm.get("excluded_stacks", []))
                    for cat in mandatory_cats:
                        if cat in excluded:
                            continue  # skip excluded categories for this archetype
                        if cat not in fixture_cats:
                            error(
                                f"[7] {ff}: missing mandatory stack category "
                                f"'{cat}' (must be in all fixtures)"
                            )

    # ---------------------------------------------------------------------------
    # Check 8: Tool & Prereq Validity
    # ---------------------------------------------------------------------------

    KNOWN_TOOLS = {
        "Read", "Write", "Edit", "Bash", "Glob", "Grep",
        "WebFetch", "WebSearch", "Task", "NotebookEdit",
        "AskUserQuestion", "EnterPlanMode", "ExitPlanMode",
        "Skill", "TaskCreate", "TaskUpdate", "TaskGet", "TaskList",
        "TaskOutput", "TaskStop",
    }

    for sf, content in skill_contents.items():
        prose = extract_prose(content)
        for m in re.finditer(r"using the (\w+) tool", prose):
            tool_name = m.group(1)
            if tool_name not in KNOWN_TOOLS:
                pos = content.find(m.group(0))
                line_num = content[:pos].count("\n") + 1 if pos >= 0 else "?"
                error(
                    f"[8] {sf}:{line_num}: references unknown tool "
                    f"'{tool_name}'"
                )

    # ---------------------------------------------------------------------------
    # Check 9: Env Loading Outside Next.js Runtime
    # ---------------------------------------------------------------------------

    for sf, content in stack_contents.items():
        # Get section header positions
        headers = [
            (m.start(), m.group(1))
            for m in re.finditer(r"###\s+`([^`]+)`", content)
        ]
        blocks = extract_code_blocks(content, {"ts", "tsx", "js"})

        # Check if any code block in this stack file already loads env
        # (e.g., playwright.config.ts loads env for all Playwright templates)
        file_has_env_loader = any(
            re.search(r"loadEnvConfig|dotenv|@next/env", b["code"])
            for b in blocks
        )

        for block in blocks:
            block_start = block["start_line"]
            # Find closest header before this block
            closest_path = None
            for hdr_pos, path in headers:
                hdr_line = content[:hdr_pos].count("\n") + 1
                if hdr_line < block_start:
                    closest_path = path

            if not closest_path or closest_path.startswith("src/"):
                continue

            if "process.env." not in block["code"]:
                continue

            has_env_loading = bool(
                re.search(r"loadEnvConfig|dotenv|@next/env", block["code"])
            )
            if not has_env_loading and not file_has_env_loader:
                error(
                    f"[9] {sf}: template for '{closest_path}' uses process.env "
                    f"but doesn't load env config (loadEnvConfig/dotenv/@next/env)"
                )

    # ---------------------------------------------------------------------------
    # Check 10: Validate Warning Differentiation
    # ---------------------------------------------------------------------------

    if os.path.isfile(makefile_path):
        validate_recipe = targets.get("validate", "")

        has_conditional = bool(
            re.search(r"(?i)WARN|warning.*if|if.*warn", validate_recipe)
        )
        has_passed_message = bool(
            re.search(r"Validation passed", validate_recipe)
        )

        if has_passed_message and not has_conditional:
            error(
                f"[10] Makefile validate: success message is unconditional — "
                f"should differentiate between clean pass and pass with warnings"
            )

    # ---------------------------------------------------------------------------
    # Check 11: Hardcoded Provider Names Match Assumes
    # ---------------------------------------------------------------------------

    for e in check_11_hardcoded_provider_names(stack_contents):
        error(e)

    # ---------------------------------------------------------------------------
    # Check 12: Prose File References in Reads Frontmatter
    # ---------------------------------------------------------------------------

    # Spec files that should be in reads when referenced as a source of truth.
    # Excludes runtime-check files (package.json, .env.example) which are existence
    # checks, not files Claude reads for context.
    SPEC_REFERENCE_FILES = {"CLAUDE.md", "experiment/EVENTS.yaml"}

    for sf, content in skill_contents.items():
        fm = parse_frontmatter(sf)
        if not fm:
            continue
        reads = set(fm.get("reads", []) or [])
        prose = extract_prose(content)

        for ref_file in SPEC_REFERENCE_FILES:
            # Look for directive references (e.g., "CLAUDE.md Rule 4", "per CLAUDE.md")
            # Exclude example text like "(e.g., ... CLAUDE.md Rule Z)"
            for m_ref in re.finditer(
                rf"\b{re.escape(ref_file)}\b", prose
            ):
                # Skip if inside example parenthetical (e.g., ...)
                start = max(0, m_ref.start() - 100)
                context_before = prose[start : m_ref.start()]
                if re.search(r"e\.g\.\s*,", context_before):
                    continue

                # Check if this file is in reads
                matched = any(ref_file in r or r in ref_file for r in reads)
                if not matched:
                    pos = content.find(ref_file)
                    line_num = content[:pos].count("\n") + 1 if pos >= 0 else "?"
                    error(
                        f"[12] {sf}:{line_num}: prose references '{ref_file}' "
                        f"but it's not in 'reads' frontmatter"
                    )
                    break  # One error per file per reference is enough

    # ---------------------------------------------------------------------------
    # Check 13: Fixture Coverage for Stack File Branching Conditions
    # ---------------------------------------------------------------------------

    if os.path.isdir(fixture_dir):
        fixture_files_branch = sorted(glob.glob(os.path.join(fixture_dir, "*.yaml")))

        # Collect fixture stack configs
        fixture_stacks_13: list[dict[str, str]] = []
        for ff in fixture_files_branch:
            with open(ff) as f:
                try:
                    fixture = yaml.safe_load(f)
                except yaml.YAMLError:
                    continue
            if not isinstance(fixture, dict):
                continue
            experiment = fixture.get("experiment", {})
            stack = experiment.get("stack", {})
            if isinstance(stack, dict):
                fixture_stacks_13.append(stack)

        # For each stack file, check for conditional branching
        for sf, content in stack_contents.items():
            prose = extract_prose(content)
            cat_val = sf.replace(".claude/stacks/", "").replace(".md", "")
            category = cat_val.split("/")[0]

            # Find "when stack.X is NOT Y" or "when stack.X is also Y" patterns
            for m in re.finditer(
                r"(?i)when\s+`?stack\.(\w+)`?\s+is\s+NOT\s+(\w+)",
                prose,
            ):
                dep_category = m.group(1)
                dep_value = m.group(2)

                # Check if any fixture exercises the "NOT" branch
                has_not_branch = any(
                    dep_category not in fs or fs.get(dep_category) != dep_value
                    for fs in fixture_stacks_13
                    if category in fs  # Only fixtures that use this stack category
                )

                if not has_not_branch:
                    error(
                        f"[13] {sf}: has conditional for 'stack.{dep_category} "
                        f"is NOT {dep_value}' but no fixture exercises this branch"
                    )

    # ---------------------------------------------------------------------------
    # Check 14: Stack File Provides Fallback When Assumes Not Met
    # ---------------------------------------------------------------------------

    FALLBACK_INDICATORS = re.compile(
        r"(?i)\b(?:fallback|no[- ]auth|without|not met|absent|simplified|"
        r"when.*(?:not|missing|absent)|anonymous)\b"
    )

    # Only flag when assumes include optional categories — mandatory categories
    # (framework, analytics, ui, hosting) are always present per bootstrap.md
    OPTIONAL_ASSUME_CATEGORIES = {"database", "auth", "payment", "testing"}

    for sf, content in stack_contents.items():
        fm = parse_frontmatter(sf)
        if not fm:
            continue
        assumes = fm.get("assumes", []) or []
        if not assumes:
            continue

        # Filter to only optional assumed dependencies
        optional_assumes = [
            a for a in assumes
            if a.split("/")[0] in OPTIONAL_ASSUME_CATEGORIES
        ]
        if not optional_assumes:
            continue

        prose = extract_prose(content)
        if not FALLBACK_INDICATORS.search(prose):
            error(
                f"[14] {sf}: has optional assumes {optional_assumes} but no "
                f"fallback section for when dependencies are absent"
            )

    # ---------------------------------------------------------------------------
    # Check 15: Makefile Deploy Hosting Guard
    # ---------------------------------------------------------------------------

    if os.path.isfile(makefile_path):
        deploy_recipe = targets.get("deploy", "")

        # Check for hosting-provider-specific commands
        provider_commands = {
            "vercel": r"\bvercel\b",
            "netlify": r"\bnetlify\b",
            "fly": r"\bfly\b|\bflyctl\b",
        }

        for provider, pattern in provider_commands.items():
            if re.search(pattern, deploy_recipe):
                # Check for a hosting stack guard
                has_hosting_guard = bool(
                    re.search(
                        r"(?:HOSTING|hosting|stack.*hosting)",
                        deploy_recipe,
                    )
                )
                if not has_hosting_guard:
                    line_num = makefile_content[
                        : makefile_content.index("deploy:")
                    ].count("\n") + 1
                    error(
                        f"[15] Makefile:{line_num}: deploy target uses "
                        f"'{provider}' command without hosting stack guard"
                    )

    # ---------------------------------------------------------------------------
    # Check 16: Change Payment-Auth Dependency
    # ---------------------------------------------------------------------------

    change_path = ".claude/commands/change.md"
    if os.path.isfile(change_path):
        change_content = read_skill_with_states(change_path)
        for e in check_16_change_payment_auth(change_content, change_path):
            error(e)

    # ---------------------------------------------------------------------------
    # Check 17: Stack File Env Vars in Prose Match Frontmatter Declarations
    # ---------------------------------------------------------------------------

    for e in check_17_env_vars_prose_frontmatter_sync(stack_contents):
        error(e)

    # ---------------------------------------------------------------------------
    # Check 18: Change Skill Validates Payment Requires Database
    # ---------------------------------------------------------------------------

    change_path_db = ".claude/commands/change.md"
    if os.path.isfile(change_path_db):
        change_content_db = read_skill_with_states(change_path_db)
        for e in check_18_change_payment_database(change_content_db, change_path_db):
            error(e)

    # ---------------------------------------------------------------------------
    # Check 19: Fixture Coverage for Testing with Partial Assumes
    # ---------------------------------------------------------------------------

    if os.path.isdir(fixture_dir):
        fixture_files_testing = sorted(glob.glob(os.path.join(fixture_dir, "*.yaml")))

        # Collect fixture stack configs for testing fixtures only
        testing_fixtures_all_met: list[str] = []
        testing_fixtures_none_met: list[str] = []
        testing_fixtures_partial_met: list[str] = []

        # Get testing stack file assumes
        testing_assumes_categories: set[str] = set()
        for sf in stack_files:
            if "/testing/" in sf:
                fm_t = parse_frontmatter(sf)
                if fm_t:
                    for a in fm_t.get("assumes", []) or []:
                        testing_assumes_categories.add(a.split("/")[0])

        # Only run check if we have testing assumes to validate against
        if testing_assumes_categories:
            optional_testing_assumes = testing_assumes_categories & OPTIONAL_CATEGORIES

            for ff in fixture_files_testing:
                with open(ff) as f:
                    try:
                        fixture = yaml.safe_load(f)
                    except yaml.YAMLError:
                        continue
                if not isinstance(fixture, dict):
                    continue
                experiment = fixture.get("experiment", {})
                stack = experiment.get("stack", {})
                if not isinstance(stack, dict):
                    continue

                # Only consider fixtures with testing
                if "testing" not in stack:
                    continue

                # Check which optional assumes are met
                met = {
                    cat for cat in optional_testing_assumes
                    if cat in stack
                }

                if met == optional_testing_assumes:
                    testing_fixtures_all_met.append(ff)
                elif not met:
                    testing_fixtures_none_met.append(ff)
                else:
                    testing_fixtures_partial_met.append(ff)

            if testing_fixtures_all_met and testing_fixtures_none_met and not testing_fixtures_partial_met:
                error(
                    f"[19] tests/fixtures/: testing fixtures only cover "
                    f"all-met and none-met assumes scenarios without at least "
                    f"one partial-met fixture (e.g., auth present, database absent)"
                )

    # ---------------------------------------------------------------------------
    # Check 20: Makefile Help Text Doesn't Hard-Code Optional Env Var Names
    # ---------------------------------------------------------------------------

    if os.path.isfile(makefile_path):
        with open(makefile_path) as f:
            makefile_content_help = f.read()

        # Parse target help comments: lines matching "target-name: ## help text"
        for m in re.finditer(r"^([a-zA-Z0-9_-]+):\s*.*?##\s*(.+)$", makefile_content_help, re.MULTILINE):
            target_name_20 = m.group(1)
            help_text = m.group(2)

            # Look for environment variable names in help text
            env_vars_in_help = re.findall(
                r"\b(?:NEXT_PUBLIC_[A-Z_]+|[A-Z][A-Z_]{3,}(?:_KEY|_URL|_ID|_SECRET|_TOKEN|_ANON_KEY|_ROLE_KEY))\b",
                help_text,
            )
            if env_vars_in_help:
                line_num = makefile_content_help[: m.start()].count("\n") + 1
                error(
                    f"[20] Makefile:{line_num}: target '{target_name_20}' help "
                    f"text contains environment variable name(s) "
                    f"{env_vars_in_help} that are conditional on stack configuration"
                )

    # ---------------------------------------------------------------------------
    # Check 21: Stack File Packages in Prose Match Frontmatter Declarations
    # ---------------------------------------------------------------------------

    for e in check_21_packages_prose_frontmatter_sync(stack_contents):
        error(e)

    # ---------------------------------------------------------------------------
    # Check 22: Bootstrap Payment-Database Dependency
    # ---------------------------------------------------------------------------

    bootstrap_path_22 = ".claude/commands/bootstrap.md"
    if os.path.isfile(bootstrap_path_22):
        bootstrap_content_22 = read_skill_with_states(bootstrap_path_22)

        # Find the Phase 1 Step 3 validation section (narrative or state machine format)
        validate_section_match = re.search(
            r"(?i)(?:###?\s*|\d+\.\s*(?:\*\*)?)Validate (?:idea|experiment)\.yaml(?:\*\*)?\s*\n(.*?)(?=\n\d+\.\s*\*\*|\n###?\s|\n##\s|\Z)",
            bootstrap_content_22,
            re.DOTALL,
        )
        if not validate_section_match:
            validate_section_match = re.search(
                r"(?i)#{1,2}\s*STATE\s+\d+[a-z]*:\s*VALIDATE_EXPERIMENT\s*\n(.*?)(?=\n---\s*\n#{1,2}\s*STATE|\n#\s*STATE|\Z)",
                bootstrap_content_22,
                re.DOTALL,
            )
        if validate_section_match:
            validate_section = validate_section_match.group(1)
            has_db_check = bool(
                re.search(
                    r"(?i)payment.*database.*present|database.*present.*payment|"
                    r"payment\s+requires.*database|"
                    r"stack\.database.*(?:missing|present|also)|"
                    r"stack\.payment.*(?:verify|check).*stack\.database",
                    validate_section,
                )
            )
            if not has_db_check:
                error(
                    f"[22] {bootstrap_path_22}: Validate experiment.yaml section "
                    f"doesn't validate that `stack.payment` requires "
                    f"`stack.database` to also be present"
                )
        else:
            error(
                f"[22] {bootstrap_path_22}: could not find Validate experiment.yaml "
                f"section to check payment-database dependency"
            )

    # ---------------------------------------------------------------------------
    # Check 23: Testing CI Template Includes Payment Env Vars When ci.yml Does
    # ---------------------------------------------------------------------------

    ci_yml_path_23 = ".github/workflows/ci.yml"
    if os.path.isfile(ci_yml_path_23):
        with open(ci_yml_path_23) as f:
            ci_content_23 = f.read()

        # Check if ci.yml e2e job contains Stripe env vars
        e2e_match = re.search(
            r"e2e:.*?(?=\n  \w+:|\Z)", ci_content_23, re.DOTALL
        )
        if e2e_match:
            e2e_section = e2e_match.group(0)
            stripe_vars_in_ci = re.findall(
                r"(STRIPE_\w+|NEXT_PUBLIC_STRIPE_\w+)", e2e_section
            )

            if stripe_vars_in_ci:
                # Check that testing stack CI template also mentions them
                for sf, content in stack_contents.items():
                    if "/testing/" not in sf:
                        continue
                    ci_template_match = re.search(
                        r"## CI Job Template\s*\n(.*?)(?=\n## |\Z)",
                        content,
                        re.DOTALL,
                    )
                    if ci_template_match:
                        ci_template = ci_template_match.group(1)
                        for var in stripe_vars_in_ci:
                            if var not in ci_template:
                                error(
                                    f"[23] {sf}: CI Job Template missing '{var}' "
                                    f"which is present in ci.yml e2e job"
                                )

    # ---------------------------------------------------------------------------
    # Check 24: Testing Stack No-Auth Fallback Includes CI Job Template
    # ---------------------------------------------------------------------------

    for sf, content in stack_contents.items():
        if "/testing/" not in sf:
            continue
        fm = parse_frontmatter(sf)
        if not fm:
            continue

        # Check for No-Auth Fallback section
        fallback_match = re.search(
            r"## No-Auth Fallback\s*\n(.*?)(?=\n## [^#]|\Z)",
            content,
            re.DOTALL,
        )
        if fallback_match:
            fallback_section = fallback_match.group(1)
            # Check for a YAML code block with an e2e: job definition
            yaml_blocks = re.findall(
                r"```yaml\s*\n(.*?)```", fallback_section, re.DOTALL
            )
            has_e2e_job = any("e2e:" in block for block in yaml_blocks)
            if not has_e2e_job:
                error(
                    f"[24] {sf}: No-Auth Fallback section missing a CI job "
                    f"template (YAML code block with 'e2e:' job definition)"
                )

    # ---------------------------------------------------------------------------
    # Check 25: Change Skill Test Type Permits Adding Testing to experiment.yaml Stack
    # ---------------------------------------------------------------------------

    change_path_25 = ".claude/commands/change.md"
    if os.path.isfile(change_path_25):
        change_content_25 = read_skill_with_states(change_path_25)

        # Look for text indicating the Test type can add testing to experiment.yaml stack
        has_testing_addition = bool(
            re.search(
                r"(?i)(?:test.*(?:add|update).*(?:experiment\.yaml|idea\.yaml|stack).*testing|"
                r"testing.*(?:experiment\.yaml|idea\.yaml|stack)|"
                r"stack\.testing.*(?:experiment\.yaml|idea\.yaml))",
                change_content_25,
            )
        )
        if not has_testing_addition:
            error(
                f"[25] {change_path_25}: Test type constraints do not address "
                f"adding `testing` to experiment.yaml stack section"
            )

    # ---------------------------------------------------------------------------
    # Check 26: Testing Stack Env Frontmatter Excludes Assumes-Dependent Vars
    # ---------------------------------------------------------------------------

    for sf in stack_files:
        if "/testing/" not in sf:
            continue
        fm = parse_frontmatter(sf)
        if not fm:
            continue

        assumes = fm.get("assumes", []) or []
        optional_assumes = [
            a for a in assumes
            if a.split("/")[0] in OPTIONAL_CATEGORIES
        ]
        if not optional_assumes:
            continue

        # Check if there's a fallback section (meaning assumes are truly optional)
        content = stack_contents.get(sf, "")
        has_fallback = bool(
            re.search(r"(?i)fallback|no[- ]auth", content)
        )
        if not has_fallback:
            continue

        # Get provider names from optional assumes
        provider_names = set()
        for a in optional_assumes:
            provider_names.add(a.split("/")[1].upper())

        env_section = fm.get("env", {}) or {}
        server_vars = env_section.get("server", []) or []
        client_vars = env_section.get("client", []) or []
        all_env = server_vars + client_vars

        for var in all_env:
            for provider in provider_names:
                if provider in var:
                    error(
                        f"[26] {sf}: env frontmatter var '{var}' contains "
                        f"provider name '{provider}' from optional assumes — "
                        f"should not be unconditional when a fallback exists"
                    )

    # ---------------------------------------------------------------------------
    # Check 27: Auth Template Post-Auth Redirects
    # ---------------------------------------------------------------------------

    for sf, content in stack_contents.items():
        if "/auth/" not in sf:
            continue

        blocks = extract_code_blocks(content, {"tsx", "jsx"})
        for block in blocks:
            code = block["code"]
            # Check if this is a signup or login page template
            is_signup = "signUp" in code or "handleSignup" in code
            is_login = "signInWithPassword" in code or "handleLogin" in code
            if not is_signup and not is_login:
                continue

            page_type = "signup" if is_signup else "login"

            # Check for a redirect call after the auth success path
            has_redirect = bool(
                re.search(r"router\.push\(|router\.replace\(|redirect\(", code)
            )
            has_only_todo = bool(
                re.search(r"//\s*TODO.*redirect", code, re.IGNORECASE)
            )

            if not has_redirect or has_only_todo:
                error(
                    f"[27] {sf}:{block['start_line']}: {page_type} page template "
                    f"has no post-auth redirect (router.push/redirect) — only a "
                    f"TODO comment"
                    if has_only_todo
                    else f"[27] {sf}:{block['start_line']}: {page_type} page "
                    f"template missing post-auth redirect (router.push/redirect)"
                )

    # ---------------------------------------------------------------------------
    # Check 28: Change Assumes Validation Matches Bootstrap Assumes Validation
    # ---------------------------------------------------------------------------

    change_path_28 = ".claude/commands/change.md"
    bootstrap_path_28 = ".claude/commands/bootstrap.md"
    if os.path.isfile(change_path_28) and os.path.isfile(bootstrap_path_28):
        change_content_28 = read_skill_with_states(change_path_28)

        # Find assumes validation text in change.md
        assumes_refs = list(
            re.finditer(r"(?i)assumes.*list", change_content_28)
        )
        if assumes_refs:
            # Check if the change skill's assumes validation includes
            # value-matching language (not just category existence)
            change_assumes_text = change_content_28
            has_value_matching = bool(
                re.search(
                    r"(?i)category[/:]value|value\s+(?:must\s+)?match|"
                    r"matching\s+.*pair|category:\s*value.*pair|"
                    r"not just.*(?:category|present)",
                    change_assumes_text,
                )
            )
            has_category_only = bool(
                re.search(
                    r"(?i)check if the corresponding stack category exists",
                    change_assumes_text,
                )
            )
            if has_category_only and not has_value_matching:
                error(
                    f"[28] {change_path_28}: assumes validation uses "
                    f"category-existence language instead of value-matching "
                    f"language (should match bootstrap's approach)"
                )

    # ---------------------------------------------------------------------------
    # Check 29: Change Payment Validation Before Plan Phase
    # ---------------------------------------------------------------------------

    change_path_29 = ".claude/commands/change.md"
    if os.path.isfile(change_path_29):
        change_content_29 = read_skill_with_states(change_path_29)

        # Find payment dependency validation text (the stop messages)
        payment_validation_pattern = re.compile(
            r"Payment requires (?:authentication|a database)",
            re.IGNORECASE,
        )
        payment_matches = list(payment_validation_pattern.finditer(change_content_29))

        if payment_matches:
            # Find the plan phase marker
            plan_phase_match = re.search(
                r"## Phase 1|### STOP",
                change_content_29,
            )
            if plan_phase_match:
                plan_phase_pos = plan_phase_match.start()
                # At least one payment validation instance must appear before plan phase
                has_pre_plan = any(
                    m.start() < plan_phase_pos for m in payment_matches
                )
                if not has_pre_plan:
                    error(
                        f"[29] {change_path_29}: all payment dependency "
                        f"validation appears after the plan phase — at least "
                        f"one check must be in preconditions (before Phase 1)"
                    )

    # ---------------------------------------------------------------------------
    # Check 30: Analytics Stack Files Include Dashboard Navigation Section
    # ---------------------------------------------------------------------------

    analytics_stack_files = [
        sf for sf in stack_files if "/analytics/" in sf
    ]

    for sf in analytics_stack_files:
        content = stack_contents[sf]
        has_dashboard_nav = bool(
            re.search(r"(?i)^## Dashboard Navigation", content, re.MULTILINE)
        )
        if not has_dashboard_nav:
            error(
                f"[30] {sf}: analytics stack file missing required "
                f"'## Dashboard Navigation' section (needed by /iterate skill)"
            )

    # ---------------------------------------------------------------------------
    # Check 31: Change Skill Revalidates Testing Assumes for All Change Types
    # ---------------------------------------------------------------------------

    change_path_31 = ".claude/commands/change.md"
    if os.path.isfile(change_path_31):
        change_content_31 = read_skill_with_states(change_path_31)

        # Find preconditions section (by content, not step number)
        preconditions_match = re.search(
            r"(?:## Step \d+:.*?[Cc]heck.*?preconditions|# STATE \d+:\s*CHECK_PRECONDITIONS).*?\n(.*?)(?=\n## Step \d|\n## Phase|\n# STATE|\Z)",
            change_content_31,
            re.DOTALL,
        )
        if preconditions_match:
            preconditions_text = preconditions_match.group(1)

            # Look for testing assumes validation NOT gated by Test-type classification
            # There should be a check that runs when type is NOT Test
            has_non_test_assumes_check = bool(
                re.search(
                    r"(?i)(?:NOT\s+Test|type\s+is\s+NOT\s+Test).*testing.*assumes|"
                    r"testing.*assumes.*(?:NOT\s+Test|type\s+is\s+NOT\s+Test)",
                    preconditions_text,
                    re.DOTALL,
                )
            )
            if not has_non_test_assumes_check:
                error(
                    f"[31] {change_path_31}: preconditions step does not "
                    f"revalidate testing assumes for non-Test change types"
                )
        else:
            error(
                f"[31] {change_path_31}: could not find preconditions step "
                f"to check testing assumes revalidation"
            )

    # ---------------------------------------------------------------------------
    # Check 32: Analytics Stack Files Include Test Blocking Section
    # ---------------------------------------------------------------------------

    for sf in analytics_stack_files:
        content = stack_contents[sf]
        has_test_blocking = bool(
            re.search(r"(?i)^## Test Blocking", content, re.MULTILINE)
        )
        if not has_test_blocking:
            error(
                f"[32] {sf}: analytics stack file missing required "
                f"'## Test Blocking' section (needed by testing stack's "
                f"blockAnalytics helper)"
            )

    # ---------------------------------------------------------------------------
    # Check 33: Skill Prose Phantom Event Names
    # ---------------------------------------------------------------------------

    events_yaml_path = "experiment/EVENTS.yaml"
    if os.path.isfile(events_yaml_path):
        with open(events_yaml_path) as f:
            events_data = yaml.safe_load(f) or {}

        defined_events: set[str] = set()
        flat_events = events_data.get("events", {})
        if isinstance(flat_events, dict):
            for ename, edef in flat_events.items():
                defined_events.add(ename)

        global_props = set((events_data.get("global_properties", {}) or {}).keys())

        event_props: set[str] = set()
        if isinstance(flat_events, dict):
            for ename, edef in flat_events.items():
                if isinstance(edef, dict):
                    for prop_name in (edef.get("properties", {}) or {}).keys():
                        event_props.add(prop_name)

        for e in check_33_phantom_event_names(skill_contents, defined_events, global_props, event_props):
            error(e)

    # ---------------------------------------------------------------------------
    # Check 34: Stack Files with Fallback Sections Annotate Conditional Files
    # ---------------------------------------------------------------------------

    for sf, content in stack_contents.items():
        fm = parse_frontmatter(sf)
        if not fm:
            continue

        # Check if this stack file has a fallback section
        has_fallback = bool(
            re.search(r"(?i)## No-Auth Fallback|## .*Fallback", content)
        )
        if not has_fallback:
            continue

        fm_files = fm.get("files", []) or []
        if not fm_files:
            continue

        # Get the files block from frontmatter to check for # conditional comment
        fm_match = re.match(r"^---\n(.*?\n)---", content, re.DOTALL)
        if not fm_match:
            continue
        fm_text = fm_match.group(1)
        # Extract the full files block (files: line + all indented list entries)
        files_block_match = re.search(
            r"^files:.*(?:\n  - .*)*", fm_text, re.MULTILINE
        )
        if not files_block_match:
            continue
        files_block = files_block_match.group(0)

        # Find code block headers that only appear outside the fallback section
        fallback_start = re.search(r"(?i)## No-Auth Fallback|## .*Fallback", content)
        if not fallback_start:
            continue

        # Get headers before fallback
        pre_fallback = content[:fallback_start.start()]
        post_fallback = content[fallback_start.start():]

        pre_headers = set(re.findall(r"###\s+`([^`]+)`", pre_fallback))
        post_headers = set(re.findall(r"###\s+`([^`]+)`", post_fallback))

        # Files whose headers only appear in pre-fallback (full template only)
        full_only_headers = pre_headers - post_headers

        # Check if any frontmatter files match full-only headers
        assumes_dependent_files = [f for f in fm_files if f in full_only_headers]

        # Check for # conditional annotation on the files: key line OR on
        # individual file entries for each assumes-dependent file
        if assumes_dependent_files:
            unannotated = []
            for dep_file in assumes_dependent_files:
                # Check if this specific file's entry line has # conditional
                entry_match = re.search(
                    rf"^\s*-\s+{re.escape(dep_file)}.*#\s*conditional",
                    files_block,
                    re.MULTILINE,
                )
                if not entry_match:
                    unannotated.append(dep_file)
            # Also accept a blanket # conditional on the files: key line
            if unannotated and "# conditional" not in files_block.split("\n")[0]:
                error(
                    f"[34] {sf}: files frontmatter lists assumes-dependent files "
                    f"{unannotated} but lacks '# conditional' annotation"
                )

    # ---------------------------------------------------------------------------
    # Check 35: No-Auth CI Template Includes Commented Database Placeholder Env Vars
    # ---------------------------------------------------------------------------

    for sf, content in stack_contents.items():
        if "/testing/" not in sf:
            continue

        # Find the full-auth CI Job Template
        full_ci_match = re.search(
            r"## CI Job Template\s*\n(.*?)(?=\n## |\Z)",
            content,
            re.DOTALL,
        )
        if not full_ci_match:
            continue

        # Find the No-Auth CI Job Template
        noauth_ci_match = re.search(
            r"### No-Auth CI Job Template\s*\n(.*?)(?=\n### |\n## |\Z)",
            content,
            re.DOTALL,
        )
        if not noauth_ci_match:
            continue

        full_ci_text = full_ci_match.group(1)
        noauth_ci_text = noauth_ci_match.group(1)

        # Check for database-related env var names (SUPABASE from database/supabase)
        # in the full-auth template
        db_env_vars = re.findall(
            r"(NEXT_PUBLIC_SUPABASE_URL|NEXT_PUBLIC_SUPABASE_ANON_KEY)",
            full_ci_text,
        )

        if db_env_vars:
            for var in set(db_env_vars):
                if var not in noauth_ci_text:
                    error(
                        f"[35] {sf}: No-Auth CI Job Template missing database "
                        f"env var '{var}' which is present in full-auth CI "
                        f"Job Template (should be commented or uncommented)"
                    )

    # ---------------------------------------------------------------------------
    # Check 36: (removed — bootstrap now supports stack.testing)
    # ---------------------------------------------------------------------------

    # ---------------------------------------------------------------------------
    # Check 37: Change Skill Classification Precedes Classification-Dependent Checks
    # ---------------------------------------------------------------------------

    change_path_37 = ".claude/commands/change.md"
    if os.path.isfile(change_path_37):
        change_content_37 = read_skill_with_states(change_path_37)

        # Find the step heading containing "Classify"
        classify_match = re.search(
            r"^## Step (\d+):.*(?:Classify|classify)",
            change_content_37,
            re.MULTILINE,
        )

        # Find step headings whose body contains "classified as" or "is a Fix"
        step_pattern = re.compile(
            r"^## Step (\d+):.*\n(.*?)(?=^## Step \d|\Z)",
            re.MULTILINE | re.DOTALL,
        )
        classification_dependent_steps: list[tuple[int, str]] = []
        for m in step_pattern.finditer(change_content_37):
            step_num = int(m.group(1))
            body = m.group(2)
            if re.search(r"classified as|is classified as|is a Fix|is NOT Test", body):
                classification_dependent_steps.append((step_num, body[:50]))

        if classify_match and classification_dependent_steps:
            classify_step = int(classify_match.group(1))
            for dep_step, _ in classification_dependent_steps:
                if dep_step < classify_step:
                    error(
                        f"[37] {change_path_37}: Step {dep_step} uses "
                        f"classification-dependent language but appears before "
                        f"the classification step (Step {classify_step})"
                    )

    # ---------------------------------------------------------------------------
    # Check 38: Ads.yaml Schema Validation
    # ---------------------------------------------------------------------------

    ads_yaml_path = "experiment/ads.yaml"
    if os.path.isfile(ads_yaml_path):
        with open(ads_yaml_path) as f:
            try:
                ads_data = yaml.safe_load(f)
            except yaml.YAMLError as e:
                error(f"[38] {ads_yaml_path}: invalid YAML: {e}")
                ads_data = None

        if ads_data and isinstance(ads_data, dict):
            for e in check_38_ads_yaml_schema(ads_data, ads_yaml_path):
                error(e)

    # ---------------------------------------------------------------------------
    # Check 39: Ads.yaml Campaign Name Matches experiment.yaml Name
    # ---------------------------------------------------------------------------

    if os.path.isfile(ads_yaml_path) and os.path.isfile("experiment/experiment.yaml"):
        with open("experiment/experiment.yaml") as f:
            idea_data_39 = yaml.safe_load(f)

        if os.path.isfile(ads_yaml_path):
            with open(ads_yaml_path) as f:
                try:
                    ads_data_39 = yaml.safe_load(f)
                except yaml.YAMLError:
                    ads_data_39 = None

            if (
                ads_data_39
                and isinstance(ads_data_39, dict)
                and isinstance(idea_data_39, dict)
            ):
                for e in check_39_ads_campaign_name(ads_data_39, idea_data_39, ads_yaml_path):
                    error(e)

    # ---------------------------------------------------------------------------
    # Check 40: Distribute Skill Prose Event Names
    # ---------------------------------------------------------------------------

    # The distribute skill adds feedback_submitted to experiment/EVENTS.yaml at runtime.
    # Verify that distribute.md contains the event definition in a code block
    # (so it can be added during Step 7c).
    distribute_path = ".claude/commands/distribute.md"
    if os.path.isfile(distribute_path):
        distribute_content = read_skill_with_states(distribute_path)

        # distribute.md must contain a YAML code block that defines feedback_submitted
        yaml_blocks = extract_code_blocks(distribute_content, {"yaml"})
        has_event_def = any(
            "feedback_submitted" in block["code"] and "funnel_stage:" in block["code"]
            for block in yaml_blocks
        )
        if not has_event_def:
            error(
                f"[40] {distribute_path}: must contain a YAML code block "
                f"defining the 'feedback_submitted' event (added to "
                f"experiment/EVENTS.yaml events map during Step 7c)"
            )

    # ---------------------------------------------------------------------------
    # Check 41: Distribution Docs References Exist
    # ---------------------------------------------------------------------------

    # Check distribute.md and distribution stack files for docs references
    _docs_ref_sources_41 = [".claude/commands/distribute.md"] + glob.glob(
        ".claude/stacks/distribution/*.md"
    )
    for _src_path_41 in _docs_ref_sources_41:
        if os.path.isfile(_src_path_41):
            with open(_src_path_41) as f:
                _content_41 = f.read()

            # Find backtick-wrapped docs/ references
            for _ref_match_41 in re.finditer(r"`(docs/[^`]+\.md)`", _content_41):
                referenced_path_41 = _ref_match_41.group(1)
                if not os.path.isfile(referenced_path_41):
                    error(
                        f"[41] {_src_path_41}: references `{referenced_path_41}` "
                        f"but that file does not exist on disk"
                    )

    # ---------------------------------------------------------------------------
    # Check 42: Distribute Skill Validates Analytics Stack in experiment.yaml
    # ---------------------------------------------------------------------------

    distribute_path_42 = ".claude/commands/distribute.md"
    if os.path.isfile(distribute_path_42):
        distribute_content_42 = read_skill_with_states(distribute_path_42)

        # Find preconditions section (between "Step 1" and "Step 2" headings)
        preconditions_match_42 = re.search(
            r"(?:## Step 1:|# STATE \d+:\s*VALIDATE_PRECONDITIONS).*?\n(.*?)(?=\n## Step 2:|\n# STATE|\Z)",
            distribute_content_42,
            re.DOTALL,
        )
        if preconditions_match_42:
            preconditions_text_42 = preconditions_match_42.group(1)
            # Check for a stop message mentioning analytics being required
            has_analytics_validation = bool(
                re.search(
                    r"(?i)analytics.*(?:required|not present|not configured).*stop|"
                    r"stack\.analytics.*(?:present|not|missing)|"
                    r"(?:verify|check).*stack\.analytics",
                    preconditions_text_42,
                )
            )
            if not has_analytics_validation:
                error(
                    f"[42] {distribute_path_42}: preconditions section does not "
                    f"validate that `stack.analytics` is present in experiment.yaml "
                    f"before proceeding"
                )
        else:
            error(
                f"[42] {distribute_path_42}: could not find preconditions section "
                f"(Step 1) to check analytics validation"
            )

    # ---------------------------------------------------------------------------
    # Check 43: Distribute Skill Validates experiment/EVENTS.yaml events Structure
    # ---------------------------------------------------------------------------

    distribute_path_43 = ".claude/commands/distribute.md"
    if os.path.isfile(distribute_path_43):
        distribute_content_43 = read_skill_with_states(distribute_path_43)

        # Find preconditions section (between "Step 1" and "Step 2" headings)
        preconditions_match_43 = re.search(
            r"(?:## Step 1:|# STATE \d+:\s*VALIDATE_PRECONDITIONS).*?\n(.*?)(?=\n## Step 2:|\n# STATE|\Z)",
            distribute_content_43,
            re.DOTALL,
        )
        if preconditions_match_43:
            preconditions_text_43 = preconditions_match_43.group(1)
            # Check for events map validation near stop/dict/malformed/missing context
            has_events_validation = bool(
                re.search(
                    r"`events`.*(?:dict|map|stop|malformed|missing)",
                    preconditions_text_43,
                    re.DOTALL,
                )
            )
            if not has_events_validation:
                # Fallback: check if it mentions validating events structure at all
                has_events_validation = bool(
                    re.search(
                        r"events.*(?:dict|map)",
                        preconditions_text_43,
                    )
                )
            if not has_events_validation:
                error(
                    f"[43] {distribute_path_43}: preconditions section does not "
                    f"validate that experiment/EVENTS.yaml `events` is a well-formed "
                    f"dict before proceeding"
                )
        else:
            error(
                f"[43] {distribute_path_43}: could not find preconditions section "
                f"(Step 1) to check events validation"
            )

    # ---------------------------------------------------------------------------
    # Check 44: Bootstrap Skill Validates Variants
    # ---------------------------------------------------------------------------

    bootstrap_path_44 = ".claude/commands/bootstrap.md"
    if os.path.isfile(bootstrap_path_44):
        bootstrap_content_44 = read_skill_with_states(bootstrap_path_44)

        # Find the "Validate experiment.yaml" section (Step 3 or STATE 3)
        validate_section_match = re.search(
            r"##.*(?:Step 3|Validate (?:idea|experiment)\.yaml).*?\n(.*?)(?=\n## |\Z)",
            bootstrap_content_44,
            re.DOTALL,
        )
        if not validate_section_match:
            validate_section_match = re.search(
                r"(?i)#{1,2}\s*STATE\s+\d+[a-z]*:\s*VALIDATE_EXPERIMENT\s*\n(.*?)(?=\n---\s*\n#{1,2}\s*STATE|\n#\s*STATE|\Z)",
                bootstrap_content_44,
                re.DOTALL,
            )
        if validate_section_match:
            validate_text = validate_section_match.group(1)
            has_variant_validation = bool(
                re.search(
                    r"variants?.*(?:present|list|at least 2|slug|valid)",
                    validate_text,
                    re.IGNORECASE,
                )
            )
            if not has_variant_validation:
                error(
                    f"[44] {bootstrap_path_44}: Step 3 (Validate experiment.yaml) does not "
                    f"contain variant validation logic (expected mention of variants "
                    f"with present/list/slug/at least 2)"
                )
            # Sub-check: variants must be restricted to web-app archetype
            has_archetype_guard = bool(
                re.search(
                    r"variants?.*archetype.*(?:NOT|not|!=).*web-app|web-app.*only.*variants?",
                    validate_text,
                    re.IGNORECASE,
                )
            )
            if not has_archetype_guard:
                error(
                    f"[44] {bootstrap_path_44}: Step 3 (Validate experiment.yaml) does not "
                    f"restrict variants to web-app archetype (expected archetype guard "
                    f"near variants validation)"
                )
        else:
            error(
                f"[44] {bootstrap_path_44}: could not find 'Validate experiment.yaml' "
                f"section (Step 3) to check variant validation"
            )

    # ---------------------------------------------------------------------------
    # Check 45: visit_landing Event Has Variant Property
    # ---------------------------------------------------------------------------

    events_path_45 = "experiment/EVENTS.yaml"
    if os.path.isfile(events_path_45):
        with open(events_path_45) as f:
            events_data_45 = yaml.safe_load(f)

        if isinstance(events_data_45, dict):
            flat_events_45 = events_data_45.get("events", {})
            if isinstance(flat_events_45, dict) and "visit_landing" in flat_events_45:
                visit_landing_event = flat_events_45["visit_landing"]
                props = visit_landing_event.get("properties", {}) if isinstance(visit_landing_event, dict) else {}
                if not isinstance(props, dict) or "variant" not in props:
                    error(
                        f"[45] {events_path_45}: visit_landing event is missing "
                        f"a 'variant' property (needed for experiment matrix)"
                    )
            else:
                error(
                    f"[45] {events_path_45}: visit_landing event not found "
                    f"in events map"
                )

    # ---------------------------------------------------------------------------
    # Check 46: Iterate Skill Contains Experiment Verdict
    # ---------------------------------------------------------------------------

    iterate_path_46 = ".claude/commands/iterate.md"
    if os.path.isfile(iterate_path_46):
        iterate_content_46 = read_skill_with_states(iterate_path_46)
        for e in check_46_iterate_verdict(iterate_content_46):
            error(e)

    # ---------------------------------------------------------------------------
    # Check 47: Deploy Skill Contains Analytics Dashboard Setup
    # ---------------------------------------------------------------------------

    deploy_path_47 = ".claude/commands/deploy.md"
    if os.path.isfile(deploy_path_47):
        deploy_content_47 = read_skill_with_states(deploy_path_47)
        has_dashboard = bool(re.search(r"(?i)dashboard", deploy_content_47))
        has_digest = bool(re.search(r"(?i)digest|subscription|subscribe", deploy_content_47))
        if not has_dashboard:
            error("[47] deploy.md: missing analytics dashboard setup section")
        if not has_digest:
            error("[47] deploy.md: missing scheduled digest/subscription setup")

    # ---------------------------------------------------------------------------
    # Check 48: Iterate Skill Contains Next Check-in Schedule
    # ---------------------------------------------------------------------------

    iterate_path_48 = ".claude/commands/iterate.md"
    if os.path.isfile(iterate_path_48):
        iterate_content_48 = read_skill_with_states(iterate_path_48)
        has_checkin = bool(re.search(r"(?i)next.check.in", iterate_content_48))
        if not has_checkin:
            error("[48] iterate.md: missing Next Check-in schedule section")

    # ---------------------------------------------------------------------------
    # Check 49: Bootstrap Email-Auth-Database Dependency
    # ---------------------------------------------------------------------------

    bootstrap_path_49 = ".claude/commands/bootstrap.md"
    if os.path.isfile(bootstrap_path_49):
        bs_content_49 = read_skill_with_states(bootstrap_path_49)
        bs_prose_49 = extract_prose(bs_content_49)
        has_email_auth = bool(re.search(
            r"(?i)email.*auth.*present|email\s+requires.*auth", bs_prose_49
        ))
        has_email_db = bool(re.search(
            r"(?i)email.*database.*present|email\s+requires.*database", bs_prose_49
        ))
        if not has_email_auth:
            error("[49] bootstrap.md: missing email-requires-auth dependency check")
        if not has_email_db:
            error("[49] bootstrap.md: missing email-requires-database dependency check")

    # ---------------------------------------------------------------------------
    # Check 50: Change Email-Auth-Database Dependency
    # ---------------------------------------------------------------------------

    change_path_50 = ".claude/commands/change.md"
    if os.path.isfile(change_path_50):
        change_content_50 = read_skill_with_states(change_path_50)
        change_prose_50 = extract_prose(change_content_50)
        has_email_ref = bool(re.search(r"(?i)adding\s+.*email|email.*stack", change_prose_50))
        if has_email_ref:
            has_email_auth_chk = bool(re.search(
                r"(?i)email.*auth.*present|email\s+requires.*auth", change_prose_50
            ))
            has_email_db_chk = bool(re.search(
                r"(?i)email.*database.*present|email\s+requires.*database", change_prose_50
            ))
            if not has_email_auth_chk:
                error("[50] change.md: mentions adding email stack without auth-presence validation")
            if not has_email_db_chk:
                error("[50] change.md: mentions adding email stack without database-presence validation")

    # ---------------------------------------------------------------------------
    # Check 51: Verify trackServerEvent Calls Match Analytics Stack Signature
    # trackServerEvent(event, distinctId, properties?) — 2nd arg must be a string,
    # not an object literal. Catches calls like trackServerEvent("event", { ... })
    # which pass an object as distinctId instead of a string identifier.
    # ---------------------------------------------------------------------------

    analytics_server_sig = None  # (event, distinctId, properties?)
    for sf in glob.glob(".claude/stacks/analytics/*.md"):
        with open(sf) as f:
            analytics_content = f.read()
        # Check if this stack defines trackServerEvent with a distinctId: string param
        if re.search(r"trackServerEvent\s*\(\s*\n?\s*event:\s*string,\s*\n?\s*distinctId:\s*string", analytics_content):
            analytics_server_sig = sf
            break

    if analytics_server_sig:
        # Scan all stack files for trackServerEvent calls in code blocks
        for sf in glob.glob(".claude/stacks/**/*.md", recursive=True):
            with open(sf) as f:
                sf_content = f.read()
            code_blocks = extract_code_blocks(sf_content, {"ts", "tsx", "typescript"})
            for block in code_blocks:
                # Find trackServerEvent calls where the 2nd arg starts with { (object literal)
                bad_calls = re.findall(
                    r'trackServerEvent\s*\(\s*"[^"]+"\s*,\s*\{',
                    block["code"],
                )
                for call in bad_calls:
                    error(
                        f"[51] {sf}: trackServerEvent call passes object as distinctId "
                        f"(expected string) near line {block['start_line']}: {call.strip()}"
                    )

    # ---------------------------------------------------------------------------
    # Check 52: Verify trackServerEvent Calls Are Awaited in Stack File Code Blocks
    # trackServerEvent is async — without await, serverless functions may terminate
    # before the event is flushed, silently losing analytics data.
    # ---------------------------------------------------------------------------

    if analytics_server_sig:
        for sf in glob.glob(".claude/stacks/**/*.md", recursive=True):
            with open(sf) as f:
                sf_content_52 = f.read()
            code_blocks_52 = extract_code_blocks(sf_content_52, {"ts", "tsx", "typescript"})
            for block in code_blocks_52:
                # Find trackServerEvent calls NOT preceded by await on the same line
                # Exclude function definitions (export async function trackServerEvent)
                unwaited = re.findall(
                    r"^(?!.*\bawait\b)(?!.*\bfunction\b).*\btrackServerEvent\s*\(",
                    block["code"],
                    re.MULTILINE,
                )
                for call in unwaited:
                    error(
                        f"[52] {sf}: trackServerEvent call without await "
                        f"near line {block['start_line']}: {call.strip()}"
                    )

    # ---------------------------------------------------------------------------
    # Check 53: Verify Supabase CLI Commands Use Correct Flag Syntax
    # ---------------------------------------------------------------------------

    all_file_contents_53: dict[str, str] = {}
    for sf in glob.glob(".claude/commands/*.md") + glob.glob(".claude/stacks/**/*.md", recursive=True):
        with open(sf) as f:
            all_file_contents_53[sf] = f.read()
    for e in check_53_supabase_delete_flag(all_file_contents_53):
        error(e)

    # ---------------------------------------------------------------------------
    # Check 54-56: Production Path Consistency in Procedure Files
    # ---------------------------------------------------------------------------

    procedure_contents: dict[str, str] = {}
    for pf in glob.glob(".claude/procedures/*.md"):
        if os.path.isfile(pf):
            with open(pf) as f:
                procedure_contents[pf] = f.read()

    if procedure_contents:
        for e in check_54_procedure_production_branch(procedure_contents):
            error(e)
        for e in check_55_production_references_tdd(procedure_contents):
            error(e)
        for e in check_56_production_references_implementer(procedure_contents):
            error(e)

    # ---------------------------------------------------------------------------
    # Check 57: change.md Production Precondition Checks Testing
    # ---------------------------------------------------------------------------

    change_path_57 = ".claude/commands/change.md"
    if os.path.isfile(change_path_57):
        change_content_57 = read_skill_with_states(change_path_57)
        for e in check_57_change_production_precondition(change_content_57):
            error(e)

    # ---------------------------------------------------------------------------
    # Check 58: Agent Tool Consistency
    # ---------------------------------------------------------------------------

    agent_contents: dict[str, str] = {}
    for af in glob.glob(".claude/agents/*.md"):
        if os.path.isfile(af):
            with open(af) as f:
                agent_contents[af] = f.read()

    if agent_contents:
        for e in check_58_agent_tool_consistency(agent_contents):
            error(e)

    # ---------------------------------------------------------------------------
    # Check 59: Framework-Archetype Compatibility Validation
    # ---------------------------------------------------------------------------

    bootstrap_path_59 = ".claude/commands/bootstrap.md"
    change_path_59 = ".claude/commands/change.md"
    if os.path.isfile(bootstrap_path_59) and os.path.isfile(change_path_59):
        bs_content_59 = read_skill_with_states(bootstrap_path_59)
        ch_content_59 = read_skill_with_states(change_path_59)
        for e in check_59_framework_archetype_compatibility(bs_content_59, ch_content_59):
            error(e)

    # ---------------------------------------------------------------------------
    # Check 60: Settings.json Hook Paths
    # ---------------------------------------------------------------------------

    for e in check_60_settings_hook_paths():
        error(e)

    # ---------------------------------------------------------------------------
    # Check 61: Footer Directive Sync
    # ---------------------------------------------------------------------------

    for e in check_61_footer_directive_sync():
        error(e)

    # ---------------------------------------------------------------------------
    # Summary
    # ---------------------------------------------------------------------------

    print()
    if ERRORS:
        print(f"FAILED: {len(ERRORS)} error(s)")
        return 1
    else:
        print("PASSED: All semantic checks passed.")
        return 0


if __name__ == "__main__":
    sys.exit(main())
