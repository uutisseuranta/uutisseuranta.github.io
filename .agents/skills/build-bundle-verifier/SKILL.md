---
name: build-bundle-verifier
description: Executes production Vite build, validates chunk sizes against performance budgets, and ensures required PWA assets (sw.js, manifest) are generated properly. Use before opening or merging Pull Requests.
---

# Build and Bundle Verifier

This skill runs the production build and verifies bundle sizes and PWA assets against performance budgets deterministically.

## When to Use
- Before opening a Pull Request.
- After code modifications to verify syntax and bundle efficiency.
- When validating code splitting or dependency additions.

## How to Execute
Run the Python script directly in the sandbox:
```bash
python3 .agents/skills/build-bundle-verifier/scripts/verify_bundle.py
```

## Budgets Checked
- **Main entry chunk:** Maximum 100 kB (currently ~47 kB).
- **Total assets:** Maximum 1500 kB.
- **PWA Assets:** `manifest.webmanifest`, `sw.js`, and `registerSW.js` must exist.
