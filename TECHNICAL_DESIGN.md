# TECHNICAL_DESIGN.md — Uutisseuranta tekniset linjaukset

> **TECHNICAL_DESIGN.md** sisältää miten normatiiviset vaatimukset toteutetaan
> tässä projektissa. Ulkoiset normatiiviset vaatimukset ovat STANDARDS.md:ssä.

Tämä dokumentti määrittää projektin tekniset linjaukset ja arkkitehtuuripäätökset. Kaikki uudet ominaisuudet ja muutokset noudattavat näitä periaatteita, ellei yksittäisestä poikkeuksesta erikseen päätetä.

---

## Muutoshistoria

| 2026-07-03 | Yhtenäinen SemVer-versionumerointi (`vX.Y.Z`) | Yhtenäiset julkaisukäytännöt kaikkien repositorioiden välillä | Ei tagitusta / repo-kohtainen versionumerointi | — | — |
| 2026-07-03 | Firestore Security Rules: `{document=**}` wildcard `/users/{uid}/preferences/`-polun alla | Firestore v9 SDK edellyttää `match /databases/{database}/documents`-juuritasoa ja polun jokainen segmentti on täsmennettävä. `{document=**}` on rekursiivinen wildcard joka sallii `preferences/main`-dokumentin ja mahdolliset tulevat alikokelmot saman uid:n alla ilman rules-muutosta. Vaihtoehtona olisi tarkentaa polku täsmälleen `/users/{uid}/preferences/main`-tasolle — se on tiukempi mutta vaatii päivityksen jokaisesta uudesta dokumenttityypistä. | Täsmäpolku `/users/{uid}/preferences/main` (tiukempi, mutta joustamaton) | Jos preferenssirakennetta laajennetaan (esim. `/users/{uid}/preferences/notifications`) | [#31](https://github.com/uutisseuranta/uutisseuranta.github.io/pull/31) |
| 2026-07-03 | Hybrid localStorage + Firestore preferensseille | localStorage: nopeus ja offline-tuki, UI piirtyy ilman verkkoviivettä. Firestore: kanoninen lähde kirjautuneille käyttäjille, synkronoi asetukset SSO-tunnuksen mukana kaikille laitteille. Pelkkä localStorage ei riitä monilaite-käyttöön; pelkkä Firestore olisi hidas. | Pelkkä localStorage (nopea mutta ei monilaite) / Pelkkä Firestore (monilaite mutta hidas) | Jos Firestore poistetaan käytöstä tai siirrytään toiseen backendiin | [#31](https://github.com/uutisseuranta/uutisseuranta.github.io/pull/31) |
| 2026-07-03 | Firebase SDK versio pinnattu `10.12.0`, SRI ei käytössä (tietoinen päätös) | Googlen CDN on luotettu lähde; SRI-hashin ylläpito jokaisen SDK-päivityksen yhteydessä lisää operatiivista taakkaa. Hyväksytty riski tässä vaiheessa. | SRI-hash käytössä | Jos projekti kasvaa tai tietoturvavaatimukset tiukkenevat | [#28](https://github.com/uutisseuranta/uutisseuranta.github.io/issues/28) |
| 2026-07-03 | Analytics käytössä vain suostumuksen jälkeen (Google Consent Mode v2) | EU ePrivacy + GDPR vaatii suostumuksen ennen analytiikkaa | Analytics aina päällä | Jos lainsäädäntövaatimukset muuttuvat | [#28](https://github.com/uutisseuranta/uutisseuranta.github.io/issues/28) |
| 2026-07-03 | `enableIndexedDbPersistence` → tullaan siirtymään `initializeFirestore` + `persistentLocalCache` | `enableIndexedDbPersistence` on merkitty `@deprecated` Firebase SDK 10.x:ssä. Toimii vielä, mutta migraatio tehdään iteraatio 3:ssa. | Jatketaan `enableIndexedDbPersistence`:lla | SDK 10.x EOL tai breaking change | [#31](https://github.com/uutisseuranta/uutisseuranta.github.io/pull/31) |
| 2026-07-02 | SCREAMING_SNAKE_CASE sopimusdokumenteille | Yhtenäinen nimeäminen kaikkien repojen välillä; erottaa sopimukset ops-tiedostoista | kebab-case kaikille | — | [#27](https://github.com/uutisseuranta/uutisseuranta.github.io/issues/27) |
| 2026-07-02 | Cross-repo -linkit absoluuttisina GitHub-URL:eina | Relatiiviset polut eivät toimi GitHubissa cross-repo | Relatiiviset polut | — | [#27](https://github.com/uutisseuranta/uutisseuranta.github.io/issues/27) |
| 2026-07-02 | AS2-first, ei täyttä ActivityPub | ActivityPub vaatii Actor-endpointit ja federaation; AS2 riittää | Täysi ActivityPub | Jos tarvitaan federoitu verkosto | [#26](https://github.com/uutisseuranta/uutisseuranta.github.io/issues/26) |
| 2026-07-02 | Ei audience targeting -kenttiä | Kaikki objektit julkisia; kentät lisäisivät monimutkaisuutta ilman hyötyä | to/cc/bcc-kentät | Jos tarvitaan kohdennettua jakelua | [#26](https://github.com/uutisseuranta/uutisseuranta.github.io/issues/26) |

---

## Tiedostorakenne

Kaikki tiedostot sijaitsevat repositorion **juurihakemistossa**. Alikansioita ei käytetä (poikkeuksena `.github/workflows/`-hakemisto työnkulkujen määrittelyyn). GitHub Pages deployaa suoraan rootista.

```
uutisseuranta/
├── .github/
│   └── workflows/
│       └── post-deploy-test.yml
├── index.html          ← pääsivu
├── style.css           ← kaikki tyylimäärittelyt
├── app.js              ← sovelluksen päälogiikka (kirjautuminen, Firestore-alustus, UI-orkestrointi)
├── prefs.js            ← preferenssien hallintamoduuli (hybrid localStorage + Firestore)
├── profile.js          ← profiilimodaalin UI-logiikka (avaus/sulkeminen, tietojen näyttö)
├── live-smoke-test.sh  ← pipeline-testiskripti
├── firebase.json       ← Firebase-projektin konfiguraatio
├── TECHNICAL_DESIGN.md ← tämä dokumentti
└── patterns.md         ← D-CENT UI -komponenttikuvaukset (viittaa patterns-repoon)
```

Ei build-tooleja, ei paketinhallintaa (`package.json`), ei `node_modules`-hakemistoa. Sivusto on suoraan selaimessa ajettavaa HTML/CSS/JS:ää.

**Dokumentaatiotiedostot sijaitsevat juuressa** – ei `docs/`-alikansioita. Kaikki `.md`-tiedostot ovat repositorion juuressa.

### `prefs.js` vs. `profile.js` — omistajuusraja

Nämä ovat kaksi erillistä moduulia, jotka molemmat liittyvät käyttäjään, mutta niillä on eri vastuualueet:

| Moduuli | Vastuualue | Ei vastaa |
|---|---|---|
| `prefs.js` | Preferenssidatan hallinta: luku, kirjoitus, synkronointi (localStorage + Firestore), migraatio, muutoskuuntelijat | UI:n piirtoon liittyvistä asioista |
| `profile.js` | Profiilimodaalin UI-elinkaari: avaus, sulkeminen, käyttäjätietojen näyttö DOM:issa | Datan tallennuksesta tai Firestoresta |

`profile.js` kutsuu `prefs.js`:n julkista API:ta (`getPrefs()`, `onPrefsChange()`) UI:n päivittämiseen — mutta se ei kirjoita dataa suoraan. Preferenssien päivittäminen käyttäjän toimesta tapahtuu aina `updatePrefs()`-kutsun kautta (`prefs.js`).

### `patterns.md` — mikä se on?

`patterns.md` on luettelo D-CENT UI -komponenteista, joita tämä sovellus kuluttaa [`patterns`-reposta](https://github.com/uutisseuranta/patterns). Se dokumentoi minkä komponenttien CSS-luokat ovat käytössä tässä sovelluksessa ja mistä ne ladataan. Se ei ole normatiivinen määrittely — normatiivinen määrittely on `patterns`-repon `TECHNICAL_DESIGN.md`:ssä.

---

## Teknologiavalinnat

### Sallitut teknologiat

| Kerros | Teknologia | Perustelu |
|---|---|---|
| Rakenne | HTML5, semanttiset elementit | Standardi, ei riippuvuuksia |
| Tyyli | CSS (vanilla), CSS-muuttujat, `clamp()` | Standardi, ei preprosessoria |
| Logiikka | JavaScript (vanilla ES-moduulit) | Standardi, ei frameworkia |
| Autentikointi | Firebase Authentication | Ks. Firebase-rajaus |
| Analytiikka | Firebase Analytics + GA4 | Ks. Firebase-rajaus + Analytics/GDPR-osio |
| Fontit | Järjestelmäfonttipino tai `@font-face` + `local()` | Ei CDN-riippuvuuksia, avoimen standardin ratkaisu |
| Testit | Bash + `curl` + standardit Unix-työkalut | Ks. Testausstrategia |

### Kielletyt teknologiat

- **Testausframeworkit** (Playwright, Puppeteer, Jest, Vitest, Cypress, tms.) — ei käytetä koskaan. Testit kirjoitetaan vanilla Bash/curl-pohjaisesti avoimen standardin työkaluilla.
- **JavaScript-frameworkit** (React, Vue, Angular, Svelte, tms.) — ei tarvita staattiselle sivulle.
- **CSS-preprosessorit** (Sass, Less, PostCSS) — moderni vanilla CSS riittää.
- **Build-työkalut** (Webpack, Vite, Rollup, Parcel, tms.) — ei build-steppiä.
- **Erillinen monitorointipalvelu** (Datadog, Sentry, tms.) — laatu varmistetaan pipelinessa ennen tuotantoa.
- **PR preview -ympäristöt** (Netlify, Cloudflare Pages, tms.) — pipeline testaa ennen mergeä, erillisiä preview-ympäristöjä ei tarvita.
- **Ulkoiset fontti-CDN:t** (Google Fonts, Fontshare, Adobe Fonts, tms.) — fonttilatauksista ei saa syntyä kolmannen osapuolen verkkopyyntöjä.

---

## Firebase-rajaus

Firebase-SDK:ta käytetään **ainoastaan** kolmessa tarkoituksessa:

1. **Authentication** (`firebase-auth`) — Google Sign-In, kirjautumistilan seuranta, uloskirjautuminen.
2. **Analytics** (`firebase-analytics`) — automaattinen käyttödatan keruu, linkitetty GA4-propertyyn.
3. **Database** (`firebase-firestore`) — kirjautuneen käyttäjän asetusten (seuratut tagit, teema) synkronointi laitteiden välillä.

### Persistointimalli: Hybrid localStorage + Firestore

Preferenssien tallennus on toteutettu kaksitasoisena:

| Taso | Teknologia | Tarkoitus |
|---|---|---|
| 1. (nopea) | `localStorage` | Paikallinen välimuisti — UI piirtyy ilman verkkoviivettä, toimii offline ja PWA-tilassa |
| 2. (kanoninen) | Firestore | Laitteiden välinen synkronointi kirjautuneille käyttäjille SSO-tunnuksen mukana |

- **Kirjautumaton käyttäjä:** vain `localStorage` (avain `prefs_anonymous`)
- **Kirjautunut käyttäjä:** localStorage + Firestore molemmat
- **Kirjoitusjärjestys:** ensin `localStorage` välittömästi → sitten Firestore 500 ms debounce-viiveellä
- **Lukujärjestys käynnistyksessä:** ensin `localStorage` (synkroninen, UI piirtyy heti) → sitten Firestore (asynkroninen, korvaa jos palvelimen tila on uudempi)
- **PWA-käyttö:** Firestore IndexedDB-persistointi mahdollistaa preferenssien luvun ja kirjoituksen myös offline-tilassa. Service Worker huolehtii staattisista resursseista; `prefs.js` huolehtii datan offline-pysyvyydestä. Yhdessä ne muodostavat täyden PWA-offline-kokemuksen.

> **⚠️ Deprecaatiohuomio:** `enableIndexedDbPersistence()` on merkitty `@deprecated` Firebase SDK 10.x:ssä.
> Suositeltava korvaaja on `initializeFirestore(app, { localCache: persistentLocalCache() })`.
> Migraatio on suunniteltu iteraatio 3:een — tähän asti toiminnallisuus säilyy ennallaan.

Toteutus: `prefs.js`

### Offline error handling -politiikka

Seuraavat edge caset on käsitelty eksplisiittisesti `prefs.js`:ssä:

| Tilanne | Käsittelytapa |
|---|---|
| Käyttäjä on offline, yritetään lukea preferenssejä | `localStorage` palvelee arvot synkronisesti — Firestore-lataus skipataan hiljaisesti |
| Käyttäjä on offline, yritetään kirjoittaa preferenssejä | `localStorage` kirjoitetaan välittömästi; Firestore-kirjoitus jonottuu IndexedDB:hen ja synkronoidaan kun yhteys palautuu |
| `localStorage` on täynnä tai yksityistila estää kirjoittamisen | `_writeLocal()` epäonnistuu hiljaisesti (try/catch ilman `console.error`) — UI toimii muistissa olevilla arvoilla |
| Firebase SDK:n lataus epäonnistuu (CDN-häiriö) | Sivusto latautuu ilman Firebase-toimintoja; kirjautuminen ei onnistu mutta staattinen sisältö toimii normaalisti |
| `followedTags` on väärää tyyppiä (esim. merkkijono JSON-korruption vuoksi) | `_migrate()` normalisoi arvon taulukoksi — `followTag()` / `unfollowTag()` eivät hajoa |

Kaikki muu toiminnallisuus (uutisten haku, tallennus, hosting jne.) toteutetaan muilla teknologioilla. Firebase-SDK:n laajentaminen uusiin palveluihin vaatii eksplisiittisen arkkitehtuuripäätöksen ennen toteutusta.

Firebase SDK ladataan ES-moduuleina suoraan Googlen CDN:ltä ilman build-steppiä:
```html
<script type="module">
  import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
  import { getAuth, ... } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
  import { getAnalytics } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-analytics.js';
  import { getFirestore } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
</script>
```

---

## Testausstrategia

Testit kirjoitetaan `live-smoke-test.sh`-tiedostoon. Testit ajetaan CI/CD-pipelinessa jokaisen deployn jälkeen.

### Periaatteet

- **Ei testausframeworkeja** — kaikki testit ovat vanilla Bash + `curl` + standardit Unix-työkalut.
- **Live-testit tuotannossa** — testit ajetaan tuotantoympäristöä vasten, ei paikallista mock-ympäristöä.
- **HTTP-statuskoodit + sisällön validointi** — tarkistetaan että sivusto vastaa oikein ja kriittiset elementit löytyvät.

### Pipeline

`.github/workflows/post-deploy-test.yml` ajaa `live-smoke-test.sh`:n jokaisen push-deployn jälkeen GitHub Pagesiin.

## Versionumerointi ja julkaisut (Release)

Projektissa noudatetaan yhtenäistä versionumerointi- ja julkaisukäytäntöä kaikkien repositorioiden välillä:
- **SemVer (Semantic Versioning):** Versionumerot noudattavat muotoa `vX.Y.Z` (esim. `v0.1.0`).
- **Tagien luominen:** Uusi julkaisu luodaan tekemällä vastaava Git-tagi (`vX.Y.Z`) ja julkaisemalla se GitHub Releases -palvelussa.
- **Julkaisuvastuu:** Jokaisesta tuotantoon viedystä merkittävästä välitavoitteesta (kuten Iteraatioiden valmistumisesta) luodaan virallinen SemVer-julkaisu.

---

## Analytics ja GDPR

Firebase Analytics + GA4 käytössä **vain** käyttäjän suostumuksen jälkeen:

- **Google Consent Mode v2** — `analytics_storage` ja `ad_storage` oletuksena `denied`.
- Analytics aktivoituu vasta kun käyttäjä hyväksyy suostumuksen.
- Suostumus tallennetaan `localStorage`:hen (avain `consent_analytics`).
- EU ePrivacy -direktiivin ja GDPR:n mukainen toteutus.

---

## Iteraatiot

### Iteraatio 3 — Scope

> **Suunniteltu:** 2026-07-03 | **Arviointijakso:** Iteraation 3 sprintti

#### Teema 1: Rajapintaintegraatio ja dynaaminen uutisvirta (Core MVP)

| # | Repo | Tiketti | Kuvaus |
|---|---|---|---|
| 1 | `uutisseuranta.github.io` | [#12](https://github.com/uutisseuranta/uutisseuranta.github.io/issues/12) | Uutisten dynaaminen tulostaminen etusivulle (D-CENT media + Activity Streams 2.0) |
| 2 | `patterns` | [#24](https://github.com/uutisseuranta/patterns/issues/24) | Vaihe 2 — Molecules + Organisms: lisää komponentit index.html-visualisointiin |
| 3 | `patterns` | [#40](https://github.com/uutisseuranta/patterns/issues/40) | feat: lisää AS2 @context ja id semanttiset data-attribuutit artikkelikortille |

#### Teema 2: Käyttäjävuorovaikutus (Like / Dislike & Agree / Disagree)

| # | Repo | Tiketti | Kuvaus |
|---|---|---|---|
| 4 | `bq-activitystreams` | [#33](https://github.com/uutisseuranta/bq-activitystreams/issues/33) | feat: vastaanota Like/Dislike-aktiviteetit ja summaa Agree+Disagree-laskurit |
| 5 | `uutisseuranta.github.io` | [#20](https://github.com/uutisseuranta/uutisseuranta.github.io/issues/20) | feat: näytä Like/Dislike-äänet Agree/Disagree-näyttönimillä ja summaa laskurit |
| 6 | `uutisseuranta.github.io` | [#21](https://github.com/uutisseuranta/uutisseuranta.github.io/issues/21) | feat: käyttäjäprofiilin Agree/Disagree-jakaumagrafiikka (Like/Dislike-historiastatiikka) |

#### Teema 3: Laadunvalvonta, testaus ja vakauttaminen (QA & Refactoring)

| # | Repo | Tiketti | Kuvaus |
|---|---|---|---|
| 7 | `patterns` | [#55](https://github.com/uutisseuranta/patterns/issues/55) | chore: ota käyttöön W3C Markup Validator- ja Stylelint-työkalut laadunvalvontaan |
| 8 | `patterns` | [#56](https://github.com/uutisseuranta/patterns/issues/56) | style.css rakenteellistaminen: jaottelu osioihin ja ylläpidettävyyden parantaminen |
| 9 | `bq-activitystreams` | [#27](https://github.com/uutisseuranta/bq-activitystreams/issues/27) | Testing: Poista koodiduplikaatio unit-test.sh -tiedostosta ja importtaa suoraan rss_fetch_jobista |
| 10 | `bq-activitystreams` | [#28](https://github.com/uutisseuranta/bq-activitystreams/issues/28) | Testing: Laajenna write-api:n yksikkötestejä (Create, Like, Update) |
| 11 | `bq-activitystreams` | [#29](https://github.com/uutisseuranta/bq-activitystreams/issues/29) | Testing: Lisää yksikkötestit query-api -lukurajapinnalle |
| 12 | `bq-activitystreams` | [#30](https://github.com/uutisseuranta/bq-activitystreams/issues/30) | Testing: Lisää yksikkötestit og-scraperille ja og-enrichment-jobille |

#### Backlogiin siirretty (Iteraatio 4+)

- `uutisseuranta.github.io` [#2](https://github.com/uutisseuranta/uutisseuranta.github.io/issues/2): UP-9: Henkilökohtainen uutisvirtanäkymä (tagipohjainen suodatus)
- `uutisseuranta.github.io` [#7](https://github.com/uutisseuranta/uutisseuranta.github.io/issues/7): UP-14: Hakutoiminto (client-side haku)
- `uutisseuranta.github.io` [#8](https://github.com/uutisseuranta/uutisseuranta.github.io/issues/8): UP-15: Kirjautumisen ja anonyymiyskäytäntöjen yhtenäistäminen
- `uutisseuranta.github.io` [#16](https://github.com/uutisseuranta/uutisseuranta.github.io/issues/16): UI: tagipilvi hakutulosten rajoittuessa 500:aan
- `patterns` [#25](https://github.com/uutisseuranta/patterns/issues/25): Vaihe 3 — Templates: lisää sivumallit index.html-visualisointiin

