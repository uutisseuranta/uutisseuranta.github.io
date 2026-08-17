#!/usr/bin/env python3
"""
smoke_test_production.py - Performs live HTTP smoke tests against production (or custom URL), validating HTML status, CSP headers, referenced JS modules, and PWA assets.
"""
import sys
import re
import urllib.request
import urllib.error
from urllib.parse import urljoin
from typing import List, Tuple

DEFAULT_URL = "https://uutisseuranta.net"

def fetch_url(url: str, headers: dict = None) -> Tuple[int, str, dict]:
    req = urllib.request.Request(
        url,
        headers=headers or {
            "User-Agent": "AntigravitySmokeTester/1.0",
            "Accept": "*/*"
        }
    )
    with urllib.request.urlopen(req, timeout=10) as resp:
        content = resp.read().decode("utf-8", errors="replace")
        res_headers = {k.lower(): v for k, v in resp.getheaders()}
        return resp.status, content, res_headers

def smoke_test(base_url: str = DEFAULT_URL) -> int:
    print(f"🔎 Running live smoke tests against: {base_url}")
    errors = []

    # 1. Test Base HTML
    try:
        status, html, headers = fetch_url(base_url)
        if status != 200:
            errors.append(f"Base URL returned HTTP {status}, expected 200.")
        else:
            print(f"  ✅ Base HTML fetched (HTTP 200, {len(html)} bytes)")

        # Verify key elements
        if "id=\"feed-grid\"" not in html:
            errors.append("Base HTML is missing #feed-grid element.")
        if "id=\"btn-login\"" not in html:
            errors.append("Base HTML is missing #btn-login element.")

        # 2. Extract and test referenced JS modules and assets
        js_modules = re.findall(r'<script\s+[^>]*src="([^"]+)"', html)
        module_preloads = re.findall(r'<link\s+[^>]*href="([^"]+\.js)"', html)
        all_scripts = set(js_modules + module_preloads)

        for script_src in all_scripts:
            full_src_url = urljoin(base_url, script_src)
            try:
                s_status, s_body, s_headers = fetch_url(full_src_url)
                if s_status == 200:
                    print(f"  ✅ Script {script_src} OK (HTTP 200, {len(s_body)} bytes)")
                else:
                    errors.append(f"Script '{script_src}' returned HTTP {s_status}.")
            except Exception as e:
                errors.append(f"Failed to fetch script '{script_src}': {e}")

        # 3. Test Manifest & Service Worker
        for pwa_asset in ["/manifest.webmanifest", "/sw.js"]:
            full_asset_url = urljoin(base_url, pwa_asset)
            try:
                a_status, a_body, _ = fetch_url(full_asset_url)
                if a_status == 200:
                    print(f"  ✅ PWA asset {pwa_asset} OK (HTTP 200)")
                else:
                    errors.append(f"PWA asset '{pwa_asset}' returned HTTP {a_status}.")
            except Exception as e:
                errors.append(f"Failed to fetch PWA asset '{pwa_asset}': {e}")

    except Exception as e:
        errors.append(f"Fatal connection error to {base_url}: {e}")

    if errors:
        print(f"\n❌ Smoke test failed with {len(errors)} errors:", file=sys.stderr)
        for err in errors:
            print(f"  - {err}", file=sys.stderr)
        return 1

    print("\n✅ All production smoke tests passed successfully.")
    return 0

if __name__ == "__main__":
    target = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_URL
    sys.exit(smoke_test(target))
