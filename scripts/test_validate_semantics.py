"""Tests for validate-semantics.py check functions."""

import os
import subprocess
import sys

import pytest
import yaml

# Add scripts dir to path for imports
sys.path.insert(0, os.path.dirname(__file__))

# Import check functions from the refactored validator
import importlib.util
spec = importlib.util.spec_from_file_location(
    "validate_semantics",
    os.path.join(os.path.dirname(__file__), "validate-semantics.py"),
)
vs = importlib.util.module_from_spec(spec)
spec.loader.exec_module(vs)


# ---------------------------------------------------------------------------
# Check 1: Import Completeness in TSX Templates
# ---------------------------------------------------------------------------


class TestCheck1ImportCompleteness:
    def test_passes_with_matching_imports(self):
        content = """---
assumes: []
packages: {}
files: []
env: {}
ci_placeholders: {}
clean: {}
gitignore: []
---

```tsx
import { Button } from "@/components/ui/button"

export function Page() {
  return <Button>Click</Button>
}
```
"""
        errors = vs.check_1_import_completeness({"test.md": content})
        assert errors == []

    def test_fails_with_missing_import(self):
        content = """---
assumes: []
---

```tsx
export function Page() {
  return <Button>Click</Button>
}
```
"""
        errors = vs.check_1_import_completeness({"test.md": content})
        assert len(errors) == 1
        assert "Button" in errors[0]

    def test_passes_with_local_definition(self):
        content = """---
assumes: []
---

```tsx
function MyComponent() {
  return <div>test</div>
}

export function Page() {
  return <MyComponent />
}
```
"""
        errors = vs.check_1_import_completeness({"test.md": content})
        assert errors == []

    def test_passes_with_builtin_component(self):
        content = """---
assumes: []
---

```tsx
export function Page() {
  return <Suspense fallback={null}><div /></Suspense>
}
```
"""
        errors = vs.check_1_import_completeness({"test.md": content})
        assert errors == []

    def test_passes_with_aliased_import(self):
        content = """---
assumes: []
---

```tsx
import { Card as MyCard } from "@/components"

export function Page() {
  return <MyCard />
}
```
"""
        errors = vs.check_1_import_completeness({"test.md": content})
        assert errors == []


# ---------------------------------------------------------------------------
# Check 5: Conditional Dependency References
# ---------------------------------------------------------------------------


class TestCheck5ConditionalDependencyRefs:
    def test_passes_with_guard(self):
        content = """---
type: code-writing
reads: []
stack_categories: []
requires_approval: false
references: []
branch_prefix: feat
modifies_specs: false
---

If `stack.database` is present, read settings from the database stack file.
"""
        errors = vs.check_5_conditional_dependency_refs({"skill.md": content})
        assert errors == []

    def test_fails_without_guard(self):
        content = """---
type: code-writing
reads: []
stack_categories: []
requires_approval: false
references: []
branch_prefix: feat
modifies_specs: false
---

Read settings from the database stack file.
"""
        errors = vs.check_5_conditional_dependency_refs({"skill.md": content})
        assert len(errors) == 1
        assert "database" in errors[0]

    def test_skips_non_optional_categories(self):
        content = """---
type: code-writing
---

Read settings from the framework stack file.
"""
        errors = vs.check_5_conditional_dependency_refs({"skill.md": content})
        assert errors == []


# ---------------------------------------------------------------------------
# Check 11: Hardcoded Provider Names Match Assumes
# ---------------------------------------------------------------------------


class TestCheck11HardcodedProviderNames:
    def test_passes_when_provider_in_assumes(self):
        content = """---
assumes:
  - payment/stripe
packages: {}
files: []
env: {}
ci_placeholders: {}
clean: {}
gitignore: []
---

```ts
import Stripe from 'stripe'
```
"""
        errors = vs.check_11_hardcoded_provider_names({
            ".claude/stacks/testing/vitest.md": content
        })
        assert errors == []

    def test_fails_when_provider_not_in_assumes(self):
        content = """---
assumes: []
packages: {}
files: []
env: {}
ci_placeholders: {}
clean: {}
gitignore: []
---

```ts
import Stripe from 'stripe'
```
"""
        errors = vs.check_11_hardcoded_provider_names({
            ".claude/stacks/testing/vitest.md": content
        })
        assert len(errors) == 1
        assert "stripe" in errors[0]

    def test_skips_own_stack_file(self):
        content = """---
assumes: []
packages: {}
files: []
env: {}
ci_placeholders: {}
clean: {}
gitignore: []
---

```ts
import Stripe from 'stripe'
```
"""
        errors = vs.check_11_hardcoded_provider_names({
            ".claude/stacks/payment/stripe.md": content
        })
        assert errors == []


# ---------------------------------------------------------------------------
# Check 16: Change Payment-Auth Dependency
# ---------------------------------------------------------------------------


class TestCheck16ChangePaymentAuth:
    def test_passes_with_auth_check(self):
        content = "When adding payment to the stack, verify payment requires auth to be present."
        errors = vs.check_16_change_payment_auth(content, "change.md")
        assert errors == []

    def test_fails_without_auth_check(self):
        content = "When adding payment to the stack, install Stripe."
        errors = vs.check_16_change_payment_auth(content, "change.md")
        assert len(errors) == 1
        assert "auth-presence" in errors[0]

    def test_passes_when_no_payment_ref(self):
        content = "This skill adds new features."
        errors = vs.check_16_change_payment_auth(content, "change.md")
        assert errors == []


# ---------------------------------------------------------------------------
# Check 17: Env Vars Prose-Frontmatter Sync
# ---------------------------------------------------------------------------


class TestCheck17EnvVarsSync:
    def test_passes_when_synced(self):
        content = """---
assumes: []
packages: {}
files: []
env:
  server:
    - STRIPE_SECRET_KEY
  client: []
ci_placeholders: {}
clean: {}
gitignore: []
---

## Environment Variables

Set `STRIPE_SECRET_KEY` in your .env file.
"""
        errors = vs.check_17_env_vars_prose_frontmatter_sync({"test.md": content})
        assert errors == []

    def test_fails_when_var_not_in_frontmatter(self):
        content = """---
assumes: []
packages: {}
files: []
env:
  server: []
  client: []
ci_placeholders: {}
clean: {}
gitignore: []
---

## Environment Variables

Set `STRIPE_SECRET_KEY` in your .env file.
"""
        errors = vs.check_17_env_vars_prose_frontmatter_sync({"test.md": content})
        assert len(errors) == 1
        assert "STRIPE_SECRET_KEY" in errors[0]


# ---------------------------------------------------------------------------
# Check 18: Change Payment-Database Dependency
# ---------------------------------------------------------------------------


class TestCheck18ChangePaymentDatabase:
    def test_passes_with_database_check(self):
        content = """
#### Feature constraints

When adding payment stack, verify that stack.database is also present.
"""
        errors = vs.check_18_change_payment_database(content, "change.md")
        assert errors == []

    def test_fails_without_database_check(self):
        content = """
#### Feature constraints

Install the payment stack.
"""
        errors = vs.check_18_change_payment_database(content, "change.md")
        assert len(errors) == 1
        assert "database" in errors[0]


# ---------------------------------------------------------------------------
# Check 21: Packages Prose-Frontmatter Sync
# ---------------------------------------------------------------------------


class TestCheck21PackagesSync:
    def test_passes_when_synced(self):
        content = """---
assumes: []
packages:
  runtime:
    - stripe
  dev: []
files: []
env: {}
ci_placeholders: {}
clean: {}
gitignore: []
---

## Packages

```bash
npm install stripe
```
"""
        errors = vs.check_21_packages_prose_frontmatter_sync({"test.md": content})
        assert errors == []

    def test_fails_when_package_not_in_frontmatter(self):
        content = """---
assumes: []
packages:
  runtime: []
  dev: []
files: []
env: {}
ci_placeholders: {}
clean: {}
gitignore: []
---

## Packages

```bash
npm install stripe
```
"""
        errors = vs.check_21_packages_prose_frontmatter_sync({"test.md": content})
        assert len(errors) == 1
        assert "stripe" in errors[0]


# ---------------------------------------------------------------------------
# Check 33: Phantom Event Names
# ---------------------------------------------------------------------------


class TestCheck33PhantomEventNames:
    def test_passes_when_event_defined(self):
        content = """---
type: code-writing
reads: []
stack_categories: []
requires_approval: false
references: []
branch_prefix: feat
modifies_specs: false
---

Fire the `visit_landing` event when the page loads.
"""
        defined = {"visit_landing", "signup_start"}
        errors = vs.check_33_phantom_event_names(
            {"skill.md": content}, defined, set(), set()
        )
        assert errors == []

    def test_fails_when_event_not_defined(self):
        content = """---
type: code-writing
---

Fire the `nonexistent_event` event when done.
"""
        errors = vs.check_33_phantom_event_names(
            {"skill.md": content}, set(), set(), set()
        )
        assert len(errors) == 1
        assert "nonexistent_event" in errors[0]

    def test_skips_known_non_event_tokens(self):
        content = """---
type: code-writing
---

The `payment` event category in the analytics stack.
"""
        errors = vs.check_33_phantom_event_names(
            {"skill.md": content}, set(), set(), set()
        )
        assert errors == []


# ---------------------------------------------------------------------------
# Check 38: Ads.yaml Schema Validation
# ---------------------------------------------------------------------------


class TestCheck38AdsYamlSchema:
    def test_passes_with_valid_google_ads(self):
        ads = {
            "channel": "google-ads",
            "campaign_name": "test-campaign",
            "project_name": "test",
            "landing_url": "https://example.com",
            "budget": {"total_budget_cents": 10000},
            "targeting": {"location": "US"},
            "conversions": {"goal": "signup"},
            "guardrails": {"max_cpc_cents": 100},
            "thresholds": {
                "expected_activations": 10,
                "go_signal": "CPA < $5",
                "no_go_signal": "CPA > $20",
            },
            "keywords": {
                "exact": ["a", "b", "c"],
                "phrase": ["d", "e"],
                "broad": ["f"],
                "negative": ["g", "h"],
            },
            "ads": [
                {"headlines": ["h1", "h2", "h3", "h4", "h5"], "descriptions": ["d1", "d2"]},
                {"headlines": ["h1", "h2", "h3", "h4", "h5"], "descriptions": ["d1", "d2"]},
            ],
        }
        errors = vs.check_38_ads_yaml_schema(ads, "ads.yaml")
        assert errors == []

    def test_fails_missing_required_key(self):
        ads = {"channel": "google-ads", "campaign_name": "test"}
        errors = vs.check_38_ads_yaml_schema(ads, "ads.yaml")
        assert any("missing required key" in e for e in errors)

    def test_fails_budget_too_high(self):
        ads = {
            "channel": "google-ads",
            "campaign_name": "test",
            "project_name": "test",
            "landing_url": "https://example.com",
            "budget": {"total_budget_cents": 60000},
            "targeting": {},
            "conversions": {},
            "guardrails": {"max_cpc_cents": 100},
            "thresholds": {
                "expected_activations": 10,
                "go_signal": "good",
                "no_go_signal": "bad",
            },
            "keywords": {"exact": ["a", "b", "c"], "phrase": ["d", "e"], "broad": ["f"], "negative": ["g", "h"]},
            "ads": [
                {"headlines": list("abcde"), "descriptions": ["x", "y"]},
                {"headlines": list("abcde"), "descriptions": ["x", "y"]},
            ],
        }
        errors = vs.check_38_ads_yaml_schema(ads, "ads.yaml")
        assert any("exceeds max 50000" in e for e in errors)

    def test_passes_twitter_channel(self):
        ads = {
            "channel": "twitter",
            "campaign_name": "test",
            "project_name": "test",
            "landing_url": "https://example.com",
            "budget": {"total_budget_cents": 5000},
            "targeting": {},
            "conversions": {},
            "guardrails": {},
            "thresholds": {
                "expected_activations": 5,
                "go_signal": "good",
                "no_go_signal": "bad",
            },
            "tweets": [
                {"text": "Tweet 1"},
                {"text": "Tweet 2"},
            ],
        }
        errors = vs.check_38_ads_yaml_schema(ads, "ads.yaml")
        assert errors == []

    def test_fails_twitter_too_long(self):
        ads = {
            "channel": "twitter",
            "campaign_name": "test",
            "project_name": "test",
            "landing_url": "https://example.com",
            "budget": {"total_budget_cents": 5000},
            "targeting": {},
            "conversions": {},
            "guardrails": {},
            "thresholds": {
                "expected_activations": 5,
                "go_signal": "good",
                "no_go_signal": "bad",
            },
            "tweets": [
                {"text": "x" * 281},
                {"text": "ok"},
            ],
        }
        errors = vs.check_38_ads_yaml_schema(ads, "ads.yaml")
        assert any("exceeds 280 chars" in e for e in errors)


# ---------------------------------------------------------------------------
# Check 39: Ads Campaign Name Matches idea Name
# ---------------------------------------------------------------------------


class TestCheck39AdsCampaignName:
    def test_passes_when_matching(self):
        errors = vs.check_39_ads_campaign_name(
            {"campaign_name": "test-app-v1"},
            {"name": "test-app"},
            "ads.yaml",
        )
        assert errors == []

    def test_fails_when_not_matching(self):
        errors = vs.check_39_ads_campaign_name(
            {"campaign_name": "wrong-name"},
            {"name": "test-app"},
            "ads.yaml",
        )
        assert len(errors) == 1
        assert "does not start with" in errors[0]


# ---------------------------------------------------------------------------
# Check 46: Iterate Verdict
# ---------------------------------------------------------------------------


class TestCheck46IterateVerdict:
    def test_passes_with_all_elements(self):
        content = "## Verdict\nIssue a GO or NO-GO verdict based on pace.\n"
        errors = vs.check_46_iterate_verdict(content)
        assert errors == []

    def test_fails_missing_verdict(self):
        content = "## Analysis\nLook at the data.\n"
        errors = vs.check_46_iterate_verdict(content)
        assert any("verdict" in e for e in errors)

    def test_fails_missing_go_nogo(self):
        content = "## Verdict\nDecide whether to continue based on pace.\n"
        errors = vs.check_46_iterate_verdict(content)
        assert any("GO/NO-GO" in e for e in errors)

    def test_fails_missing_pace(self):
        content = "## Verdict\nIssue a GO or NO-GO decision.\n"
        errors = vs.check_46_iterate_verdict(content)
        assert any("pace" in e for e in errors)


# ---------------------------------------------------------------------------
# Check 53: Supabase Delete Flag
# ---------------------------------------------------------------------------


class TestCheck53SupabaseDeleteFlag:
    def test_passes_with_project_ref(self):
        content = """
```bash
supabase projects delete --project-ref $REF
```
"""
        errors = vs.check_53_supabase_delete_flag({"test.md": content})
        assert errors == []

    def test_fails_without_project_ref(self):
        content = """
```bash
supabase projects delete $REF
```
"""
        errors = vs.check_53_supabase_delete_flag({"test.md": content})
        assert len(errors) == 1
        assert "--project-ref" in errors[0]

    def test_skips_files_without_supabase_delete(self):
        content = """
```bash
echo "hello"
```
"""
        errors = vs.check_53_supabase_delete_flag({"test.md": content})
        assert errors == []


# ---------------------------------------------------------------------------
# Subprocess integration test — runs the full validator
# ---------------------------------------------------------------------------


class TestValidateSemanticsSubprocess:
    def test_runs_without_crash(self):
        """Verify the validator script runs to completion on the real template."""
        result = subprocess.run(
            ["python3", "scripts/validate-semantics.py"],
            capture_output=True,
            text=True,
        )
        # May have pre-existing errors, but should not crash
        assert result.returncode in (0, 1)
        assert "error" not in result.stderr.lower() or "FAIL:" in result.stderr
