# Project Specific Rules & Decisions Alignment

You must adhere to the following workspace rules in all interactions:

## 1. PR-First Development Flow
- **No Direct main Commits**: Never develop or commit release-targeted changes directly to the `main` branch.
- **Draft PRs Early**: Create a branch, push it, and open a Pull Request (or Draft PR) early in the development lifecycle to allow automated build/deploy to the GCP environment (skeletal deploy) before merging.
- **Standards Update**: Run `generate-standards.sh` to update `STANDARDS.md` in the same commit chain whenever schema files (`*.schema.json`) are modified, before creating the Pull Request.

## 2. GitHub CLI & Token Configuration
- **Clear GITHUB_TOKEN for Local Commands**: The environment variable `GITHUB_TOKEN` is automatically set to a dummy token in the agent's sandbox. When running `gh` commands (e.g., `gh pr create`, `gh auth status`), always prepend `GITHUB_TOKEN=` to clear it and allow `gh` to fall back to the developer's valid local keychain token.

## 3. No Local Mocks for Cloud Data and Security
- **Real GCP Runs**: Do not test or execute data enrichment pipelines (e.g., `voikko-job`, `og-enrichment-job`) using local mock data or local emulators. Verify changes by executing actual runs on Cloud Run / BigQuery in GCP before PR approval.
- **Authentic Security Paths**: Never use mock security paths or random test cases for security-critical authentication or deployment testing (Decision G-014).

## 4. Autonomous Execution & Holistic Planning
- **Single Comprehensive Plan**: Create one holistic implementation plan covering all related changes (code, documentation updates, tests, and deployment). Do not split a single task into fragmented micro-plans or request intermediate approvals for obvious follow-up steps (e.g. updating decision logs).
- **Autonomous End-to-End Execution**: Once the user approves the implementation plan, execute the entire pipeline autonomously to completion (code edits -> tests -> commit -> push -> PR/merge -> deployment verification) without asking for intermediate permissions.
- **Pure Text for Conceptual Questions**: Answer conceptual and explanatory questions strictly in visible text without invoking file modification tools.

## 5. Zero-Friction Execution & Terminal Best Practices
- **Never Use Ad-Hoc Inline Scripts with BypassSandbox**: Do NOT run `python3 -c "..."` or arbitrary one-line scripts with `BypassSandbox: true`. This breaks the IDE's "Always allow" command prefix cache and spams the user with approval prompts.
- **Prefer Native MCP Tools**: Perform GitHub operations (PR creation, merging, issue updates, status checking) directly via `github-mcp-local` MCP tools, which run silently in the background without terminal prompts.
- **Standard Sandboxed Execution**: Run build, test, lint, and file operations inside the default sandbox (`BypassSandbox: false`), which executes instantly without user confirmation dialogs.
