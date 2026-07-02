# TECHNICAL_DESIGN.md — Uutisseuranta tekniset linjaukset

> **TECHNICAL_DESIGN.md** sisältää miten normatiiviset vaatimukset toteutetaan
> tässä projektissa. Ulkoiset normatiiviset vaatimukset ovat STANDARDS.md:ssä.

Tämä dokumentti määrittää projektin tekniset linjaukset ja arkkitehtuuripäätökset. Kaikki uudet ominaisuudet ja muutokset noudattavat näitä periaatteita, ellei yksittäisestä poikkeuksesta erikseen päätetä.

---

## Muutoshistoria

| Päivämäärä | Päätös | Perustelu | Vaihtoehto jota harkittiin | Revisit-kriteeri | Issue |
|---|---|---|---|---|---|
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

### Firebase SDK -versiopinnoitus

SDK-versio on pinnattu `10.12.0` CDN-URL:issa. Linjaukset:

- **Päivitysomistaja:** kehittäjä joka tekee muutoksia Firebase-integraatioon.
- **Päivityskriteeri:** Firebase release notesissa mainittu tietoturvakorjaus tai breaking change jota käytetään.
- **Päivitysprosessi:** vaihda versio kaikissa CDN-URL:issa (`index.html`, `prefs.js`) — testaa smoke-testillä ennen mergeä.
- **SRI-hash:** ei käytössä (ks. muutoshistoria). Googlen CDN on luotettu lähde; riski hyväksytty tietoisesti.

### Firebase Security Rules -rakenne

Firebase Security Rules määrittää kuka saa lukea ja kirjoittaa Firestore-dataa. Koska Firebase Web API -avain on julkinen, turvallisuus lepaa kokonaan Security Rulesin varassa.

**Preferenssien Security Rules -periaatteet:**

```javascript
// Firestore Security Rules — /users/{uid}/preferences/main
// Vain kirjautunut käyttäjä voi lukea ja kirjoittaa omia preferenssejään.
// Toisen käyttäjän preferenssit eivät ole luettavissa eivätkä kirjoitettavissa.
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{uid}/preferences/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == uid;
    }
  }
}
```

- **Luku:** vain oma `uid` — preferenssit eivät ole julkisia
- **Kirjoitus:** vain autentikoitunut käyttäjä omaan dokumenttiinsa
- **Kaikki muu Firestore-data:** kielletty oletuksena (`deny all`)

---

## Analytics ja GDPR-suostumus

Firebase Analytics + GA4 on sallittu teknologia, mutta EU:n ePrivacy-direktiivi ja GDPR vaativat käyttäjän suostumuksen ennen analytiikkakeksien asettamista.

### Linjaus

- **Analytics aktivoidaan vasta suostumuksen jälkeen.** Ennen suostumusta Firebase Analytics initialisoidaan Google Consent Mode v2 -tilassa `analytics_storage: 'denied'`.
- **Suostumusmekanismi:** yksinkertainen banner/ilmoitus sivun ensimmäisellä latauksella. Valinta tallennetaan `localStorage`:hen (avain `consent_analytics`).
- **Suostumuksen peruuttaminen:** käyttäjä voi perääntyä suostumuksesta profiiliasetuksista — `analytics_storage` asetetaan takaisin `'denied'` ja sivu ladataan uudelleen.

```javascript
// Google Consent Mode v2 — asetetaan ennen analytics-initialisointia
gtag('consent', 'default', {
  analytics_storage: localStorage.getItem('consent_analytics') === 'granted'
    ? 'granted'
    : 'denied',
});
```

> **⚠️ Tietoinen välivaihe — ePrivacy-riski:** Suostumusmekanismin UI-toteutus on osa iteraatio 3:n laajuutta.
> Iteraatio 2:ssa Analytics on käytössä ilman consent-banneria — tämä tarkoittaa, että ePrivacy-direktiiviä
> rikotaan heti kun ensimmäinen EU-käyttäjä lataa sivun. Riski on hyväksytty tietoisesti koska tuotanto ei
> ole vielä julkinen laajalle yleisölle. **Revisit-kriteeri: ennen julkista lanseerausta.**

---

## Testausstrategia

### Periaatteet

- **Kaikki testaus tapahtuu CI/CD-pipelinessa.** Ei erillistä monitorointia tuotannossa, ei erillisiä testiympäristöjä.
- **Testit kirjoitetaan vanilla Bash + `curl` + standardit Unix-työkalut.** Ei testausframeworkeja koskaan.
- **Pipeline on portti tuotantoon.** Kaikki testit ajetaan ennen tai välittömästi deployn jälkeen.
- **Yksinkertaisuus ennen kattavuutta.** Yksi luotettava smoke-testi on parempi kuin kymmenen haurasta yksikkötestiä.

### Pipeline-rakenne

```
push → main
  └─ GitHub Pages deploy (automaattinen)
       └─ Odota deployn valmistuminen (Pages API -pollaus)
            └─ Aja live-smoke-test.sh
                 ├─ OK  → sivu on tuotannossa
                 └─ ERR → GitHub Actions -ilmoitus, korjaa ja pushaa uudelleen
```

### `live-smoke-test.sh` — mitä testataan

Skripti testaa seuraavat asiat järjestyksessä:

| # | Testi | Epäonnistumisehto |
|---|---|---|
| 1 | `index.html` vastaa HTTP 200 | status != 200 |
| 2 | `style.css` vastaa HTTP 200 | status != 200 |
| 3 | `app.js` vastaa HTTP 200 | status != 200 |
| 4 | `prefs.js` vastaa HTTP 200 | status != 200 |
| 5 | `index.html` sisältää odotetun otsikkotekstin (`<title>`) | grep miss |
| 6 | `index.html` sisältää Firebase SDK -skriptiviittauksen | grep miss |

Testit eivät testaa JavaScript-suoritusta, Firebase Auth -yhteyttä tai Firestore-kirjoituksia — nämä vaatisivat headless-selaimen (kielletty teknologia). Smoke-testin tarkoitus on varmistaa että deploy onnistui ja päätiedostot ovat saatavilla.

---

## Deployment

Sivusto deployataan **GitHub Pagesille** suoraan `main`-haarasta. Deploy tapahtuu automaattisesti jokaisen `main`-pushin jälkeen.

- Tuotanto-URL: `https://uutisseuranta.net`
- GitHub Pages -URL: `https://jaakkokorhonen.github.io/uutisseuranta`

Ei Netlifyä, ei Cloudflare Pagesia, ei muita hostingpalveluja.

---

## Turvallisuus

### Firebase Web API -avain on tarkoituksellisesti julkinen

Firebase Web API -avain näkyy `index.html`:ssä selkotekstinä. Tämä on tietoinen päätös — Google dokumentoi eksplisiittisesti, että avain on tarkoitettu julkiseksi. Turvallisuus varmistetaan Firebase-projektin puolella (Authorized Domains, Security Rules) — ks. Firebase Security Rules -rakenne yllä.

### Content Security Policy

CSP määritellään `<meta http-equiv="Content-Security-Policy">`-tagilla `index.html`:ssä rajoittamaan sallitut skriptilähteet.

Nykyinen CSP sallii vähintään:
- `script-src`: `https://www.gstatic.com` (Firebase SDK CDN)
- `connect-src`: `https://firestore.googleapis.com`, `https://identitytoolkit.googleapis.com`
- `default-src`: `'self'`

CSP:n täydellinen määrittely kirjataan osaksi [#28](https://github.com/uutisseuranta/uutisseuranta.github.io/issues/28) Security Hardening -tikettiä.

---

## Suunnittelu- ja kehityskäytännöt

### Teknologiavalintojen ensisijaisuusperiaate

Projektissa suositaan riippuvuuksien minimoimiseksi ja järjestelmän pitkäikäisyyden takaamiseksi seuraavaa järjestystä teknologiavalinnoissa:

1. **Ensisijaisesti:** Avoimet standardit (kuten ActivityStreams 2.0, WCAG 2.1 AA, standardit web-rajapinnat).
2. **Toissijaisesti:** Standardoidut, de facto standardoidut tai puhtaat "vanilla"-teknologiat (kuten Vanilla JS, Vanilla CSS, `localStorage`, natiivi selainpersistointi).

Tämä periaate vähentää ulkopuolisten kirjastojen ja build-työkalujen tarvetta ja pitää koodikannan helposti ylläpidettävänä.

### Luonnos-Pull Requestit (Draft PR) ja kysymykset kontekstissa

Laajat tai monimutkaiset kokonaisuudet voidaan aloittaa avaamalla luonnos-Pull Request (Draft PR).

- PR voi aluksi olla toiminnallisesti tyhjä tai sisältää vain alustavan runkoehdotuksen.
- Avoimet arkkitehtuurikysymykset ja toteutusvaihtoehdot kirjataan suoraan Pull Requestin kommenteiksi, jolloin niihin on helpompi vastata ja niistä voidaan keskustella suoraan koodikontekstissa ennen varsinaista toteutusta.

### Koodin laadun ja tietoturvan valvonta (Ruff)

- Taustapalveluissa (Python) koodin tyylin, laadun (isort, pycodestyle) ja tietoturvan (bandit) valvonnassa käytetään **Ruff**-työkalua.
- Ruff on konfiguroitu juuritason `pyproject.toml`-tiedostossa ja sen tarkistukset ajetaan osana automaattista CI/CD-pipelinea jokaisen koodipushin yhteydessä.

---

## Muutosten tekeminen

Kaikki muutokset tehdään **pull requestina**. Suora push `main`-haaraan on sallittu vain dokumentaatiomuutoksille.

PR:n otsikko noudattaa [Conventional Commits](https://www.conventionalcommits.org/) -käytäntöä:
- `feat:` — uusi ominaisuus
- `fix:` — bugikorjaus
- `docs:` — dokumentaatiomuutos
- `refactor:` — koodin rakennemuutos ilman toiminnallisuusmuutosta
- `chore:` — ylläpito (riippuvuudet, konfiguraatio)
