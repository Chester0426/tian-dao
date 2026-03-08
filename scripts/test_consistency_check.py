"""Tests for consistency-check.sh via subprocess."""

import os
import subprocess
import textwrap

import pytest
import yaml


def run_consistency_check(cwd):
    """Run consistency-check.sh in the given directory."""
    script_path = os.path.join(
        os.path.dirname(__file__), "consistency-check.sh"
    )
    result = subprocess.run(
        ["bash", script_path],
        capture_output=True,
        text=True,
        cwd=cwd,
    )
    return result


def write_file(path, content):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w") as f:
        f.write(textwrap.dedent(content))


class TestConsistencyCheckCleanTemplate:
    """Test that the real template passes consistency checks."""

    def test_passes_on_real_template(self):
        result = subprocess.run(
            ["bash", "scripts/consistency-check.sh"],
            capture_output=True,
            text=True,
        )
        assert result.returncode == 0
        assert "PASSED" in result.stdout


class TestCheck1EventEnumerationsInClaudeMd:
    """CLAUDE.md must not enumerate event definitions inline."""

    def test_passes_when_clean(self, tmp_path):
        write_file(
            str(tmp_path / "CLAUDE.md"),
            "# Rules\nSee EVENTS.yaml for event definitions.\n",
        )
        # Need a code-writing skill to populate CODE_WRITING_SKILLS array (bash set -u)
        (tmp_path / ".claude" / "commands").mkdir(parents=True)
        write_file(
            str(tmp_path / ".claude" / "commands" / "test.md"),
            "---\ntype: code-writing\n---\nFollow patterns/verify.md.\n",
        )
        result = run_consistency_check(tmp_path)
        assert result.returncode == 0

    def test_fails_with_event_enumeration(self, tmp_path):
        write_file(
            str(tmp_path / "CLAUDE.md"),
            "# Rules\n- `visit_landing` — fires on page load\n",
        )
        (tmp_path / ".claude" / "commands").mkdir(parents=True)
        result = run_consistency_check(tmp_path)
        assert result.returncode == 1
        assert "enumerated event definitions" in result.stdout


class TestCheck3HardcodedAnalyticsPaths:
    """Skill files must not hardcode analytics import paths."""

    def test_passes_when_clean(self, tmp_path):
        (tmp_path / ".claude" / "commands").mkdir(parents=True)
        write_file(
            str(tmp_path / ".claude" / "commands" / "test.md"),
            "---\ntype: code-writing\n---\nUse the analytics library.\nFollow patterns/verify.md.\n",
        )
        write_file(str(tmp_path / "CLAUDE.md"), "# Rules\n")
        result = run_consistency_check(tmp_path)
        assert result.returncode == 0

    def test_fails_with_hardcoded_path(self, tmp_path):
        (tmp_path / ".claude" / "commands").mkdir(parents=True)
        write_file(
            str(tmp_path / ".claude" / "commands" / "test.md"),
            '---\ntype: code-writing\n---\nimport from @/lib/analytics\n',
        )
        write_file(str(tmp_path / "CLAUDE.md"), "# Rules\n")
        result = run_consistency_check(tmp_path)
        assert result.returncode == 1
        assert "hardcoded import path" in result.stdout


class TestCheck4FrameworkTermsInClaudeMd:
    """CLAUDE.md must not use framework-specific terms."""

    def test_fails_with_server_actions(self, tmp_path):
        write_file(
            str(tmp_path / "CLAUDE.md"),
            "# Rules\nUse Server Actions for mutations.\n",
        )
        (tmp_path / ".claude" / "commands").mkdir(parents=True)
        result = run_consistency_check(tmp_path)
        assert result.returncode == 1
        assert "framework-specific" in result.stdout


class TestCheck10VerifyMdInContent:
    """Code-writing skill content must reference verify.md."""

    def test_passes_when_verify_referenced(self, tmp_path):
        (tmp_path / ".claude" / "commands").mkdir(parents=True)
        write_file(
            str(tmp_path / ".claude" / "commands" / "change.md"),
            "---\ntype: code-writing\n---\nFollow patterns/verify.md for validation.\n",
        )
        write_file(str(tmp_path / "CLAUDE.md"), "# Rules\n")
        result = run_consistency_check(tmp_path)
        assert result.returncode == 0

    def test_fails_when_verify_not_referenced(self, tmp_path):
        (tmp_path / ".claude" / "commands").mkdir(parents=True)
        write_file(
            str(tmp_path / ".claude" / "commands" / "change.md"),
            "---\ntype: code-writing\n---\nBuild stuff.\n",
        )
        write_file(str(tmp_path / "CLAUDE.md"), "# Rules\n")
        result = run_consistency_check(tmp_path)
        assert result.returncode == 1
        assert "verify.md" in result.stdout


class TestCheck13ProviderNamesInHeadings:
    """Skill section headings must not hardcode analytics provider names."""

    def test_passes_when_clean(self, tmp_path):
        (tmp_path / ".claude" / "commands").mkdir(parents=True)
        write_file(
            str(tmp_path / ".claude" / "commands" / "test.md"),
            "---\ntype: code-writing\n---\n### Analytics Setup\nContent.\nFollow patterns/verify.md.\n",
        )
        write_file(str(tmp_path / "CLAUDE.md"), "# Rules\n")
        result = run_consistency_check(tmp_path)
        assert result.returncode == 0

    def test_fails_with_posthog_heading(self, tmp_path):
        (tmp_path / ".claude" / "commands").mkdir(parents=True)
        write_file(
            str(tmp_path / ".claude" / "commands" / "test.md"),
            "---\ntype: code-writing\n---\n### PostHog Setup\nContent.\n",
        )
        write_file(str(tmp_path / "CLAUDE.md"), "# Rules\n")
        result = run_consistency_check(tmp_path)
        assert result.returncode == 1
        assert "provider name" in result.stdout
