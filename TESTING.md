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
      /  INTEG  \ <- integration-test.sh (Mock API + Vite build)
     /-----------\
    /    UNIT     \ <- Backend unit-test.sh (Nopeat yksikkötestit)
   /---------------\
```

| Kerros | Mitä testataan | Milloin ajetaan | Työkalu |
|---|---|---|---|
| **1. PR-validointi** | Staattinen koodin laatu, tyypitys ja kääntyminen | Jokainen PR ennen mergeä | ESLint, TypeScript (`tsc`), Vite Build |
| **2. Post-deploy E2E** | Live-sivuston kriittisimmät toiminnot selaimessa | GitHub Pages julkaisu valmis | Playwright (vain Chromium) |
| **3. Laatu-auditit** | WCAG-saavutettavuus ja suorituskyky | Ajoitetusti (Weekly) | Lighthouse CI |

---

## 2. GitHub Actions CI/CD Parhaat Käytännöt (Best Practices)

Noudatamme Googlen, GitHubin ja GitLabin suosittelemia standardeja:

### 2.1 Älykäs odotus (Polling) vs. `sleep 60`
Kiinteät viiveet (`sleep 60`) ovat CI/CD-putkien hauraita anti-patterneja. Käytämme erillistä polling-skriptiä (`live-smoke-test.sh`), joka kysyy tuotantosivun tilaa (HTTP HEAD/GET) 10 sekunnin välein, kunnes sivu vastaa 200 OK. Sivun lopullinen URL tallennetaan tiedostoon `effective_url.txt`, jota E2E-testit käyttävät testikohteena.

### 2.2 Rinnakkaiskäynnistyksen hallinta (`workflow_run`)
Estämme testien ajamisen vanhaa live-versiota vasten kytkemällä smoke-testit käynnistymään Pages-julkaisun `Deploy static content to Pages` valmistumisen (`completed`) jälkeen.

### 2.3 Tietoturva ja Supply Chain -hyökkäysten esto
*   **SHA-pinnat:** Kaikki kolmannen osapuolen GitHub Actions -vaiheet on lukittu tarkkoihin commit-hasheihin (esim. `actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683` tagin `@v4` sijaan).
*   **Minimioikeudet (Least Privilege):** Työkulut sisältävät eksplisiittisen `permissions`-lohkon rajoittamaan `GITHUB_TOKEN`:in vain luku-oikeuteen:
    ```yaml
    permissions:
      contents: read
    ```

---

## 3. Workflow-rakenne

### 3.1 PR-validointi (`pr-validate.yml`)
Estää rikkinäisen koodin pääsyn `main`-haaraan.

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
          npx playwright test
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

---

## 4. Playwright E2E-smoke-testit (`tests/e2e/smoke.spec.js`)

Playwright on määritelty ajamaan ainoastaan **Chromium**-selaimella suoritusajan minimoimiseksi. Testit varmistavat:
1.  **Uutisvirran latautuminen:** Varmistaa, että artikkelit `.article-card` latautuvat ilman CORS/CSP-virheitä.
2.  **Teemanvaihtaja:** Klikkaa teemanvaihtopainiketta ja varmistaa, että `data-theme` muuttuu `html`-tagissa.
3.  **Kirjautumismodaali:** Varmistaa, että kirjautumispainikkeen klikkaaminen avaa modal-ikkunan.

---

## 5. Viitteet
- [GitHub Actions: Security Hardening](https://docs.github.com/en/actions/security-for-github-actions/security-guides/security-hardening-for-github-actions)
- [Playwright: CI Integration](https://playwright.dev/docs/ci-intro)
- [OWASP: CI/CD Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/CI_CD_Security_Cheat_Sheet.html)�� saavutettavuus- ja teknologiastandardit
- [CODE_CONVENTIONS.md](CODE_CONVENTIONS.md) — koodauskäytännöt

