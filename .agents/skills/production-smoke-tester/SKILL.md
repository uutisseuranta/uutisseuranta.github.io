---
name: production-smoke-tester
description: Executes live HTTP smoke checks against production (https://uutisseuranta.net) to verify HTML response, status codes, referenced JS bundles, and PWA assets. Use after deployments.
---

# Production Smoke Tester

This skill validates the live production deployment quickly and deterministically via Python HTTP requests without requiring browser emulation or manual token-heavy page scraping.

## When to Use
- After a PR is merged to `main` and deployed to GitHub Pages.
- To verify that a new asset hash is responding and active in production.
- To audit the availability of the production application.

## How to Execute
Default production target:
```bash
python3 .agents/skills/production-smoke-tester/scripts/smoke_test_production.py
```

Custom URL target:
```bash
python3 .agents/skills/production-smoke-tester/scripts/smoke_test_production.py https://uutisseuranta.net
```

## Checks Performed
1. Base HTML status `200 OK` and core DOM anchors (`#feed-grid`, `#btn-login`).
2. Live HTTP status of all referenced JavaScript modules and vendor chunks.
3. Availability of PWA assets (`/manifest.webmanifest`, `/sw.js`).
