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
    /   STAATTINEN/LINT  \ <- ESLint, tsc, lychee (linkit), Vite build
   /----------------------\
```

| Kerros | Mitä testataan | Milloin ajetaan | Työkalu |
|---|---|---|---|
| **1. Staattinen analyysi** | Koodin laatu, tyypitys, kääntyminen, rikkinäiset linkit | Jokainen PR ennen mergeä | ESLint, TypeScript (`tsc`), Vite Build, **lychee** |
| **2. Saavutettavuus (a11y)** | WCAG 2.2 AA -rikkomukset automaattisesti | Jokainen PR (Playwright + axe-core) | `@axe-core/playwright` |
| **3. Post-deploy E2E** | Live-sivuston kriittisimmät toiminnot selaimessa | GitHub Pages julkaisu valmis | Playwright (Chromium) |
| **4. Suorituskyky & laatu** | Core Web Vitals, suorituskykybudjetti, SEO, best practices | Ajoitetusti (Weekly) + manuaalisesti | Lighthouse CI (`lhci`) |
| **5. Visuaalinen regressio** | Layout-muutokset, CSS-regressiot | Harkitusti isoissa muutoksissa | Playwright screenshot diff |

> **Huomio a11y-kattavuudesta:** Automaattiset työkalut kattavat noin 30–40 % WCAG-kriteereistä. Manuaalinen testaus näppäimistöllä ja ruudunlukijalla (VoiceOver/NVDA) on välttämätöntä täydelliselle saavutettavuudelle.

---

## 2. GitHub Actions CI/CD Parhaat Käytännöt

Noudatamme Googlen, GitHubin, GitLabin ja OWASP:n suosittelemia standardeja.

### 2.1 Älykäs odotus (Polling) vs. `sleep 60`

Kiinteät viiveet (`sleep 60`) ovat CI/CD-putkien hauraita anti-patterneja. Käytämme erillistä polling-skriptiä (`live-smoke-test.sh`), joka kysyy tuotantosivun tilaa (HTTP HEAD/GET) 10 sekunnin välein, kunnes sivu vastaa 200 OK. Sivun lopullinen URL tallennetaan tiedostoon `effective_url.txt`, jota E2E-testit käyttävät testikohteena.

### 2.2 Rinnakkaiskäynnistyksen hallinta (`workflow_run`)

Estämme testien ajamisen vanhaa live-versiota vasten kytkemällä smoke-testit käynnistymään Pages-julkaisun `Deploy static content to Pages` valmistumisen (`completed`) jälkeen.

### 2.3 Tietoturva ja Supply Chain -hyökkäysten esto

- **SHA-pinnat:** Kaikki kolmannen osapuolen GitHub Actions -vaiheet on lukittu tarkkoihin commit-hasheihin (esim. `actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683` tagin `@v4` sijaan). Katso [GitHub Actions Security Hardening](https://docs.github.com/en/actions/security-for-github-actions/security-guides/security-hardening-for-github-actions).
- **Minimioikeudet (Least Privilege):** Jokainen workflow sisältää eksplisiittisen `permissions`-lohkon:
  ```yaml
  permissions:
    contents: read
  ```
- **Dependency Review:** `actions/dependency-review-action` skannaa jokaisen PR:n riippuvuusmuutokset ja katkaisee CI:n, jos uusi paketti sisältää tunnetun haavoittuvuuden GitHub Advisory Databasessa. Katso [dependency-review-action](https://github.com/actions/dependency-review-action). Lisää `pr-validate.yml`:ään omana rinnakkaisena jobina (ks. kohta 3.1).
- **Salaisuudet:** Ei salaisuuksia koodissa. Käytä `secrets.*`-viittauksia ja tarkista `GITHUB_TOKEN`-käyttöoikeudet erikseen jokaiselle workflowlle.

### 2.4 CI-välimuistit: npm ja Playwright-selaimet

Välimuistit lyhentävät merkittävästi CI-aika. Käytä kahta erillistä tasoa:

1. **npm-latausvälimuisti** — `actions/setup-node`-actionin `cache: npm` -optio välimuistaa `~/.npm`-kansion. Tämä nopeuttaa `npm ci` -asennusta estämällä pakettilataukset verkosta joka kerta.
2. **Playwright-selainvälimuisti** — Playwright lataa Chromium-binaarin (`~/.cache/ms-playwright`) jokaista CI-ajoa varten, ellei sitä ole välimuistissa. Tallenna se `actions/cache`-actionilla avaimella `${{ runner.os }}-ms-playwright-${{ hashFiles('package-lock.json') }}`. Asenna selain vain, jos välimuisti ei osunut (`cache-hit != 'true'`).

```yaml
# Esimerkki: npm + Playwright-selainvälimuisti
- uses: actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020 # v4.2.0
  with:
    node-version: 20
    cache: npm
- run: npm ci

- name: Cache Playwright browsers
  id: playwright-cache
  uses: actions/cache@5a3ec84eff668545956fd18022155c47e93e2684 # v4.2.3
  with:
    path: ~/.cache/ms-playwright
    key: ${{ runner.os }}-ms-playwright-${{ hashFiles('package-lock.json') }}

- name: Install Playwright Chromium
  if: steps.playwright-cache.outputs.cache-hit != 'true'
  run: npx playwright install --with-deps chromium
```

> **Huomio `node_modules`-välimuistista:** `node_modules`:n suora välimuistaminen on vaihtoehto, mutta se on OS-riippuvainen ja voi kasvaa suureksi. Aloita `~/.npm` + Playwright-selainvälimuistilla; lisää `node_modules`-taso vain jos CI on edelleen liian hidas.

### 2.5 Flaky-testien hallinta

Playwright-testit voivat olla epävakaita asynkronisen DOM:n takia:

- Käytä `expect(locator).toBeVisible()` — älä koskaan `page.waitForTimeout()`.
- Suosi käyttäjärooli-lokaattoreita (`getByRole`, `getByLabel`) XPath/CSS-selectoreiden sijaan; ne vastaavat oikeaa käyttäjäkokemusta ja ovat stabiilimpia.
- Aseta `retries: 2` CI-ympäristössä `playwright.config.ts`:ssa epävakaiden verkko-olosuhteiden varalle.
- Älä käytä `.first()` ilman `await expect(...).toBeVisible()` -vahvistusta: lokaattori voi ratkaistua ennen kuin elementti on oikeasti näkyvissä.

---

## 3. Workflow-rakenne

### 3.1 PR-validointi (`pr-validate.yml`)

Estää rikkinäisen koodin pääsyn `main`-haaraan. Neljä rinnakkaista jobia: staattinen analyysi, riippuvuustarkistus, linkkitarkistus ja saavutettavuus.

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

  dependency-review:
    runs-on: ubuntu-latest
    permissions:
      contents: read
    steps:
      - uses: actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683 # v4.2.2
      # Skannaa PR:n riippuvuusmuutokset GitHub Advisory Databasea vasten.
      # Katkaisee CI:n jos uusi paketti sisältää tunnetun haavoittuvuuden.
      # https://github.com/actions/dependency-review-action
      - name: Dependency Review
        uses: actions/dependency-review-action@38ecb5b593bf0eb19e335c03a4f2a0bdd9f54e32 # v4.7.1
        with:
          fail-on-severity: moderate

  link-check:
    runs-on: ubuntu-latest
    permissions:
      contents: read
    steps:
      - uses: actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683 # v4.2.2
      # lychee: Rust-pohjainen, nopea, natiivi CI-työkalu rikkinäisten linkkien tarkistukseen
      # https://lychee.cli.rs
      - name: Check links with lychee
        uses: lycheeverse/lychee-action@f81112d0d2814ded911bd23654d47b02e9b2c8f0 # v2.4.1
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
      - uses: actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683 # v4.2.2
      - uses: actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020 # v4.2.0
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - name: Cache Playwright browsers
        id: playwright-cache
        uses: actions/cache@5a3ec84eff668545956fd18022155c47e93e2684 # v4.2.3
        with:
          path: ~/.cache/ms-playwright
          key: ${{ runner.os }}-ms-playwright-${{ hashFiles('package-lock.json') }}
      - name: Install Playwright Chromium
        if: steps.playwright-cache.outputs.cache-hit != 'true'
        run: npx playwright install --with-deps chromium
      # webServer käynnistää "npm run build && npm run preview" playwright.config.ts:ssä
      - name: Run axe-core accessibility audit
        run: npx playwright test tests/a11y/
        env:
          CI: true
      - name: Upload a11y report
        uses: actions/upload-artifact@b4b15b8c7c6ac21ea2af6b81c8a70187a9dad191 # v4.4.3
        if: failure()
        with:
          name: a11y-report
          path: playwright-report/
          retention-days: 7
```

> **Huomio jobeista:** Kaikki neljä jobia ajetaan rinnakkain (ei `needs:`-riippuvuutta) CI-ajan minimoimiseksi. `dependency-review`-job vaatii, että repository on julkinen tai GitHub Advanced Security on käytössä.

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
      - name: Cache Playwright browsers
        id: playwright-cache
        uses: actions/cache@5a3ec84eff668545956fd18022155c47e93e2684 # v4.2.3
        with:
          path: ~/.cache/ms-playwright
          key: ${{ runner.os }}-ms-playwright-${{ hashFiles('package-lock.json') }}
      - name: Install Playwright Chromium
        if: steps.playwright-cache.outputs.cache-hit != 'true'
        run: npx playwright install --with-deps chromium
      - name: Run Playwright Smoke Tests
        run: |
          EFFECTIVE_URL=$(cat effective_url.txt 2>/dev/null || echo "https://uutisseuranta.net")
          export EFFECTIVE_URL
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

Ajoitettu viikoittain ja käynnistettävissä manuaalisesti. `lhci` asennetaan paikallisesti (`npm install --save-dev`) eikä globaalisti, jotta versiointi pysyy `package.json`:ssa.

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
      - run: npm ci
      - run: npx lhci autorun
      - name: Upload Lighthouse report
        uses: actions/upload-artifact@b4b15b8c7c6ac21ea2af6b81c8a70187a9dad191 # v4.4.3
        if: always()
        with:
          name: lighthouse-report
          path: .lighthouseci/
          retention-days: 30
```

**Lisää `package.json`:iin:**

```json
{
  "devDependencies": {
    "@lhci/cli": "^0.14.0"
  }
}
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
        "categories:performance":    ["error", {"minScore": 0.85}],
        "categories:accessibility":  ["error", {"minScore": 0.95}],
        "categories:best-practices": ["error", {"minScore": 0.90}],
        "categories:seo":            ["error", {"minScore": 0.90}],
        "first-contentful-paint":    ["warn",  {"maxNumericValue": 2000}],
        "largest-contentful-paint":  ["error", {"maxNumericValue": 2500}],
        "total-blocking-time":       ["warn",  {"maxNumericValue": 300}],
        "cumulative-layout-shift":   ["error", {"maxNumericValue": 0.1}],
        "interaction-to-next-paint": ["warn",  {"maxNumericValue": 200}],
        "interactive":               ["warn",  {"maxNumericValue": 3500}]
      }
    },
    "upload": {
      "target": "temporary-public-storage"
    }
  }
}
```

> **Budjettien lähteet:** LCP ≤ 2 500 ms, CLS ≤ 0.1 ja INP ≤ 200 ms perustuvat Googlen Core Web Vitals "Good"-luokkaan. Tarkista ja kiristä arvoja neljännesvuosittain tuotantomittausten perusteella.

---

## 4. Saavutettavuustestaus (a11y)

### 4.1 Automaattinen testaus: axe-core + Playwright

`@axe-core/playwright` kattaa noin 30–40 % WCAG-kriteereistä automaattisesti ja integroituu suoraan Playwright-testeihin. Akateeminen vertailu yhdeksästä a11y-työkalusta (axe, alfa, Continuum, WAVE jne.) osoittaa, että axe-core on laajimmin käytetty ja antaa vähintään päällekkäisyyksiä muiden työkalujen kanssa yksittäisen työkalun valinnassa.

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
    // Odota, että sivu on renderoitunut kunnolla
    await expect(page.locator('body')).toBeVisible();

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
      .analyze();

    // Tulosta rikkomukset luettavasti epäonnistuessa
    if (results.violations.length > 0) {
      console.error(
        'a11y-rikkomukset:',
        JSON.stringify(results.violations.map(v => ({
          id: v.id, impact: v.impact, description: v.description,
          nodes: v.nodes.map(n => n.html),
        })), null, 2),
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

**Playwright-konfiguraatio (`playwright.config.ts`):**

```typescript
import { defineConfig } from '@playwright/test';

export default defineConfig({
  // webServer käynnistää Vite preview -serverin automaattisesti PR-testeissä
  // EFFECTIVE_URL ohittaa tämän post-deploy-testeissä (live-sivusto)
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

Playwright ajaa ainoastaan **Chromium**-selaimella CI:ssä suoritusajan minimoimiseksi. Testit käyttävät roolilokaattoreita XPath/CSS-selectoreiden sijaan vakauden parantamiseksi:

```typescript
import { test, expect } from '@playwright/test';

test.describe('Uutisseuranta — smoke', () => {
  test('artikkelikortit latautuvat', async ({ page }) => {
    await page.goto('/');
    // Odota ensimmäistä korttia eksplisiittisesti — ei .first() ilman odotusta
    const firstCard = page.locator('.article-card').first();
    await expect(firstCard).toBeVisible({ timeout: 10_000 });
  });

  test('konsolissa ei ole virheitä (CORS, CSP)', async ({ page }) => {
    const errors: string[] = [];
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

**`tests/visual/snapshot.spec.ts`:**

```typescript
import { test, expect } from '@playwright/test';

test('etusivu — visuaalinen regressio', async ({ page }) => {
  await page.goto('/');
  // Odota, että artikkelit ovat latautuneet ennen kuvakaappausta
  await expect(page.locator('.article-card').first()).toBeVisible({ timeout: 10_000 });
  await expect(page).toHaveScreenshot('homepage.png', {
    maxDiffPixelRatio: 0.02,  // 2 % pikseliero sallittu
    fullPage: true,
  });
});
```

Päivitä baseline-kuvakaappaukset tietoisesti muutoksissa:

```bash
npx playwright test tests/visual/ --update-snapshots
```

Baseline-kuvakaappaukset tallennetaan repositorioon (`tests/visual/__snapshots__/`) ja niiden muutokset näkyvät PR:n diffissä.

> **Avoimet vaihtoehdot:** Playwright:n sisäänrakennettu screenshot diff on GitHub Pages -projekteille riittävä. Maksulliset palvelut (Percy, Chromatic) sopivat suuremmille tiimeille.

---

## 7. Rikkinäisten linkkien tarkistus (lychee)

[lychee](https://lychee.cli.rs) on Rust-pohjainen, asynkroninen linkintarkistustyökalu, joka tukee natiivisti Markdown- ja HTML-tiedostoja. Se on suositeltavampi kuin `linkcheck` tai `hyperlink` GitHub Pages -projekteille, koska se käsittee myös ulkoiset linkit ja integroituu suoraan GitHub Actions -ekosysteemiin omana action-askeleenaan.

**Konfiguraatio (`.lycheeignore`):**

```
# Jätä pois ajoittain epävakaat tai autentikaatiota vaativat osoitteet
https://twitter.com
https://x.com
https://linkedin.com
```

**`lychee.toml` (valinnainen tarkennettu konfiguraatio):**

```toml
# lychee.toml
max_retries = 3
timeout = 20
exclude_loopback = true
exclude = [
  "localhost",
  "example\.com",
]
```

---

## 8. Testitietojen ja ympäristöjen hallinta

- **Testit eivät saa käyttää tuotantodata-APIa kirjoitusoperaatioihin.** Uutisseuranta.net on lukutila-sovellus, mutta kirjautumistoiminto tulee testata mock- tai staging-ympäristöä vasten.
- **Ympäristömuuttujat:** `EFFECTIVE_URL` siirtyy polling-skriptiltä Playwright-testeihin. Käytä `process.env.EFFECTIVE_URL ?? 'http://localhost:4173'` — älä kovakoodaa URL:ia.
- **Selainten kattavuus:** CI ajaa vain Chromiumia nopeuden takia. Kriittiset muutokset voi tarkistaa manuaalisesti Firefoxilla ja Safarilla/WebKitillä.

---

## 9. Raportointi ja näkyvyys

| Artefakti | Missä | Säilytysaika |
|---|---|---|
| Playwright HTML-raportti (epäonnistuneet) | GitHub Actions Artifacts | 7 vrk |
| axe-core a11y -raportti (epäonnistuneet) | GitHub Actions Artifacts | 7 vrk |
| Lighthouse CI -raportti | GitHub Actions Artifacts + temporary-public-storage | 30 vrk |
| lychee link report | GitHub Actions Artifacts (epäonnistuneet) | 7 vrk |
| Visuaaliset regressiokuvakaappaukset | Repositorio (`tests/visual/__snapshots__/`) | Git-historia |

---

## 10. Viitteet

- [GitHub Actions: Security Hardening](https://docs.github.com/en/actions/security-for-github-actions/security-guides/security-hardening-for-github-actions)
- [GitHub: Dependency Review Action](https://github.com/actions/dependency-review-action)
- [GitHub: Configuring Dependency Review](https://docs.github.com/en/code-security/how-tos/secure-your-supply-chain/manage-your-dependency-security/configure-dependency-review)
- [OpenSSF: Securing CI/CD Pipelines After Supply Chain Attacks](https://openssf.org/blog/2025/06/11/maintainers-guide-securing-ci-cd-pipelines-after-the-tj-actions-and-reviewdog-supply-chain-attack/)
- [Playwright: Best Practices](https://playwright.dev/docs/best-practices)
- [Playwright: Accessibility Testing with axe-core](https://playwright.dev/docs/accessibility-testing)
- [Playwright: Screenshot Comparison](https://playwright.dev/docs/screenshots)
- [Playwright: webServer configuration](https://playwright.dev/docs/test-webserver)
- [Playwright: Caching browsers in CI](https://playwright.dev/docs/ci#caching-browsers)
- [OWASP: CI/CD Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/CI_CD_Security_Cheat_Sheet.html)
- [Lighthouse CI (lhci)](https://github.com/GoogleChrome/lighthouse-ci)
- [Google Core Web Vitals thresholds](https://web.dev/articles/vitals)
- [axe-core: Accessibility rules](https://github.com/dequelabs/axe-core)
- [WCAG 2.2 (W3C)](https://www.w3.org/TR/WCAG22/)
- [lychee: Fast async link checker](https://lychee.cli.rs)
- [STANDARDS.md](STANDARDS.md) — saavutettavuus- ja teknologiastandardit
- [CODE_CONVENTIONS.md](CODE_CONVENTIONS.md) — koodauskäytännöt
