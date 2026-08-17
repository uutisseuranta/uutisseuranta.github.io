#!/usr/bin/env python3
"""
verify_bundle.py - Executes production build, validates generated chunks against performance budgets, and verifies PWA assets.
"""
import sys
import json
import subprocess
from pathlib import Path

MAX_TOTAL_BUNDLE_KB = 1500  # Total dist folder budget (1.5 MB)
MAX_ENTRY_CHUNK_KB = 100   # Main entry chunk budget (100 kB)
REQUIRED_PWA_FILES = ["manifest.webmanifest", "sw.js", "registerSW.js"]

def verify_bundle(repo_root: Path) -> int:
    print("🚀 Running production build (vite build)...")
    try:
        build_proc = subprocess.run(
            ["npm", "run", "build"],
            cwd=repo_root,
            capture_output=True,
            text=True,
            check=True
        )
    except subprocess.CalledProcessError as e:
        print(f"❌ Build failed with exit code {e.returncode}:", file=sys.stderr)
        print(e.stderr or e.stdout, file=sys.stderr)
        return 1

    dist_dir = repo_root / "dist"
    if not dist_dir.exists():
        print(f"❌ Error: {dist_dir} does not exist after build.", file=sys.stderr)
        return 1

    errors = []
    
    # 1. Verify PWA files
    for pwa_file in REQUIRED_PWA_FILES:
        target = dist_dir / pwa_file
        if not target.exists():
            errors.append(f"Missing required PWA file: 'dist/{pwa_file}'")

    # 2. Check chunk sizes in dist/assets
    assets_dir = dist_dir / "assets"
    total_size_bytes = 0
    main_chunk_size_kb = 0
    chunks_summary = []

    if assets_dir.exists():
        for asset in sorted(assets_dir.glob("*")):
            if asset.is_file():
                size_bytes = asset.stat().st_size
                total_size_bytes += size_bytes
                size_kb = size_bytes / 1024.0
                chunks_summary.append((asset.name, size_kb))
                
                if asset.name.startswith("main-") and asset.suffix == ".js":
                    main_chunk_size_kb = size_kb
                    if size_kb > MAX_ENTRY_CHUNK_KB:
                        errors.append(f"Main entry chunk 'dist/assets/{asset.name}' is {size_kb:.2f} kB (exceeds {MAX_ENTRY_CHUNK_KB} kB budget).")

    total_kb = total_size_bytes / 1024.0
    if total_kb > MAX_TOTAL_BUNDLE_KB:
        errors.append(f"Total bundle size is {total_kb:.2f} kB (exceeds {MAX_TOTAL_BUNDLE_KB} kB budget).")

    print("\n📦 Bundle Chunks Summary:")
    for name, sz in chunks_summary:
        print(f"  - {name:<45} {sz:>8.2f} kB")
    print(f"  {'Total Assets':<45} {total_kb:>8.2f} kB\n")

    if errors:
        print(f"❌ Bundle verification failed ({len(errors)} errors):", file=sys.stderr)
        for err in errors:
            print(f"  - {err}", file=sys.stderr)
        return 1

    print(f"✅ Bundle verification passed (main entry: {main_chunk_size_kb:.2f} kB, total: {total_kb:.2f} kB).")
    return 0

if __name__ == "__main__":
    repo_root = Path(__file__).resolve().parent.parent.parent.parent.parent
    sys.exit(verify_bundle(repo_root))
