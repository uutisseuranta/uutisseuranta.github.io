#!/usr/bin/env python3
"""
lint_repo_files.py - Enforces repository hygiene rules (forbidden filenames, forbidden extensions, .env files, character conventions).
"""
import sys
import re
import subprocess
from pathlib import Path
from typing import List, Tuple

FORBIDDEN_EXACT_NAMES = {"TODO.md", "FIXME.md"}
FORBIDDEN_PREFIXES = ("temp-", "tmp-", "test-copy-", "copy-of-", "backup-")
FORBIDDEN_EXTENSIONS = {".bak", ".tmp", ".orig", ".swp", ".swo"}
ALLOWED_SPECIAL_CHARS = re.compile(r"^[a-zA-Z0-9_.\-/]+$")

def get_target_files(repo_root: Path, check_all: bool = False) -> List[str]:
    if check_all:
        try:
            out = subprocess.check_output(["git", "ls-files"], cwd=repo_root, text=True)
            return [line.strip() for line in out.splitlines() if line.strip()]
        except Exception:
            return [str(p.relative_to(repo_root)) for p in repo_root.rglob("*") if p.is_file() and not str(p).startswith(str(repo_root / ".git"))]

    # Otherwise check changed files (staged or unstaged vs origin/main)
    files = set()
    try:
        diff_out = subprocess.check_output(["git", "diff", "--name-only", "origin/main...HEAD"], cwd=repo_root, text=True)
        files.update(line.strip() for line in diff_out.splitlines() if line.strip())
    except Exception:
        pass

    try:
        status_out = subprocess.check_output(["git", "status", "--porcelain"], cwd=repo_root, text=True)
        for line in status_out.splitlines():
            if line.strip():
                parts = line.strip().split(maxsplit=1)
                if len(parts) == 2:
                    files.add(parts[1].strip())
    except Exception:
        pass

    return sorted(files)

def lint_files(repo_root: Path, files: List[str]) -> Tuple[int, List[str]]:
    errors = []
    
    for file_path_str in files:
        file_path = Path(file_path_str)
        basename = file_path.name
        
        # 1. Check Character Conventions
        if not ALLOWED_SPECIAL_CHARS.match(file_path_str):
            errors.append(f"Forbidden characters in path: '{file_path_str}'")

        # 2. Check Forbidden Filenames
        if basename in FORBIDDEN_EXACT_NAMES:
            errors.append(f"Forbidden filename: '{file_path_str}'")
        if any(basename.startswith(prefix) for prefix in FORBIDDEN_PREFIXES):
            errors.append(f"Forbidden prefix in filename: '{file_path_str}'")

        # 3. Check Forbidden Extensions
        if file_path.suffix.lower() in FORBIDDEN_EXTENSIONS or basename == ".DS_Store":
            errors.append(f"Forbidden extension: '{file_path_str}'")

        # 4. Check Secret .env files (allow .env.example and .env.template)
        if basename == ".env" or (basename.startswith(".env.") and basename not in {".env.example", ".env.template"}):
            errors.append(f"Forbidden secret file committed: '{file_path_str}'")

    return (1 if errors else 0, errors)

def main() -> int:
    repo_root = Path(__file__).resolve().parent.parent.parent.parent.parent
    check_all = "--all" in sys.argv
    target_files = get_target_files(repo_root, check_all=check_all)

    if not target_files:
        print("✅ No files to check.")
        return 0

    code, errors = lint_files(repo_root, target_files)
    if code != 0:
        print(f"❌ Repo hygiene check failed ({len(errors)} issues):", file=sys.stderr)
        for err in errors:
            print(f"  - {err}", file=sys.stderr)
        return 1

    print(f"✅ Repo hygiene OK ({len(target_files)} files checked).")
    return 0

if __name__ == "__main__":
    sys.exit(main())
