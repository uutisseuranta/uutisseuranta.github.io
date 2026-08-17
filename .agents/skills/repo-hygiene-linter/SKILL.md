---
name: repo-hygiene-linter
description: Enforces repository naming conventions, prevents forbidden files (TODO.md, temp-*, backups), forbidden extensions (.bak, .tmp, .DS_Store), and secret .env commits using a fast Python script. Run before committing or creating PRs.
---

# Repo Hygiene Linter

This skill enforces strict repo hygiene rules and filename conventions deterministically before files are staged, committed, or pushed to GitHub.

## When to Use
- Before committing any new files or modifying filenames.
- Before creating a Pull Request.
- To audit the entire repository (`--all`).

## How to Execute
Check changed/staged files:
```bash
python3 .agents/skills/repo-hygiene-linter/scripts/lint_repo_files.py
```

Check all repository files:
```bash
python3 .agents/skills/repo-hygiene-linter/scripts/lint_repo_files.py --all
```

## Rules Enforced
1. **Characters:** Only `a-zA-Z0-9_.-/` are permitted in paths.
2. **Forbidden Files:** `TODO.md`, `FIXME.md`, `temp-*`, `tmp-*`, `backup-*`, `test-copy-*`, `copy-of-*`.
3. **Forbidden Extensions:** `.bak`, `.tmp`, `.orig`, `.DS_Store`, `.swp`, `.swo`.
4. **Secrets:** `.env` and `.env.*` must never be tracked or committed.
