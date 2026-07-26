# TESTING.md — Uutisseuranta Testausstrategia & CI/CD Parhaat Käytännöt

Tämä dokumentti kuvaa uutisseuranta.github.io -projektin testausstrategian, workflow-rakenteen ja laadunvarmistuksen standardit. Standardivaatimusten osalta katso [STANDARDS.md](STANDARDS.md) ja koodauskäytännöistä [CODE_CONVENTIONS.md](CODE_CONVENTIONS.md).

---

## 1. Testauspyramidi & Yleisstrategia

Uutisseurannan testaus noudattaa **Shift-Left** -periaatetta ja jaettua testauspyramidimallia:

```
              / \
             /   \
            / E2E \  <- Playwright Smoke Tests (tuotanto / live-sivusto)
           /-------\
          /  A11Y   \ <- axe-core/Playwright (WCAG 2.2 AA, jokainen PR)
         /----------=\
        /  PERF/SEO   \ <- Lighthouse CI (budjettivalvonta, ajoitetusti)
       /--------------\
      /     INTEG      \ <- integration-test.sh (Mock API + Vite build)
     /------------------\
    /        UNIT        \ <- Staattinen analyysi: ESLint, tsc, linkcheck
   /----------------------\
```

| Kerros | Mitä testataan | Milloin ajetaan | Työkalu |
|---|---|---|---|
| **1. Staattinen analyysi** | Koodin laatu, tyypitys, kääntyminen, rikkinäiset linkit | Jokainen PR ennen mergeä | ESLint, TypeScript (`tsc`), Vite Build, `linkcheck` |
| **2. Saavutettavuus (a11y)** | WCAG 2.2 AA -rikkomukset automaattisesti | Jokainen PR (Playwright + axe-core) | `@axe-core/playwright` |
| **3. Post-deploy E2E** | Live-sivuston kriittisimmät toiminnot selaimessa | GitHub Pages julkaisu valmis | Playwright (Chromium) |
| **4. Suorituskyky & laatu** | Core Web Vitals, suorituskykybudjetti, SEO, best practices | Ajoitetusti (Weekly) + manuaalisesti | Lighthouse CI (`lhci`) |
| **5. Visuaalinen regressio** | Layout-muutokset, CSS-regressiot | Harkitusti isoissa muutoksissa | Playwright screenshot diff |

> **Huomio:** Automaattiset a11y-työkalut kattavat noin 30–40 % WCAG-kriteereistä [Axe, 2023]. Manuaalinen testaus näppäimistöllä ja ruudunlukijalla (VoiceOver/NVDA) on välttämätöntä täydelliselle saavutettavuudelle.

---

## 2. GitHub Actions CI/CD Parhaat Käytännöt

Noudatamme Googlen, GitHubin, GitLabin ja OWASP:n suosittelemia standardeja:

### 2.1 Älykäs odotus (Polling) vs. `sleep 60`

Kiinteät viiveet (`sleep 60`) ovat CI/CD-putkien hauraita anti-patterneja. Käytämme erillistä polling-skriptiä (`live-smoke-test.sh`), joka kysyy tuotantosivun tilaa (HTTP HEAD/GET) 10 sekunnin välein, kunnes sivu vastaa 200 OK. Sivun lopullinen URL tallennetaan tiedostoon `effective_url.txt`, jota E2E-testit käyttävät testikohteena.

### 2.2 Rinnakkaiskäynnistyksen hallinta (`workflow_run`)

Estämme testien ajamisen vanhaa live-versiota vasten kytkemällä smoke-testit käynnistymään Pages-julkaisun `Deploy static content to Pages` valmistumisen (`completed`) jälkeen.

### 2.3 Tietoturva ja Supply Chain -hyökkäysten esto

- **SHA-pinnat:** Kaikki kolmannen osapuolen GitHub Actions -vaiheet lukittu tarkkoihin commit-hasheihin (esim. `actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683` tagin `@v4` sijaan). Katso [GitHub Actions Security Hardening](https://docs.github.com/en/actions/security-for-github-actions/security-guides/security-hardening-for-github-actions).
- **Minimioikeudet (Least Privilege):** Jokainen workflow sisältää eksplisiittisen `permissions`-lohkon:
  ```yaml
  permissions:
    contents: read
  ```
- **Salaisuudet:** Ei salaisuuksia koodissa. Käytä `secrets.*` -viittauksia ja tarkista `GITHUB_TOKEN`-käyttöoikeudet erikseen jokaiselle workflowlle.

### 2.4 Flaky-testien hallinta

Playwright-testit voivat olla epävakaita asynkronisen DOM:n takia. Parhaat käytännöt [Playwright Best Practices, 2026]:

- Käytä `page.waitForSelector()` tai `expect(locator).toBeVisible()` — ei `page.waitForTimeout()`.
- Suosi käyttäjärooli-lokaattoreita (`getByRole`, `getByLabel`) XPath/CSS-selectoreiden sijaan; ne vastaavat oikeaa käyttäjäkokemusta ja ovat stabiilimpia.
- Aseta `retries: 2` CI-ympäristössä `playwright.config.ts`:ssa epävakaiden verkko-olosuhteiden varalle.

---

## 3. Workflow-rakenne

### 3.1 PR-validointi (`pr-validate.yml`)

Estää rikkinäisen koodin pääsyn `main`-haaraan. Sisältää nyt myös saavutettavuustarkistuksen.

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
      - uses: actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683 # v4.2.2
      - uses: actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020 # v4.2.0
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npm run lint
      - run: npm run build
      - run: npx tsc --noEmit

  accessibility:
    runs-on: ubuntu-latest
    permissions:
      contents: read
    steps:
      - uses: actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683 # v4.2.2
      - uses: actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020 # v4.2.0
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npm run build
      - name: Install Playwright Chromium
        run: npx playwright install --with-deps chromium
      - name: Run axe-core accessibility audit
        run: npx playwright test tests/a11y/
      - name: Upload a11y report
        uses: actions/upload-artifact@b4b15b8c7c6ac21ea2af6b81c8a70187a9dad191 # v4.4.3
        if: failure()
        with:
          name: a11y-report
          path: playwright-report/
          retention-days: 7
```

### 3.2 Post-deploy Smoke-testit (`post-deploy-test.yml`)

Ajaa Playwright (Chromium) -testit live-tuotantoa vasten.

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
      - uses: actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683 # v4.2.2
      - uses: actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020 # v4.2.0
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - name: Wait for deployment HTTP success
        run: ./live-smoke-test.sh
      - name: Install Playwright Chromium
        run: npx playwright install --with-deps chromium
      - name: Run Playwright Smoke Tests
        run: |
          if [ -f effective_url.txt ]; then
            export EFFECTIVE_URL=$(cat effective_url.txt)
          else
            export EFFECTIVE_URL="https://uutisseuranta.net"
          fi
          npx playwright test tests/e2e/
        env:
          CI: true
      - name: Upload Report
        uses: actions/upload-artifact@b4b15b8c7c6ac21ea2af6b81c8a70187a9dad191 # v4.4.3
        if: failure()
        with:
          name: playwright-report
          path: playwright-report/
          retention-days: 7
```

### 3.3 Lighthouse CI -suorituskykyauditointi (`lighthouse.yml`)

Ajoitettu viikoittain ja mahdollista käynnistää manuaalisesti. Käyttää `lhci`-komentorivityökalua eikä kolmannen osapuolen Actions-askeletta, jotta SHA-pinnoituksesta ei tarvitse huolehtia.

```yaml
name: Lighthouse CI Audit
on:
  schedule:
    - cron: '0 4 * * 1'   # Maanantaisin klo 04:00 UTC
  workflow_dispatch:

jobs:
  lighthouse:
    runs-on: ubuntu-latest
    permissions:
      contents: read
    steps:
      - uses: actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683 # v4.2.2
      - uses: actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020 # v4.2.0
        with:
          node-version: 20
          cache: npm
      - run: npm ci && npm run build
      - run: npm install -g @lhci/cli
      - run: lhci autorun
      - name: Upload Lighthouse report
        uses: actions/upload-artifact@b4b15b8c7c6ac21ea2af6b81c8a70187a9dad191 # v4.4.3
        if: always()
        with:
          name: lighthouse-report
          path: .lighthouseci/
          retention-days: 30
```

**`lighthouserc.json` — suorituskykybudjetti:**

```json
{
  "ci": {
    "collect": {
      "url": ["https://uutisseuranta.net"],
      "numberOfRuns": 3
    },
    "assert": {
      "assertions": {
        "categories:performance": ["error", {"minScore": 0.85}],
        "categories:accessibility": ["error", {"minScore": 0.95}],
        "categories:best-practices": ["error", {"minScore": 0.90}],
        "categories:seo": ["error", {"minScore": 0.90}],
        "first-contentful-paint": ["warn", {"maxNumericValue": 2000}],
        "largest-contentful-paint": ["error", {"maxNumericValue": 2500}],
        "total-blocking-time": ["warn", {"maxNumericValue": 300}],
        "cumulative-layout-shift": ["error", {"maxNumericValue": 0.1}],
        "interactive": ["warn", {"maxNumericValue": 3500}]
      }
    },
    "upload": {
      "target": "temporary-public-storage"
    }
  }
}
```

> **Huomio budjeteista:** Nämä ovat lähtöarvot. Tarkista ja kiristä arvoja neljännesvuosittain tuotantomittausten perusteella. Core Web Vitals -tavoitteet perustuvat Googlen "Good"-luokkaan (LCP ≤ 2.5 s, CLS ≤ 0.1, INP ≤ 200 ms).

---

## 4. Saavutettavuustestaus (a11y)

### 4.1 Automaattinen testaus: axe-core + Playwright

`@axe-core/playwright` kattaa noin 30–40 % WCAG-kriteereistä automaattisesti ja on integroitavissa suoraan olemassa oleviin Playwright-testeihin [Playwright Accessibility Testing Docs].

**Asenna:**

```bash
npm install --save-dev @axe-core/playwright
```

**`tests/a11y/accessibility.spec.ts`:**

```typescript
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('Saavutettavuus — WCAG 2.2 AA', () => {
  test('etusivu: ei WCAG-rikkomuksia', async ({ page }) => {
    await page.goto('/');
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
      .analyze();
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

**Playwright-konfiguraatio (`playwright.config.ts`) — kehityspalvelin PR-testeissä:**

```typescript
import { defineConfig } from '@playwright/test';
export default defineConfig({
  webServer: {
    command: 'npm run preview',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
  },
  use: { baseURL: process.env.EFFECTIVE_URL ?? 'http://localhost:4173' },
  retries: process.env.CI ? 2 : 0,
  reporter: [['html', { outputFolder: 'playwright-report' }]],
});
```

### 4.2 Manuaalinen testaus (pakollinen täydennys)

Automaattiset työkalut eivät tunnista kaikkia ongelmia. Tarkista manuaalisesti:

| Tarkistus | Työkalu | Tiheys |
|---|---|---|
| Näppäimistönavigointi (Tab, Enter, Esc, nuolinäppäimet) | Selain | Jokainen uusi komponentti |
| Ruudunlukija | VoiceOver (macOS/iOS), NVDA (Windows) | Merkittävät muutokset |
| Värikontrasti | WebAIM Contrast Checker, browser DevTools | Designmuutokset |
| Zoom 200 % (WCAG 1.4.4) | Selain | Layoutmuutokset |
| Fokuksen näkyvyys | Selain, CSS-tarkistus | Jokainen uusi interaktiivinen elementti |

---

## 5. Playwright E2E-smoke-testit (`tests/e2e/smoke.spec.ts`)

Playwright on määritelty ajamaan ainoastaan **Chromium**-selaimella suoritusajan minimoimiseksi. Testit käyttävät roolilokaattoreita XPath:n sijaan vakauden parantamiseksi [Playwright Best Practices 2026]:

```typescript
import { test, expect } from '@playwright/test';

test.describe('Uutisseuranta — smoke', () => {
  test('artikkelikortit latautuvat', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.article-card').first()).toBeVisible();
    // Ei console-virheitä (CORS, CSP)
    const errors: string[] = [];
    page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
    await page.reload();
    expect(errors).toHaveLength(0);
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

---

## 6. Visuaalinen regressiotestaus

Visuaalinen regressiotestaus sopii käytettäväksi merkittävien CSS/layout-muutosten yhteydessä. Playwright sisältää screenshot-vertailun ilman lisäriippuvuuksia.

**Peruskäyttö (`tests/visual/snapshot.spec.ts`):**

```typescript
import { test, expect } from '@playwright/test';

test('etusivu — visuaalinen regressio', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveScreenshot('homepage.png', {
    maxDiffPixelRatio: 0.02,  // 2 % pikseliero sallittu
    fullPage: true,
  });
});
```

Päivitä baseline-kuvakaappaukset tietoisesti muutoksissa:

```bash
npx playwright test --update-snapshots
```

> **Avoimet vaihtoehdot:** [Playwright screenshot comparison](https://playwright.dev/docs/screenshots) (sisäänrakennettu, ei lisämaksua) on GitHub Pages -projekteille riittävä. Maksulliset palvelut (Percy, Chromatic) sopivat suuremmille tiimeille, joissa useita suunnittelijoita.

---

## 7. Testitietojen ja ympäristöjen hallinta

- **Testit eivät saa käyttää tuotantodata-APIa kirjoitusoperaatioihin.** Uutisseuranta.net on lukutila-sovellus, mutta kirjautumistoiminto tulee testata mock- tai staging-ympäristöä vasten.
- **Ympäristömuuttujat:** `EFFECTIVE_URL` siirtyy polling-skriptiltä Playwright-testeihin. Älä kovakoodaa URL:ia testeihin — käytä `process.env.EFFECTIVE_URL ?? 'http://localhost:4173'`.
- **Selainten kattavuus:** CI ajaa vain Chromiumia nopeuden takia. Kriittiset muutokset voi tarkistaa manuaalisesti Firefoxilla ja Safarilla/WebKitillä.

---

## 8. Raportointi ja näkyvyys

| Artefakti | Missä | Säilytysaika |
|---|---|---|
| Playwright HTML-raportti (epäonnistuneet) | GitHub Actions Artifacts | 7 vrk |
| axe-core a11y -raportti (epäonnistuneet) | GitHub Actions Artifacts | 7 vrk |
| Lighthouse CI -raportti | GitHub Actions Artifacts + temporary-public-storage | 30 vrk |
| Visuaaliset regressiokuvakaappaukset | Repositorio (`tests/visual/__snapshots__/`) | Git-historia |

---

## 9. Viitteet

- [GitHub Actions: Security Hardening](https://docs.github.com/en/actions/security-for-github-actions/security-guides/security-hardening-for-github-actions)
- [Playwright: Best Practices 2026](https://playwright.dev/docs/best-practices)
- [Playwright: Accessibility Testing with axe-core](https://playwright.dev/docs/accessibility-testing)
- [Playwright: Screenshot Comparison](https://playwright.dev/docs/screenshots)
- [OWASP: CI/CD Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/CI_CD_Security_Cheat_Sheet.html)
- [Lighthouse CI (lhci)](https://github.com/GoogleChrome/lighthouse-ci)
- [Google Core Web Vitals thresholds](https://web.dev/articles/vitals)
- [axe-core: Accessibility rules](https://github.com/dequelabs/axe-core)
- [WCAG 2.2 (W3C)](https://www.w3.org/TR/WCAG22/)
- [STANDARDS.md](STANDARDS.md) — saavutettavuus- ja teknologiastandardit
- [CODE_CONVENTIONS.md](CODE_CONVENTIONS.md) — koodauskäytännöt
