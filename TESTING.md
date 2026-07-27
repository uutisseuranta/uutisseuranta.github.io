# TESTING.md — Uutisseuranta Testausstrategia

Tämä dokumentti kuvaa uutisseuranta.github.io -projektin testausstrategian, workflow-rakenteen ja laadunvarmistuksen. Lue myös [STANDARDS.md](STANDARDS.md), [CODE_CONVENTIONS.md](CODE_CONVENTIONS.md) ja [TECHNICAL_DESIGN.md](TECHNICAL_DESIGN.md).

---

## 1. Teknologiapino ja riippuvuudet

Projekti käyttää vanilla HTML/CSS/JavaScript + Vite -pinoa. Testaustyökalut ovat devDependencejä — ne eivät päädy tuotantobundleen.

> **Arkkitehtuuripäätös:** TECHNICAL_DESIGN.md § Testausstrategia hyväksyy Playwright- ja axe-core -testaustyökalut devDependencyinä. Kiellot koskevat sovelluskehyksiä (React, Vue jne.) ja tuotantoriippuvuuksia — eivät testausinfrastruktuuria.

**`package.json` testauksen kanssa:**

```json
{
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "test": "playwright test",
    "test:a11y": "playwright test tests/a11y/",
    "test:integration": "playwright test tests/integration/",
    "test:e2e": "playwright test tests/e2e/",
    "test:visual": "playwright test tests/visual/",
    "test:update-snapshots": "playwright test tests/visual/ --update-snapshots"
  },
  "devDependencies": {
    "vite": "^8.1.5",
    "vite-plugin-pwa": "^1.3.0",
    "@playwright/test": "^1.45.0",
    "@axe-core/playwright": "^4.9.1",
    "@lhci/cli": "^0.14.0"
  }
}
```

**Asennus:**

```bash
npm install --save-dev @playwright/test @axe-core/playwright @lhci/cli
npx playwright install --with-deps chromium
```

---

## 2. Testauspyramidi

```
            /     \
           /  E2E  \   ← smoke (live-sivusto, post-deploy)
          /─────────\
         /  A11Y     \  ← axe-core/Playwright, WCAG 2.2 AA (PR)
        /─────────────\
       /  INTEGRAATIO  \ ← page.route API-mock (PR)
      /─────────────────\
     /    STAATTINEN     \ ← Vite build + lychee (PR)
    /─────────────────────\
```

| Kerros | Työkalu | Triggeröinti |
|---|---|---|
| Staattinen | Vite build, lychee | Jokainen PR |
| Integraatio | Playwright + `page.route` | Jokainen PR |
| A11y | `@axe-core/playwright` | Jokainen PR |
| E2E smoke | Playwright (Chromium) | Post-deploy |
| Suorituskyky | Lighthouse CI | Viikoittain + `workflow_dispatch` |
| Visuaalinen regressio | Playwright screenshot | Isoissa CSS-muutoksissa (manuaali) |

> **A11y-rajoitus:** Automaattiset työkalut kattavat noin 30–40 % WCAG-kriteereistä. Manuaalinen testaus näppäimistöllä ja ruudunlukijalla (VoiceOver/NVDA) on pakollinen täydennys.

---

## 3. `playwright.config.js`

```javascript
import { defineConfig } from '@playwright/test';

export default defineConfig({
  // PR-testeissä: käynnistää paikallinen Vite preview.
  // Post-deploy-testeissä: EFFECTIVE_URL asetettu → ei paikallista serveriä.
  webServer: process.env.EFFECTIVE_URL ? undefined : {
    command: 'npm run build && npm run preview',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  use: {
    baseURL: process.env.EFFECTIVE_URL ?? 'http://localhost:4173',
  },
  retries: process.env.CI ? 2 : 0,
  reporter: [['html', { outputFolder: 'playwright-report', open: 'never' }]],
  testDir: './tests',
});
```

> `npm run preview` vaatii valmiin `dist/`-kansion — siksi `build && preview`, ei pelkkä `preview`.

---

## 4. Testit

### 4.1 Integraatiotestit — `tests/integration/api-mock.spec.js`

`page.route` sieppaa `/ap/outbox`-pyynnöt selaintasolla ennen verkkoa. Ei lisäpaketteja, toimii identtisesti paikallisesti ja CI:ssä.

```javascript
import { test, expect } from '@playwright/test';

const MOCK_OUTBOX = {
  '@context': 'https://www.w3.org/ns/activitystreams',
  type: 'OrderedCollection',
  totalItems: 2,
  orderedItems: [
    {
      type: 'Article',
      id: 'https://uutisseuranta.net/articles/1',
      name: 'Testi-uutinen yksi',
      url: 'https://example.com/uutinen-1',
      tag: [{ type: 'Hashtag', name: '#teknologia' }],
    },
    {
      type: 'Article',
      id: 'https://uutisseuranta.net/articles/2',
      name: 'Testi-uutinen kaksi',
      url: 'https://example.com/uutinen-2',
      tag: [{ type: 'Hashtag', name: '#tiede' }],
    },
  ],
};

test.describe('Integraatiotestit — API mock', () => {
  test.beforeEach(async ({ page }) => {
    // Rekisteröi mock ENNEN goto():ta
    await page.route('**/ap/outbox**', route =>
      route.fulfill({
        status: 200,
        contentType: 'application/activity+json',
        body: JSON.stringify(MOCK_OUTBOX),
      }),
    );
  });

  test('uutisvirta renderöityy mock-datalla', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('Testi-uutinen yksi')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('Testi-uutinen kaksi')).toBeVisible();
  });

  test('tagi-suodatus toimii', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /#teknologia/i }).click();
    await expect(page.getByText('Testi-uutinen yksi')).toBeVisible();
    await expect(page.getByText('Testi-uutinen kaksi')).not.toBeVisible();
  });

  test('Error Boundary: 500-vastaus näyttää virhetilanteen', async ({ page }) => {
    await page.route('**/ap/outbox**', route =>
      route.fulfill({ status: 500, body: 'Internal Server Error' }),
    );
    await page.goto('/');
    await expect(
      page.getByRole('alert').or(page.getByText(/virhe|error|ei voitu ladata/i)),
    ).toBeVisible({ timeout: 10_000 });
  });

  test('tyhjä uutisvirta näyttää empty state', async ({ page }) => {
    await page.route('**/ap/outbox**', route =>
      route.fulfill({
        status: 200,
        contentType: 'application/activity+json',
        body: JSON.stringify({ ...MOCK_OUTBOX, totalItems: 0, orderedItems: [] }),
      }),
    );
    await page.goto('/');
    await expect(
      page.getByText(/ei uutisia|no articles|tyhjä/i).or(page.locator('[data-empty-state]')),
    ).toBeVisible({ timeout: 10_000 });
  });
});
```

### 4.2 A11y — `tests/a11y/accessibility.spec.js`

```javascript
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('Saavutettavuus — WCAG 2.2 AA', () => {
  test('etusivu: ei WCAG-rikkomuksia', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('body')).toBeVisible();
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
      .analyze();
    if (results.violations.length > 0) {
      console.error('a11y-rikkomukset:', JSON.stringify(
        results.violations.map(v => ({
          id: v.id, impact: v.impact,
          description: v.description,
          nodes: v.nodes.map(n => n.html),
        })), null, 2,
      ));
    }
    expect(results.violations).toEqual([]);
  });

  test('teemanvaihtaja ei riko a11y:ta', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /vaihda teema/i }).click();
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();
    expect(results.violations).toEqual([]);
  });
});
```

**Manuaalinen a11y-tarkistuslista** (automaatio kattaa ~30–40 % WCAG-kriteereistä):

| Tarkistus | Työkalu | Tiheys |
|---|---|---|
| Näppäimistönavigointi (Tab, Enter, Esc) | Selain | Jokainen uusi komponentti |
| Ruudunlukija | VoiceOver / NVDA | Merkittävät muutokset |
| Värikontrasti (WCAG 1.4.3) | WebAIM Contrast Checker | Designmuutokset |
| Zoom 200 % (WCAG 1.4.4) | Selain | Layoutmuutokset |

### 4.3 E2E Smoke — `tests/e2e/smoke.spec.js`

```javascript
import { test, expect } from '@playwright/test';

test.describe('Uutisseuranta — smoke', () => {
  test('artikkelikortit latautuvat', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.article-card').first()).toBeVisible({ timeout: 10_000 });
  });

  test('konsolissa ei JS- tai CORS-virheitä', async ({ page }) => {
    // Rekisteröi kuuntelija ENNEN goto():ta
    const errors = [];
    page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
    page.on('pageerror', err => errors.push(err.message));
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    expect(errors, `Konsolin virheet: ${errors.join(', ')}`).toHaveLength(0);
  });

  test('teemanvaihtaja toimii', async ({ page }) => {
    await page.goto('/');
    const html = page.locator('html');
    const before = await html.getAttribute('data-theme');
    await page.getByRole('button', { name: /vaihda teema|toggle theme/i }).click();
    expect(await html.getAttribute('data-theme')).not.toEqual(before);
  });

  test('kirjautumismodaali avautuu', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /kirjaudu|login/i }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
  });
});
```

### 4.4 Visuaalinen regressio — `tests/visual/snapshot.spec.js`

Aja vain merkittävien CSS-muutosten yhteydessä. Baseline päivitetään tietoisesti:

```bash
npm run test:update-snapshots
```

```javascript
import { test, expect } from '@playwright/test';

for (const [theme, label] of [['light', 'vaalea'], ['dark', 'tumma']]) {
  test(`etusivu — ${label} teema`, async ({ page }) => {
    await page.goto('/');
    await page.evaluate(t => document.documentElement.setAttribute('data-theme', t), theme);
    await expect(page.locator('.article-card').first()).toBeVisible({ timeout: 10_000 });
    await expect(page).toHaveScreenshot(`homepage-${theme}.png`, {
      maxDiffPixelRatio: 0.02, fullPage: true,
    });
  });
}

test('etusivu — mobiili (390px)', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.locator('.article-card').first()).toBeVisible({ timeout: 10_000 });
  await expect(page).toHaveScreenshot('homepage-mobile.png', {
    maxDiffPixelRatio: 0.02, fullPage: true,
  });
});
```

Baseline-kuvakaappaukset tallennetaan `tests/visual/__snapshots__/` — git-seurannassa, näkyvät PR-diffissä.

---

## 5. GitHub Actions -rakenne

### 5.1 Tietoturva: SHA-pinnat ja minimioikeudet

Kaikki kolmannen osapuolen actionit lukitaan commit-hasheihin, ei tageihin ([GitHub Actions Security Hardening](https://docs.github.com/en/actions/security-for-github-actions/security-guides/security-hardening-for-github-actions)):

```yaml
# Oikein — SHA-pinnattu:
- uses: actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683  # v4.2.2
# Väärin — tagi voi liikkua:
- uses: actions/checkout@v4
```

Jokaisessa workflowssa minimioikeudet:

```yaml
permissions:
  contents: read
```

### 5.2 Playwright-välimuisti

> **Playwright-tiimi [ei suosittele](https://playwright.dev/docs/ci#caching-browsers) selainbinaarin välimuistamista** yleisesti — cache-miss vaatii silti täydellisen latauksen ja lisää kompleksisuutta. Yksinkertaisin CI on ajaa `npx playwright install --with-deps chromium` aina. Ota välimuisti käyttöön vasta jos CI-aika on mitattavasti ongelma.

Jos välimuisti otetaan käyttöön (issue #80):

```yaml
- name: Cache Playwright browsers
  id: playwright-cache
  uses: actions/cache@5a3ec84eff668545956fd18022155c47e93e2684  # v4.2.3
  with:
    path: ~/.cache/ms-playwright
    key: ${{ runner.os }}-playwright-${{ hashFiles('package-lock.json') }}

- name: Install Playwright Chromium
  if: steps.playwright-cache.outputs.cache-hit != 'true'
  run: npx playwright install --with-deps chromium
```

### 5.3 PR-validointi (`pr-validate.yml`)

Kaikki jobit ajetaan **rinnakkain** — ei `needs:`-riippuvuuksia. Playwright-jobit (`accessibility`, `integration`) jakavat saman rakenteen: `checkout → setup-node → npm ci → install chromium → test`.

```yaml
name: PR Validate
on:
  pull_request:
    branches: [main]

jobs:
  build:
    runs-on: ubuntu-latest
    permissions:
      contents: read
    steps:
      - uses: actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683  # v4.2.2
      - uses: actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020  # v4.2.0
        with: { node-version: 20, cache: npm }
      - run: npm ci
      - run: npm run build

  dependency-review:
    runs-on: ubuntu-latest
    permissions:
      contents: read
    steps:
      - uses: actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683  # v4.2.2
      - uses: actions/dependency-review-action@38ecb5b593bf0eb19e335c03a4f2a0bdd9f54e32  # v4.7.1
        with:
          fail-on-severity: moderate

  link-check:
    runs-on: ubuntu-latest
    permissions:
      contents: read
    steps:
      - uses: actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683  # v4.2.2
      - uses: lycheeverse/lychee-action@f81112d0d2814ded911bd23654d47b02e9b2c8f0  # v2.4.1
        with:
          args: >
            --verbose --no-progress
            --exclude 'localhost' --exclude 'example\.com'
            '**/*.md' '**/*.html'
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}

  accessibility:
    runs-on: ubuntu-latest
    permissions:
      contents: read
    steps:
      - uses: actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683  # v4.2.2
      - uses: actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020  # v4.2.0
        with: { node-version: 20, cache: npm }
      - run: npm ci
      - run: npx playwright install --with-deps chromium
      - run: npm run test:a11y
        env: { CI: true }
      - uses: actions/upload-artifact@b4b15b8c7c6ac21ea2af6b81c8a70187a9dad191  # v4.4.3
        if: failure()
        with:
          name: a11y-report
          path: playwright-report/
          retention-days: 7

  integration:
    runs-on: ubuntu-latest
    permissions:
      contents: read
    steps:
      - uses: actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683  # v4.2.2
      - uses: actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020  # v4.2.0
        with: { node-version: 20, cache: npm }
      - run: npm ci
      - run: npx playwright install --with-deps chromium
      - run: npm run test:integration
        env: { CI: true }
      - uses: actions/upload-artifact@b4b15b8c7c6ac21ea2af6b81c8a70187a9dad191  # v4.4.3
        if: failure()
        with:
          name: integration-report
          path: playwright-report/
          retention-days: 7
```

### 5.4 Post-deploy Smoke (`post-deploy-test.yml`)

```yaml
name: Post-Deploy Smoke Test
on:
  workflow_run:
    workflows: ["Deploy static content to Pages"]
    types: [completed]

jobs:
  smoke-test:
    if: ${{ github.event.workflow_run.conclusion == 'success' }}
    runs-on: ubuntu-latest
    permissions:
      contents: read
    steps:
      - uses: actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683  # v4.2.2
      - uses: actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020  # v4.2.0
        with: { node-version: 20, cache: npm }
      - run: npm ci
      - name: Wait for Pages deployment
        run: bash live-smoke-test.sh
      - run: npx playwright install --with-deps chromium
      - name: Run E2E smoke tests
        run: |
          EFFECTIVE_URL=$(cat effective_url.txt 2>/dev/null || echo "https://uutisseuranta.net")
          export EFFECTIVE_URL
          npm run test:e2e
        env: { CI: true }
      - uses: actions/upload-artifact@b4b15b8c7c6ac21ea2af6b81c8a70187a9dad191  # v4.4.3
        if: failure()
        with:
          name: smoke-report
          path: playwright-report/
          retention-days: 7
```

**`live-smoke-test.sh` — polling-odotus (ei kiinteää `sleep`):**

```bash
#!/bin/bash
set -euo pipefail
TARGET_URL="${TARGET_URL:-https://uutisseuranta.net}"
MAX_RETRIES=30; SLEEP_SEC=10
echo "Odotetaan: $TARGET_URL"
for i in $(seq 1 "$MAX_RETRIES"); do
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "$TARGET_URL" || echo "000")
  if [ "$STATUS" = "200" ]; then
    echo "$TARGET_URL" > effective_url.txt; exit 0
  fi
  echo "Yritys $i/$MAX_RETRIES — HTTP $STATUS. Odotetaan ${SLEEP_SEC}s..."
  sleep "$SLEEP_SEC"
done
echo "ERROR: Sivusto ei vastannut $MAX_RETRIES yrityksen jälkeen."; exit 1
```

### 5.5 Lighthouse CI (`lighthouse.yml`)

```yaml
name: Lighthouse CI Audit
on:
  schedule:
    - cron: '0 4 * * 1'   # Maanantaisin 04:00 UTC
  workflow_dispatch:

jobs:
  lighthouse:
    runs-on: ubuntu-latest
    permissions:
      contents: read
    steps:
      - uses: actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683  # v4.2.2
      - uses: actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020  # v4.2.0
        with: { node-version: 20, cache: npm }
      - run: npm ci
      - run: npx lhci autorun
      - uses: actions/upload-artifact@b4b15b8c7c6ac21ea2af6b81c8a70187a9dad191  # v4.4.3
        if: always()
        with:
          name: lighthouse-report
          path: .lighthouseci/
          retention-days: 30
```

**`lighthouserc.json` — Core Web Vitals -budjetti:**

```json
{
  "ci": {
    "collect": {
      "url": ["https://uutisseuranta.net"],
      "numberOfRuns": 3
    },
    "assert": {
      "assertions": {
        "categories:performance":    ["error", {"minScore": 0.85}],
        "categories:accessibility":  ["error", {"minScore": 0.95}],
        "categories:best-practices": ["error", {"minScore": 0.90}],
        "categories:seo":            ["error", {"minScore": 0.90}],
        "largest-contentful-paint":  ["error", {"maxNumericValue": 2500}],
        "cumulative-layout-shift":   ["error", {"maxNumericValue": 0.1}],
        "interaction-to-next-paint": ["warn",  {"maxNumericValue": 200}],
        "first-contentful-paint":    ["warn",  {"maxNumericValue": 2000}],
        "total-blocking-time":       ["warn",  {"maxNumericValue": 300}]
      }
    },
    "upload": { "target": "temporary-public-storage" }
  }
}
```

> LCP ≤ 2 500 ms, CLS ≤ 0.1, INP ≤ 200 ms perustuvat [Googlen Core Web Vitals "Good"-luokitukseen](https://web.dev/articles/vitals). INP korvasi FID:n maaliskuussa 2024. Tarkista arvot neljännesvuosittain.

---

## 6. Flaky-testien hallinta

- Käytä `expect(locator).toBeVisible()` — ei koskaan `waitForTimeout()`.
- Suosi roolilokaattoreita (`getByRole`, `getByLabel`, `getByText`) CSS-selectorien sijaan.
- Rekisteröi `page.on('console', ...)` ja `page.on('pageerror', ...)` **ennen** `page.goto()`:ta.
- `retries: 2` CI:ssä on asetettu `playwright.config.js`:ssa.

---

## 7. Linkkitarkistus: lychee

**`.lycheeignore`:**

```
https://twitter.com
https://x.com
https://linkedin.com
```

**`lychee.toml`:**

```toml
max_retries = 3
timeout = 20
exclude_loopback = true
exclude = ["localhost", "example\\.com"]
```

---

## 8. Tiedostorakenne

```
tests/
├── a11y/
│   └── accessibility.spec.js
├── e2e/
│   └── smoke.spec.js
├── integration/
│   └── api-mock.spec.js
└── visual/
    ├── snapshot.spec.js
    └── __snapshots__/     ← baseline-kuvakaappaukset (git-seurannassa)
```

---

## 9. Raporttien säilytys

| Artefakti | Säilytysaika |
|---|---|
| Playwright HTML-raportti (epäonnistuneet) | 7 vrk |
| Lighthouse CI -raportti | 30 vrk |
| Visuaaliset baseline-kuvakaappaukset | Git-historia |

---

## 10. Tulevat testausparannukset (Roadmap)

Seuraavat testausrakenteen tiivistys- ja laajennushankkeet on avattu GitHubiin seurattaviksi:

1. **Playwright-selainten cachen käyttöönotto CI-putkessa ([Issue #80](https://github.com/uutisseuranta/uutisseuranta.github.io/issues/80)):**
   Selainbinäärien välimuistitus nopeuttaa PR-validointia ja säästää GitHub Actions -resursseja.
2. **Playwright-testikattavuuden laajennus ([Issue #81](https://github.com/uutisseuranta/uutisseuranta.github.io/issues/81)):**
   Yhdistetään visuaalinen regressiotestaus (`toHaveScreenshot`), automaattinen saavutettavuusauditointi (`@axe-core/playwright` WCAG 2.1 AA) ja offline-pyyntöjen mockaus (`page.route`) samaan testiajoon testausskenaarioiden tiivistämiseksi.

---

## 11. Viitteet

- [Playwright: Best Practices](https://playwright.dev/docs/best-practices)
- [Playwright: Accessibility Testing](https://playwright.dev/docs/accessibility-testing)
- [Playwright: Mock APIs (page.route)](https://playwright.dev/docs/mock)
- [Playwright: Screenshot Comparison](https://playwright.dev/docs/screenshots)
- [Playwright: webServer](https://playwright.dev/docs/test-webserver)
- [Playwright: Caching browsers in CI](https://playwright.dev/docs/ci#caching-browsers)
- [GitHub Actions: Security Hardening](https://docs.github.com/en/actions/security-for-github-actions/security-guides/security-hardening-for-github-actions)
- [GitHub: Dependency Review Action](https://github.com/actions/dependency-review-action)
- [OpenSSF: Securing CI/CD Pipelines](https://openssf.org/blog/2025/06/11/maintainers-guide-securing-ci-cd-pipelines-after-the-tj-actions-and-reviewdog-supply-chain-attack/)
- [OWASP: CI/CD Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/CI_CD_Security_Cheat_Sheet.html)
- [Lighthouse CI](https://github.com/GoogleChrome/lighthouse-ci)
- [Google Core Web Vitals](https://web.dev/articles/vitals)
- [axe-core](https://github.com/dequelabs/axe-core)
- [WCAG 2.2 (W3C)](https://www.w3.org/TR/WCAG22/)
- [lychee](https://lychee.cli.rs)
- [STANDARDS.md](STANDARDS.md)
- [CODE_CONVENTIONS.md](CODE_CONVENTIONS.md)
- [TECHNICAL_DESIGN.md](TECHNICAL_DESIGN.md)
