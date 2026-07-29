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
