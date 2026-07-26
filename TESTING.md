# TESTING.md — Uutisseuranta Testausstrategia

Tämä dokumentti kuvaa uutisseuranta.github.io -projektin testausstrategian, workflow-rakenteen ja laadunvarmistuksen käytännöt. Standardivaatimusten (WCAG 2.1 AA jne.) osalta katso [STANDARDS.md](STANDARDS.md). Koodauskäytännöistä katso [CODE_CONVENTIONS.md](CODE_CONVENTIONS.md).

---

## 1. Testausstrategia

Testaus on jaettu kolmeen kerrokseen, jotka täydentävät toisiaan. Kukin kerros laukeaa eri vaiheessa kehityssykliä.

| Kerros | Mitä testataan | Milloin ajetaan | Työkalu |
|---|---|---|---|
| **1. PR-validointi** | Build, TypeScript-virheet, lint | Jokainen PR ennen mergeä | `npm run build`, `eslint`, `tsc --noEmit` |
| **2. Post-deploy E2E** | Sivuston toiminnallisuus live-ympäristössä | Deploy valmistuu (`workflow_run`) | Playwright |
| **3. Ajoittainen laatu-audit** | Saavutettavuus, Lighthouse-pisteet, rikkinäiset linkit | Maanantaisin klo 06:00 UTC | `lighthouse-ci`, `axe-core`, `broken-link-checker` |

---

## 2. Tunnetut ongelmat nykyisissä workfloweissa

### 2.1 `sleep 60` — hauras anti-pattern

`post-deploy-test.yml` odottaa 60 sekuntia kiinteällä `sleep`-komennolla ennen smoke-testiä. GitHub Pages -deploymentti voi kestää alle 10 sekuntia tai yli 3 minuuttia CDN-tilanteesta riippuen. Korjaus: polling-looppi joka tarkistaa deployment-statuksen GitHub API:n kautta.

```bash
for i in $(seq 1 30); do
  STATUS=$(curl -s -H "Authorization: token $GITHUB_TOKEN" \
    "https://api.github.com/repos/${{ github.repository }}/deployments" \
    | jq -r '.[0].statuses_url')
  DEPLOY_STATUS=$(curl -s -H "Authorization: token $GITHUB_TOKEN" "$STATUS" \
    | jq -r '.[0].state')
  [ "$DEPLOY_STATUS" = "success" ] && break
  echo "Waiting... ($i/30) status=$DEPLOY_STATUS"
  sleep 10
done
```

### 2.2 Rinnakkainen käynnistyminen `deploy.yml`:n kanssa

`post-deploy-test.yml` laukeaa samasta `push: branches: [main]` -triggeristä kuin `deploy.yml`. Tämä tarkoittaa, että smoke-testi testaa **edellisen** version sivustoa, ei äsken deployttua. Korjaus: `workflow_run`-triggeri (ks. kohta 3.2).

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
name: Post-Deploy E2E
on:
  workflow_run:
    workflows: ["Deploy static content to Pages"]
    types: [completed]

jobs:
  e2e:
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
      - run: npx playwright install --with-deps chromium
      - run: npx playwright test
        env:
          BASE_URL: https://uutisseuranta.net
      - uses: actions/upload-artifact@v4
        if: failure()
        with:
          name: playwright-report
          path: playwright-report/
          retention-days: 7
```

Playwright-testit sijoitetaan hakemistoon `tests/e2e/`. Testattavat kriittiset polut:

- Etusivun latautuminen ja otsikko
- Artikkelilistan renderöityminen
- Artikkelilinkin avautuminen (ei 404)
- Firebase-autentikointi (jos käytössä julkisessa näkymässä)

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
| Firebase-autentikointi E2E-testeissä | Testiympäristöllä ei ole kirjautumissessiota | Erillinen testikäyttäjä Firebasessa, credentials Secrets-varastossa |
| GitHub Pages CDN-viive | Deployment näkyy eri aikoina eri sijainneista | Playwright-testit käyttävät `waitForLoadState('networkidle')` |
| Puppeteer nykyisissä testeissä | Asentaa Chromiumin joka ajolla, hidas | Korvataan Playwrightilla (sisäänrakennettu selainhallinta) |
| `sleep 60` fragile wait | Ks. kohta 2.1 | Polling-looppi GitHub Deployments API:n kautta |

---

## 6. Viitteet

- [GitHub Actions: Reusing workflows](https://docs.github.com/en/actions/sharing-automations/reusing-workflows)
- [GitHub Actions: Security hardening](https://docs.github.com/en/actions/security-for-github-actions/security-guides/security-hardening-for-github-actions)
- [Playwright: GitHub Actions integration](https://playwright.dev/docs/ci-intro)
- [Lighthouse CI: GitHub Actions](https://github.com/treosh/lighthouse-ci-action)
- [OWASP: GitHub Actions Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/CI_CD_Security_Cheat_Sheet.html)
- [STANDARDS.md](STANDARDS.md) — saavutettavuus- ja teknologiastandardit
- [CODE_CONVENTIONS.md](CODE_CONVENTIONS.md) — koodauskäytännöt
