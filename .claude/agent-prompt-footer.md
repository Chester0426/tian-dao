<!-- DIRECTIVES:batch_search,pr_changed_first,context_digest,pre_existing -->

## Efficiency Directives
1. **Batch searches**: Use Grep with glob patterns (e.g., `glob: "src/**/*.tsx"`) instead of reading files one by one.
2. **PR-changed files first**: Check files from `git diff --name-only $(git merge-base HEAD main)...HEAD` before scanning the full source tree.
3. **Context digest**: [Provided above — pages, behavior IDs, event names, golden_path steps from experiment.yaml]
4. **Pre-existing changes**: Edit-capable agents should ignore pre-existing uncommitted changes outside the PR file boundary.
