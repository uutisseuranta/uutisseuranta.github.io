# Uutisseuranta – Frontend

Uutisseuranta on moderni ja saavutettava suomalainen uutiskoostepalvelu, joka yhdistää eri lähteiden julkaisut yhteen selkeään uutisvirtaan. Tämä repositorio sisältää palvelun staattisen verkkokäyttöliittymän, joka on toteutettu standardeilla vanilla HTML, CSS ja JavaScript -tekniikoilla ilman monimutkaisia build-vaiheita. Käyttöliittymän visuaalinen ilme ja komponenttirakenne noudattavat uutisseurannan kuviointikirjaston periaatteita.

## Dokumentaatio

- [TECHNICAL_DESIGN.md](./TECHNICAL_DESIGN.md) — Arkkitehtuuriratkaisut, komponenttimalli ja release-prosessi.
- [STANDARDS.md](./STANDARDS.md) — WCAG-saavutettavuusvaatimukset, GDPR-linjaukset ja datan AS2-muotoilu.
- [DESIGN_GUIDELINES.md](./DESIGN_GUIDELINES.md) — Visuaalisen ilmeen ja käyttöliittymän suunnittelulinjat.
- [USER_PATHS.md](./USER_PATHS.md) — Käyttäjäpolut ja käyttötapaukset (UP-1 – UP-15).
- [LICENSES.md](./LICENSES.md) — Kolmannen osapuolen riippuvuudet ja lisenssit.

## Testaus

Nykytila (ks. [TESTING.md](./TESTING.md) tarkempi kuvaus ja suunnitellut laajennukset):

### 1. PR-validointi (`pr-validate.yml`)
Jokainen pull request kääntää käyttöliittymän Vitellä (`npm run build`) — varmistaa, ettei build ole rikki.

### 2. Playwright-smoke-testi (`tests/e2e/smoke.spec.js`)
*   Ajo: `npm test`
*   Tarkistaa mm. artikkelikorttien latautumisen, konsolivirheiden puuttumisen, teemanvaihtajan toiminnan ja kirjautumismodaalin avautumisen.

### 2b. Yksikkötestit (`tests/unit/`, Vitest)
*   Ajo: `npm run test:unit`
*   Kattaa `prefs.js`- (preferenssien lataus, migraatio, Firestore-synkka) ja `profile.js`-moduulien (profiilimodaalin renderöinti, tagien poisto, teemanvaihto, uloskirjautuminen) logiikan mockatulla Firebase-kirjastolla.

### 3. Post-deploy smoke-testi
`live-smoke-test.sh` tarkistaa julkaisun jälkeen, että sivusto vastaa (`https://uutisseuranta.net`, `https://uutisseuranta.github.io`), ja `post-deploy-test.yml` laukaisee varsinaiset selainpohjaiset smoke-testit erillisessä [`uutisseuranta/ops`](https://github.com/uutisseuranta/ops)-repositoriossa `repository_dispatch`-tapahtumalla.

Integraatio-, a11y- ja visuaalinen regressiotestaus sekä Lighthouse CI on suunniteltu mutta ei vielä toteutettu tässä repossa — ks. [TESTING.md § 10 Roadmap](./TESTING.md#10-tulevat-testausparannukset-roadmap).