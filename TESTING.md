# TESTING.md — Uutisseuranta Testausstrategia

Tämä dokumentti kuvaa uutisseuranta.github.io -projektin testausstrategian, workflow-rakenteen ja laadunvarmistuksen. Lue myös [STANDARDS.md](STANDARDS.md), [CODE_CONVENTIONS.md](CODE_CONVENTIONS.md) ja [TECHNICAL_DESIGN.md](TECHNICAL_DESIGN.md).

---

## 1. Projektin lähtötilanne

Projekti käyttää vanilla HTML/CSS/JavaScript + Vite -teknologiapinoa ilman TypeScriptiä tai erillistä testausframeworkia. `package.json` sisältää tällä hetkellä vain `vite` ja `vite-plugin-pwa` devDependenceinä sekä `firebase` ja `workbox-window` tuotantoriippuvuuksina.

Testauksen käyttöönotto tapahtuu vaiheistettuna — lisää vain se mitä oikeasti käytetään. Älä asenna paketteja ennakolta.

**Nykyinen `package.json` (ilman testausta):**

```json
{
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "devDependencies": {
    "vite": "^5.2.11",
    "vite-plugin-pwa": "^0.20.0"
  }
}
```

**Tavoitetila testauksen kanssa:**

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
    "test:update-snapshots": "playwright test tests/visual/ --update-snapshots",
    "lint": "eslint src/"
  },
  "devDependencies": {
    "vite": "^5.2.11",
    "vite-plugin-pwa": "^0.20.0",
    "@playwright/test": "^1.45.0",
    "@axe-core/playwright": "^4.9.1",
    "@lhci/cli": "^0.14.0",
    "eslint": "^9.0.0",
    "@eslint/js": "^9.0.0"
  }
}
```

---

## 2. Testauspyramidi

```
              / \
             /   \
            / E2E \  <- Playwright smoke (live-sivusto, post-deploy)
           /-------\
          /  A11Y   \ <- axe-core/Playwright (WCAG 2.2 AA, jokainen PR)
         /----------\
        /    INTEG    \ <- Playwright + page.route API-mock (jokainen PR)
       /--------------\
      /   STAATTINEN   \ <- ESLint + Vite build + lychee (jokainen PR)
     /------------------\
```

| Kerros | Työkalu | Milloin |
|---|---|---|
| Staattinen analyysi | ESLint, Vite build, lychee | Jokainen PR |
| A11y | `@axe-core/playwright` | Jokainen PR |
| Integraatio | Playwright + `page.route` | Jokainen PR |
| E2E smoke | Playwright (Chromium) | Post-deploy |
| Suorituskyky | Lighthouse CI | Viikoittain + manuaalisesti |
| Visuaalinen regressio | Playwright screenshot diff | Isoissa CSS-muutoksissa |

> **A11y-rajoitus:** Automaattiset työkalut kattavat noin 30–40 % WCAG-kriteereistä. Manuaalinen testaus näppäimistöllä ja ruudunlukijalla (VoiceOver/NVDA) on pakollinen täydennys.

---

## 3. Playwright-asennus

```bash
npm install --save-dev @playwright/test @axe-core/playwright
npx playwright install --with-deps chromium
```

**`playwright.config.js`** (projekti käyttää vanilla JS:ää, ei TypeScriptiä):

```javascript
import { defineConfig } from '@playwright/test';

export default defineConfig({
  // EFFECTIVE_URL on asetettu post-deploy-testeissä (live-sivusto).
  // PR-testeissä käynnistetään paikallinen Vite preview -serveri.
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

> **`webServer`-huomio:** `npm run preview` vaatii ensin valmiin `dist/`-kansion — siksi komento on `npm run build && npm run preview`, ei pelkkä `npm run preview`.

---

## 4. A11y-testaus: axe-core + Playwright

**`tests/a11y/accessibility.spec.js`:**

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
      console.error(
        'a11y-rikkomukset:',
        JSON.stringify(
          results.violations.map(v => ({
            id: v.id,
            impact: v.impact,
            description: v.description,
            nodes: v.nodes.map(n => n.html),
          })),
          null,
          2,
        ),
      );
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

### Manuaalinen a11y-tarkistuslista

| Tarkistus | Työkalu | Tiheys |
|---|---|---|
| Näppäimistönavigointi (Tab, Enter, Esc) | Selain | Jokainen uusi komponentti |
| Ruudunlukija | VoiceOver (macOS), NVDA (Windows) | Merkittävät muutokset |
| Värikontrasti (WCAG 1.4.3) | WebAIM Contrast Checker | Designmuutokset |
| Zoom 200 % (WCAG 1.4.4) | Selain | Layoutmuutokset |
| Fokuksen näkyvyys | Selain / DevTools | Jokainen uusi interaktiivinen elementti |

---

## 5. Integraatiotestit: API-mock `page.route`:lla

Käytä Playwright:n `page.route`-APIa `/ap/outbox`-rajapinnan sieppaamiseen. Näin testit ovat deterministisiä: ulkoisia verkkopyyntöjä ei tehdä lainkaan.

**Miksi `page.route` eikä MSW tai muu kirjasto?** Playwright:n oma `page.route` sieppaa sekä `fetch`- että XHR-pyynnöt selaintasolla, ei vaadi lisäpaketteja ja toimii identtisesti lokaali- ja CI-ympäristöissä.

**`tests/integration/api-mock.spec.js`:**

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
    // Rekisteröi mock ENNEN goto():ta — muuten pyyntö on jo lähetetty
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

  test('tyhjä uutisvirta näyttää empty state -viestin', async ({ page }) => {
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

---

## 6. E2E Smoke-testit (live-sivusto)

**`tests/e2e/smoke.spec.js`:**

```javascript
import { test, expect } from '@playwright/test';

test.describe('Uutisseuranta — smoke', () => {
  test('artikkelikortit latautuvat', async ({ page }) => {
    await page.goto('/');
    const firstCard = page.locator('.article-card').first();
    await expect(firstCard).toBeVisible({ timeout: 10_000 });
  });

  test('konsolissa ei ole JS-virheitä tai CORS-virheitä', async ({ page }) => {
    // Rekisteröi kuuntelija ENNEN goto():ta
    const errors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
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
    const after = await html.getAttribute('data-theme');
    expect(after).not.toEqual(before);
  });

  test('kirjautumismodaali avautuu', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /kirjaudu|login/i }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
  });
});
```

### Polling-skripti: `live-smoke-test.sh`

Kiinteät `sleep 60` -viiveet ovat CI/CD-anti-pattern. Käytä sen sijaan polling-logiikkaa:

```bash
#!/bin/bash
# Odottaa kunnes GitHub Pages vastaa HTTP 200 OK.
# Tallentaa toimivan URL:n effective_url.txt-tiedostoon E2E-testejä varten.
set -euo pipefail

TARGET_URL="${TARGET_URL:-https://uutisseuranta.net}"
MAX_RETRIES=30
SLEEP_SEC=10

echo "Odotetaan: $TARGET_URL"
for i in $(seq 1 "$MAX_RETRIES"); do
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "$TARGET_URL" || echo "000")
  if [ "$STATUS" = "200" ]; then
    echo "$TARGET_URL on saavutettavissa (HTTP $STATUS)"
    echo "$TARGET_URL" > effective_url.txt
    exit 0
  fi
  echo "Yritys $i/$MAX_RETRIES — HTTP $STATUS. Odotetaan ${SLEEP_SEC}s..."
  sleep "$SLEEP_SEC"
done

echo "ERROR: Sivusto ei vastannut ${MAX_RETRIES} yrityksen jälkeen."
exit 1
```

---

## 7. GitHub Actions CI/CD -rakenne

### 7.1 Tietoturva: SHA-pinnat ja minimioikeudet

Kaikki kolmannen osapuolen GitHub Actions -actionit lukitaan commit-hasheihin, ei tageihin. Katso [GitHub Actions Security Hardening](https://docs.github.com/en/actions/security-for-github-actions/security-guides/security-hardening-for-github-actions).

```yaml
# SHA-pinnattu esimerkki:
- uses: actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683  # v4.2.2
# EI näin:
- uses: actions/checkout@v4
```

Jokaisessa workflowssa:

```yaml
permissions:
  contents: read
```

### 7.2 Välimuistit

```yaml
- uses: actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020  # v4.2.0
  with:
    node-version: 20
    cache: npm
- run: npm ci

# Playwright-binaarivälimuisti (valinnainen — mittaa ensin onko tarpeen)
- name: Cache Playwright browsers
  id: playwright-cache
  uses: actions/cache@5a3ec84eff668545956fd18022155c47e93e2684  # v4.2.3
  with:
    path: ~/.cache/ms-playwright
    key: ${{ runner.os }}-ms-playwright-${{ hashFiles('package-lock.json') }}

- name: Install Playwright Chromium
  if: steps.playwright-cache.outputs.cache-hit != 'true'
  run: npx playwright install --with-deps chromium
```

> **Huomio Playwright-välimuistista:** [Playwright-tiimi ei suosittele selainbinaarin välimuistamista](https://playwright.dev/docs/ci#caching-browsers) yleisesti — cache-miss vaatii silti täydellisen latauksen. Jos CI-minuutit eivät ole kriittisiä, yksinkertaisinta on ajaa `npx playwright install --with-deps chromium` aina ilman välimuistia.

### 7.3 PR-validointi (`pr-validate.yml`)

```yaml
name: PR Validate
on:
  pull_request:
    branches: [main]

jobs:
  validate:
    runs-on: ubuntu-latest
    permissions:
      contents: read
    steps:
      - uses: actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683  # v4.2.2
      - uses: actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020  # v4.2.0
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npm run lint     # ESLint — lisää kun ESLint on asennettu
      - run: npm run build

  dependency-review:
    runs-on: ubuntu-latest
    permissions:
      contents: read
    steps:
      - uses: actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683  # v4.2.2
      - name: Dependency Review
        uses: actions/dependency-review-action@38ecb5b593bf0eb19e335c03a4f2a0bdd9f54e32  # v4.7.1
        with:
          fail-on-severity: moderate

  link-check:
    runs-on: ubuntu-latest
    permissions:
      contents: read
    steps:
      - uses: actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683  # v4.2.2
      - name: Check links with lychee
        uses: lycheeverse/lychee-action@f81112d0d2814ded911bd23654d47b02e9b2c8f0  # v2.4.1
        with:
          args: >
            --verbose
            --no-progress
            --exclude 'localhost'
            --exclude 'example\.com'
            '**/*.md'
            '**/*.html'
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}

  accessibility:
    runs-on: ubuntu-latest
    permissions:
      contents: read
    steps:
      - uses: actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683  # v4.2.2
      - uses: actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020  # v4.2.0
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npx playwright install --with-deps chromium
      - run: npm run test:a11y
        env:
          CI: true
      - name: Upload a11y report
        uses: actions/upload-artifact@b4b15b8c7c6ac21ea2af6b81c8a70187a9dad191  # v4.4.3
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
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npx playwright install --with-deps chromium
      - run: npm run test:integration
        env:
          CI: true
      - name: Upload integration report
        uses: actions/upload-artifact@b4b15b8c7c6ac21ea2af6b81c8a70187a9dad191  # v4.4.3
        if: failure()
        with:
          name: integration-report
          path: playwright-report/
          retention-days: 7
```

> **Huomio jobien rinnakkaisuudesta:** Kaikki viisi jobia ajetaan rinnakkain (ei `needs:`-riippuvuutta) CI-ajan minimoimiseksi. `dependency-review` vaatii julkisen repositorion tai GitHub Advanced Security.

### 7.4 Post-deploy Smoke (`post-deploy-test.yml`)

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
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - name: Wait for deployment
        run: bash live-smoke-test.sh
      - run: npx playwright install --with-deps chromium
      - name: Run smoke tests
        run: |
          EFFECTIVE_URL=$(cat effective_url.txt 2>/dev/null || echo "https://uutisseuranta.net")
          export EFFECTIVE_URL
          npm run test:e2e
        env:
          CI: true
      - name: Upload report
        uses: actions/upload-artifact@b4b15b8c7c6ac21ea2af6b81c8a70187a9dad191  # v4.4.3
        if: failure()
        with:
          name: smoke-report
          path: playwright-report/
          retention-days: 7
```

### 7.5 Lighthouse CI (`lighthouse.yml`)

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
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npx lhci autorun
      - name: Upload Lighthouse report
        uses: actions/upload-artifact@b4b15b8c7c6ac21ea2af6b81c8a70187a9dad191  # v4.4.3
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
        "first-contentful-paint":    ["warn",  {"maxNumericValue": 2000}],
        "largest-contentful-paint":  ["error", {"maxNumericValue": 2500}],
        "total-blocking-time":       ["warn",  {"maxNumericValue": 300}],
        "cumulative-layout-shift":   ["error", {"maxNumericValue": 0.1}],
        "interaction-to-next-paint": ["warn",  {"maxNumericValue": 200}]
      }
    },
    "upload": {
      "target": "temporary-public-storage"
    }
  }
}
```

> **Kynnysarvojen lähteet:** LCP ≤ 2 500 ms, CLS ≤ 0.1 ja INP ≤ 200 ms perustuvat Googlen Core Web Vitals "Good"-luokitukseen. INP korvasi FID:n maaliskuusta 2024 alkaen. Tarkista arvot neljännesvuosittain.

---

## 8. Visuaalinen regressiotestaus

Aja vain merkittävien CSS/layout-muutosten yhteydessä. Playwright sisältää screenshot-vertailun ilman lisäriippuvuuksia.

**`tests/visual/snapshot.spec.js`:**

```javascript
import { test, expect } from '@playwright/test';

test.describe('Visuaalinen regressio', () => {
  test('etusivu — vaalea teema', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() =>
      document.documentElement.setAttribute('data-theme', 'light'),
    );
    // Odota ensimmäistä korttia ennen kuvakaappausta
    await expect(page.locator('.article-card').first()).toBeVisible({ timeout: 10_000 });
    await expect(page).toHaveScreenshot('homepage-light.png', {
      maxDiffPixelRatio: 0.02,
      fullPage: true,
    });
  });

  test('etusivu — tumma teema', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() =>
      document.documentElement.setAttribute('data-theme', 'dark'),
    );
    await expect(page.locator('.article-card').first()).toBeVisible({ timeout: 10_000 });
    await expect(page).toHaveScreenshot('homepage-dark.png', {
      maxDiffPixelRatio: 0.02,
      fullPage: true,
    });
  });

  test('etusivu — mobiili (390px)', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    await expect(page.locator('.article-card').first()).toBeVisible({ timeout: 10_000 });
    await expect(page).toHaveScreenshot('homepage-mobile.png', {
      maxDiffPixelRatio: 0.02,
      fullPage: true,
    });
  });
});
```

Päivitä baseline tietoisesti muutoksissa:

```bash
npm run test:update-snapshots
```

Kuvakaappaukset tallennetaan repositorioon (`tests/visual/__snapshots__/`) ja näkyvät PR:n diffissä.

---

## 9. Linkkitarkistus: lychee

[lychee](https://lychee.cli.rs) on Rust-pohjainen, asynkroninen linkintarkistustyökalu joka tukee Markdown- ja HTML-tiedostoja natiivisti ja integroituu GitHub Actionsiin omana actioninaan.

**`.lycheeignore`:**

```
https://twitter.com
https://x.com
https://linkedin.com
```

**`lychee.toml` (valinnainen):**

```toml
max_retries = 3
timeout = 20
exclude_loopback = true
exclude = [
  "localhost",
  "example\\.com",
]
```

---

## 10. Flaky-testien hallinta

- Käytä `expect(locator).toBeVisible()` — ei koskaan `page.waitForTimeout()`.
- Suosi roolilokaattoreita (`getByRole`, `getByLabel`, `getByText`) XPath/CSS-selectoreiden sijaan.
- Aseta `retries: 2` CI-ympäristössä `playwright.config.js`:ssa.
- Rekisteröi `page.on('console', ...)` ja `page.on('pageerror', ...)` **ennen** `page.goto()`:ta.
- Älä käytä `.first()` ilman `await expect(...).toBeVisible()` -vahvistusta.

---

## 11. Testitiedostorakenne

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
    └── __snapshots__/          <- Baseline-kuvakaappaukset (git-seurannassa)
```

---

## 12. Raportointi

| Artefakti | Säilytysaika |
|---|---|
| Playwright HTML-raportti (epäonnistuneet) | 7 vrk |
| axe-core a11y -raportti (epäonnistuneet) | 7 vrk |
| Integraatiotestiraportti (epäonnistuneet) | 7 vrk |
| Lighthouse CI -raportti | 30 vrk |
| Visuaaliset baseline-kuvakaappaukset | Git-historia |

---

## 13. Viitteet

- [GitHub Actions: Security Hardening](https://docs.github.com/en/actions/security-for-github-actions/security-guides/security-hardening-for-github-actions)
- [GitHub: Dependency Review Action](https://github.com/actions/dependency-review-action)
- [OpenSSF: Securing CI/CD Pipelines](https://openssf.org/blog/2025/06/11/maintainers-guide-securing-ci-cd-pipelines-after-the-tj-actions-and-reviewdog-supply-chain-attack/)
- [Playwright: Best Practices](https://playwright.dev/docs/best-practices)
- [Playwright: Accessibility Testing](https://playwright.dev/docs/accessibility-testing)
- [Playwright: Mock APIs (page.route)](https://playwright.dev/docs/mock)
- [Playwright: Screenshot Comparison](https://playwright.dev/docs/screenshots)
- [Playwright: webServer](https://playwright.dev/docs/test-webserver)
- [Playwright: Caching browsers in CI](https://playwright.dev/docs/ci#caching-browsers)
- [OWASP: CI/CD Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/CI_CD_Security_Cheat_Sheet.html)
- [Lighthouse CI](https://github.com/GoogleChrome/lighthouse-ci)
- [Google Core Web Vitals](https://web.dev/articles/vitals)
- [axe-core](https://github.com/dequelabs/axe-core)
- [WCAG 2.2 (W3C)](https://www.w3.org/TR/WCAG22/)
- [lychee](https://lychee.cli.rs)
- [STANDARDS.md](STANDARDS.md)
- [CODE_CONVENTIONS.md](CODE_CONVENTIONS.md)
- [TECHNICAL_DESIGN.md](TECHNICAL_DESIGN.md)
