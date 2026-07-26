# TESTING.md — Uutisseuranta Testausstrategia

Tämä dokumentti kuvaa uutisseuranta.github.io -projektin testausstrategian, workflow-rakenteen ja laadunvarmistuksen käytännöt. Standardivaatimusten (WCAG 2.1 AA jne.) osalta katso [STANDARDS.md](STANDARDS.md). Koodauskäytännöistä katso [CODE_CONVENTIONS.md](CODE_CONVENTIONS.md).

---

## 1. Testausstrategia

Testaus on jaettu kolmeen kerrokseen, jotka täydentävät toisiaan. Kukin kerros laukeaa eri vaiheessa kehityssykliä.

| Kerros | Mitä testataan | Milloin ajetaan | Työkalu |
|---|---|---|---|
| **1. PR-validointi** | Build, TypeScript-virheet, lint | Jokainen PR ennen mergeä | `npm run build`, `eslint`, `tsc --noEmit` |
| **2. Post-deploy E2E** | Sivuston toiminnallisuus live-ympäristössä (uutisvirta, teemanvaihto, kirjautumis-modal) | Deploy valmistuu (`workflow_run`) | Puppeteer (Headless Chrome) |
| **3. Ajoittainen laatu-audit** | Saavutettavuus, Lighthouse-pisteet, rikkinäiset linkit | Maanantaisin klo 06:00 UTC | `lighthouse-ci`, `axe-core`, `broken-link-checker` |

---

## 2. Automaattiset smoke-testit live-ympäristössä

### 2.1 Älykäs odotus (Polling) vs. `sleep 60`

Kiinteän `sleep 60` -viiveen sijasta käytössä on älykäs polling-skripti (`live-smoke-test.sh`). Skripti kyselee tuotanto-URL-osoitteesta vastauksia ja odottaa, kunnes saadaan onnistunut HTTP 200 -status tai aikaraja ylittyy. Kun sivu vastaa onnistuneesti, sen lopullinen URL kirjoitetaan tiedostoon `effective_url.txt`, jota Puppeteer käyttää testikohteena.

### 2.2 Rinnakkaiskäynnistyksen hallinta (`workflow_run`)

`post-deploy-test.yml` on konfiguroitu käynnistymään vasta sen jälkeen, kun GitHub Pages -julkaisutyö (`Deploy static content to Pages`) on valmistunut onnistuneesti (`types: [completed]`). Tämä takaa, että testit kohdistuvat aina juuri julkaistuun uuteen versioon, eikä vanhaan välimuistiversioon.

### 2.3 Kolmannen osapuolen actionit eivät ole SHA-pinned

`deploy.yml` käyttää `actions/checkout@v4` -muotoa. Supply chain -hyökkäysten torjumiseksi suositellaan SHA-pinnausta. Dependabot päivittää SHA:t automaattisesti versioiden noustessa.

```yaml
# Ennen
uses: actions/checkout@v4

# Jälkeen
uses: actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683 # v4.2.2
```

### 2.4 Puuttuva `permissions`-lohko `post-deploy-test.yml`:ssä

Ilman eksplisiittistä `permissions:`-lohkoa workflow perii oletuslaajan `GITHUB_TOKEN`-oikeuden. Jokaiseen workflowhin tulee lisätä minimipermiset.

```yaml
permissions:
  contents: read
```

---

## 3. Workflow-rakenne

### 3.1 Workflow 1: PR-validointi

Estää rikkinäisen koodin pääsyn `main`-haaraan. Ajetaan jokaiselle PR:lle.

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
      - uses: actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683 # v4
      - uses: actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020 # v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npm run lint
      - run: npm run build
        env:
          VITE_FIREBASE_API_KEY: ${{ secrets.VITE_FIREBASE_API_KEY }}
          VITE_FIREBASE_AUTH_DOMAIN: ${{ secrets.VITE_FIREBASE_AUTH_DOMAIN }}
          VITE_FIREBASE_PROJECT_ID: ${{ secrets.VITE_FIREBASE_PROJECT_ID }}
      - run: npx tsc --noEmit
```

### 3.2 Workflow 2: Post-deploy E2E (Playwright)

Laukeaa vasta kun `deploy.yml` on suoritettu onnistuneesti. Käyttää `workflow_run`-triggeriä rinnakkaiskäynnistymisen estämiseksi.

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
      - uses: actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683 # v4
      - uses: actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020 # v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - name: Wait for deployment HTTP success
        run: ./live-smoke-test.sh
      - name: Run Headless Chrome Test
        run: |
          if [ -f effective_url.txt ]; then
            export EFFECTIVE_URL=$(cat effective_url.txt)
          else
            export EFFECTIVE_URL="https://uutisseuranta.net"
          fi
          node live-browser-test.js
```

E2E-testit sijaitsevat tiedostossa `live-browser-test.js`. Testattavat kriittiset polut:
- **Uutisvirran latautuminen:** Varmistaa, että artikkelilista renderöityy ja CSP- tai CORS-blokkeja ei tapahdu verkkokutsussa.
- **Teemanvaihtaja:** Klikkaa painiketta ja tarkistaa, että `data-theme` -attribuutti vaihtuu html-tagissa.
- **Kirjautuminen:** Klikkaa Kirjaudu-nappia ja varmistaa, että kirjautumisikkuna avautuu.

### 3.3 Workflow 3: Viikoittainen laatu-audit

```yaml
name: Weekly Quality Audit
on:
  schedule:
    - cron: '0 6 * * 1'  # Maanantaisin klo 06:00 UTC
  workflow_dispatch:

jobs:
  lighthouse:
    runs-on: ubuntu-latest
    permissions:
      contents: read
    steps:
      - uses: actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683 # v4
      - uses: treosh/lighthouse-ci-action@v12
        with:
          urls: |
            https://uutisseuranta.net
          uploadArtifacts: true
          temporaryPublicStorage: true
          budgetPath: ./lighthouse-budget.json
```

Lighthouse-kynnysarvot (`lighthouse-budget.json`):

| Kategoria | Minimipistemäärä |
|---|---|
| Performance | 90 |
| Accessibility | 95 |
| Best Practices | 90 |
| SEO | 90 |

```json
[
  {
    "path": "/*",
    "scores": [
      { "category": "performance", "minScore": 0.9 },
      { "category": "accessibility", "minScore": 0.95 },
      { "category": "best-practices", "minScore": 0.9 },
      { "category": "seo", "minScore": 0.9 }
    ]
  }
]
```

---

## 4. Organisaatiotason uudelleenkäytettävyys

Koska `uutisseuranta`-organisaatiossa on useita repoja, yhteiset workflowt keskitetään `uutisseuranta/ops`-repoon `workflow_call`-triggerillä. Kutsu muista repoista:

```yaml
jobs:
  validate:
    uses: uutisseuranta/.github/.github/workflows/node-validate.yml@main
    with:
      node-version: "20"
    secrets: inherit
```

Näin muutos yhteen paikkaan päivittää kaikki repot ilman kopiointia.

---

## 5. Tunnetut rajoitteet

| Rajoite | Syy | Kiertotapa |
|---|---|---|
| Firebase-autentikointi E2E-testeissä | Testiympäristöllä ei ole kirjautumissessiota | Testataan vain kirjautumisen käyttöliittymäkäynnistystä (modalin aukeamista) tai luodaan erillinen testikäyttäjä |
| GitHub Pages CDN-viive | Deployment näkyy eri aikoina eri sijainneista | `live-smoke-test.sh` tekee älykkään odotuksen (HTTP-polling), kunnes uusi sivu on saavutettavissa |

---

## 6. Viitteet

- [GitHub Actions: Reusing workflows](https://docs.github.com/en/actions/sharing-automations/reusing-workflows)
- [GitHub Actions: Security hardening](https://docs.github.com/en/actions/security-for-github-actions/security-guides/security-hardening-for-github-actions)
- [Puppeteer: Getting Started](https://pptr.dev/)
- [Lighthouse CI: GitHub Actions](https://github.com/treosh/lighthouse-ci-action)
- [OWASP: GitHub Actions Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/CI_CD_Security_Cheat_Sheet.html)
- [STANDARDS.md](STANDARDS.md) — saavutettavuus- ja teknologiastandardit
- [CODE_CONVENTIONS.md](CODE_CONVENTIONS.md) — koodauskäytännöt

