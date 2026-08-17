# TECHNICAL_DESIGN.md — Uutisseuranta tekniset linjaukset

> **TECHNICAL_DESIGN.md** sisältää miten normatiiviset vaatimukset toteutetaan
> tässä projektissa. Ulkoiset normatiiviset vaatimukset ovat STANDARDS.md:ssä.

Tämä dokumentti määrittää projektin tekniset linjaukset ja arkkitehtuuripäätökset. Kaikki uudet ominaisuudet ja muutokset noudattavat näitä periaatteita, ellei yksittäisestä poikkeuksesta erikseen päätetä.

---

## Muutoshistoria

| Päivämäärä | Päätös | Perustelu | Hylätty vaihtoehto | Vanhenemisehto | Viite |
| 2026-08-17 | Koodikannan laatu- ja käytettävyyskorjaukset (L-022) | Poistettiin linkkien asynkroninen klikinsieppaus; täydennettiin GDPR-tilinpoisto `seen_list_`-siivouksella; korjattiin ilmoitusmerkin logiikka; poistettiin estävät `alert()`-kutsut ja picsum-fallbackit sekä ohjattiin pää-CTA uutisvirtaan. | Vanhat siepparit ja epätäydellinen GDPR-siivous | Jos siirrytään kokonaan uuteen UI-arkkitehtuuriin | DECISION_LOG.csv |
| 2026-08-17 | Koodin ositus ja Firebase-bundlen eriyttäminen (L-021) | Eriytetään Firebase SDK omaksi `vendor-firebase`-paketiksi (`manualChunks`) ja ladataan profiilimodaali laiskasti (`import()`). Pienentää pääpaketin kokoa yli 85 % ja nopeuttaa ensilatausta. | Yksi suuri monoliittinen pääbundle | Jos siirrytään toiseen pakkaajaan tai SPA-kehykseen | [#176](https://github.com/uutisseuranta/uutisseuranta.github.io/pull/176) |
| 2026-08-17 | Tapahtumapohjainen luettujen eräsynkronointi ilman taustapollausta (L-020) | Korvattu passiivinen 5s setInterval-pollaussilmukka 4 tapahtumatriggerillä (idle-debounce 2s, sivutus, virkistys, visibilitychange). | Jatkuva intervallipollaus selaimessa | Jos siirrytään kaksisuuntaiseen WebSocket- tai SSE-virtaan | [#170](https://github.com/uutisseuranta/uutisseuranta.github.io/issues/170) |
| 2026-08-17 | Luettujen uutisten backend-suodatus ja `showReadArticles`-kytkimen poisto (L-018) | Siirretään luettujen uutisten suodatus suoraan BigQuery-tietokantakyselyyn (`seen_ids` ja `activities`-taulu) ja poistetaan vanhentunut `showReadArticles`-asetus. Palauttaa aina täydet eräkoot ilman tyhjiä kortteja. | Asiakaspuolen DOM-piilotus (jätti tyhjiä korttipaikkoja) | Jos uutisvirran suodatus siirretään toiseen tietokantaan | [#154](https://github.com/uutisseuranta/uutisseuranta.github.io/pull/154) [#178](https://github.com/uutisseuranta/uutisseuranta.github.io/pull/178) |
| 2026-08-17 | Maksumuuriuutisten toimitus frontendille ja Wayback Machine -arkisto-ohjaus (L-019) | Poistettiin kova maksumuurisuodatus backendin SQL-kyselystä, jotta frontend voi näyttää uutiset ja ohjata käyttäjän automaattisesti toimivaan arkistoversioon. | Maksumuuriuutisten kova poissulku tietokannassa | Jos uutisille saadaan suora vapaa lukuoikeus | [#133](https://github.com/uutisseuranta/uutisseuranta.github.io/pull/133) |
| 2026-07-28 | Reaktiopainikkeet 1-tason kommenteissa artikkelikortin sijaan (L-017) | D-CENT-deliberaatiomallissa käyttäjät ottavat kantaa puheenvuoroihin (kommentteihin). Artikkelikorttiin jätetään vain kommenttilaskuri ja avaustoiminto. | Artikkelikohtaiset Like/Dislike-napit | Jos D-CENT-keskustelumallista luovutaan | [#11](https://github.com/uutisseuranta/uutisseuranta.github.io/issues/11) |
| 2026-07-27 | Uutisvirran dynaaminen scroll-sivutus (5->50->500) ja 2-tasoinen kommentointi (D-CENT) | Parantaa alkulatauksen nopeutta ja rajaa BigQuery-hakuja. Kommenttitekstit säilyvät localStoragessa kirjautumisen ylitse. | Sivunumerointi ja perinteinen sivutus (ei sovi AS2-malliin) | Jos siirrytään kursooripohjaiseen sivutukseen | [#10](https://github.com/uutisseuranta/bq-activitystreams/issues/10) [#11](https://github.com/uutisseuranta/uutisseuranta.github.io/issues/11) |
| 2026-07-27 | Testaustyökalut: `@playwright/test`, `@axe-core/playwright`, `@lhci/cli` hyväksytty devDependencyinä | E2E-, a11y- ja suorituskykytestaus edellyttää selainkontrollia, jota Bash+curl ei pysty toteuttamaan. DevDependencyt eivät päädy tuotantobundleen (Vite tree-shaking). Bash+curl `live-smoke-test.sh` säilyy post-deploy-pollingia varten. | Pelkkä Bash+curl (riittämätön JS-renderöinnin testaukseen) | Jos Playwright korvataan toisella testaustyökalulla | [#80](https://github.com/uutisseuranta/uutisseuranta.github.io/issues/80) [#81](https://github.com/uutisseuranta/uutisseuranta.github.io/issues/81) |
| 2026-07-03 | Koodin kommentointi -konventiot lisätty | Yhtenäinen kommentointikäytäntö JS/CSS/HTML/Python/Bash kaikissa kolmessa reposa | Ei yhtenäistä käytäntöä | - | - |
| 2026-07-03 | Yhtenäinen SemVer-versionumerointi (`vX.Y.Z`) | Yhtenäiset julkaisukäytännöt kaikkien repositorioiden välillä | Ei tagitusta / repo-kohtainen versionumerointi | - | - |
| 2026-07-03 | Firestore Security Rules: `{document=**}` wildcard `/users/{uid}/preferences/`-polun alla | Firestore v9 SDK edellyttää `match /databases/{database}/documents`-juuritasoa ja polun jokainen segmentti on täsmennettävä. `{document=**}` on rekursiivinen wildcard joka sallii `preferences/main`-dokumentin ja mahdolliset tulevat alikokoelmat saman uid:n alla ilman rules-muutosta. | Täsmäpolku `/users/{uid}/preferences/main` (tiukempi, mutta joustamaton) | Jos preferenssirakennetta laajennetaan (esim. `/users/{uid}/preferences/notifications`) | [#31](https://github.com/uutisseuranta/uutisseuranta.github.io/pull/31) |
| 2026-07-03 | Hybrid localStorage + Firestore preferensseille | localStorage: nopeus ja offline-tuki, UI piirtyy ilman verkkoviivettä. Firestore: kanoninen lähde kirjautuneille käyttäjille, synkronoi asetukset SSO-tunnuksen mukana kaikille laitteille. Pelkkä localStorage ei riitä monilaite-käyttöön; pelkkä Firestore olisi hidas. | Pelkkä localStorage (nopea mutta ei monilaite) / Pelkkä Firestore (monilaite mutta hidas) | Jos Firestore poistetaan käytöstä tai siirrytään toiseen backendiin | [#31](https://github.com/uutisseuranta/uutisseuranta.github.io/pull/31) |
| 2026-07-03 | Firebase SDK versio pinnattu `10.12.0`, SRI ei käytössä (tietoinen päätös) | Googlen CDN on luotettu lähde; SRI-hashin ylläpito jokaisen SDK-päivityksen yhteydessä lisää operatiivista taakkaa. Hyväksytty riski tässä vaiheessa. | SRI-hash käytössä | Jos projekti kasvaa tai tietoturvavaatimukset tiukkenevat | [#28](https://github.com/uutisseuranta/uutisseuranta.github.io/issues/28) |
| 2026-07-03 | Analytics käytössä vain suostumuksen jälkeen (Google Consent Mode v2) | EU ePrivacy + GDPR vaatii suostumuksen ennen analytiikkaa | Analytics aina päällä | Jos lainsäädäntövaatimukset muuttuvat | [#28](https://github.com/uutisseuranta/uutisseuranta.github.io/issues/28) |
| 2026-07-26 | `initializeFirestore` + `persistentLocalCache` offline-persistoinnille | `enableIndexedDbPersistence` on korvattu uudella API:lla race conditionien välttämiseksi ja offline-persistoinnin varmistamiseksi. Migraatio tehty PR #65 yhteydessä. | `enableIndexedDbPersistence` (deprecated) | - | [#65](https://github.com/uutisseuranta/uutisseuranta.github.io/pull/65) |
| 2026-07-02 | SCREAMING_SNAKE_CASE sopimusdokumenteille | Yhtenäinen nimeäminen kaikkien repojen välillä; erottaa sopimukset ops-tiedostoista | kebab-case kaikille | - | [#27](https://github.com/uutisseuranta/uutisseuranta.github.io/issues/27) |
| 2026-07-02 | Cross-repo -linkit absoluuttisina GitHub-URL:eina | Relatiiviset polut eivät toimi GitHubissa cross-repo | Relatiiviset polut | - | [#27](https://github.com/uutisseuranta/uutisseuranta.github.io/issues/27) |
| 2026-07-02 | AS2-first, ei täyttä ActivityPub | ActivityPub vaatii Actor-endpointit ja federaation; AS2 riittää | Täysi ActivityPub | Jos tarvitaan federoitu verkosto | [#26](https://github.com/uutisseuranta/uutisseuranta.github.io/issues/26) |
| 2026-07-02 | Ei audience targeting -kenttiä | Kaikki objektit julkisia; kentät lisäisivät monimutkaisuutta ilman hyötyä | to/cc/bcc-kentät | Jos tarvitaan kohdennettua jakelua | [#26](https://github.com/uutisseuranta/uutisseuranta.github.io/issues/26) |

---

## Tiedostorakenne

Projekti käyttää **Vite-pakkaajaa** ja **npm-paketinhallintaa** (päätös `L-009`) tuotantoversion kääntämiseen ja Workbox PWA -toteutukseen. Lähdekoodi ja tyylit on ryhmitelty `src/`-kansioon ja lopullinen tuotantoversio käännetään `dist/`-kansioon, josta GitHub Pages tekee automaattisen julkaisun (päätös `L-011`).

```
uutisseuranta/
├── .github/
│   └── workflows/
│       ├── deploy.yml              ← Automaattinen deploy GitHub Pagesille (Vite-build)
│       ├── pr-validate.yml         ← PR-validointi: build, linkit, a11y, integraatio
│       ├── post-deploy-test.yml    ← Post-deploy smoke-testit (E2E)
│       └── lighthouse.yml          ← Suorituskykyauditointi (viikoittain)
├── dist/                           ← Viten generoima tuotantobuild (Pages-julkaisukohde)
├── src/                            ← Lähdekoodikansio
│   ├── main.js                     ← Viten entrypoint — kaikki Firebase-alustus tapahtuu täällä
│   ├── app.js                      ← Sovelluksen päälogiikka (UI-orkestrointi, Auth)
│   ├── prefs.js                    ← Preferenssien hallinta (localStorage + Firestore)
│   ├── profile.js                  ← Profiilimodaalin UI-logiikka
│   └── style.css                   ← Native CSS -tyylit ja Cascade Layerit
├── tests/                          ← Testit (devDependency — ei tuotantobundleen)
│   ├── a11y/
│   │   └── accessibility.spec.js   ← axe-core/Playwright WCAG 2.2 AA (PR-validointi)
│   ├── e2e/
│   │   └── smoke.spec.js           ← E2E smoke-testit (post-deploy)
│   ├── integration/
│   │   └── api-mock.spec.js        ← API mock page.route (PR-validointi)
│   └── visual/
│       ├── snapshot.spec.js        ← Visuaalinen regressio (manuaali, isot CSS-muutokset)
│       └── __snapshots__/          ← Baseline-kuvakaappaukset (git-seurannassa)
├── index.html                      ← Vite-entrypoint (juuressa) — EI Firebase-importteja
├── package.json                    ← npm-paketit ja build-skriptit
├── package-lock.json
├── vite.config.js                  ← Vite- ja PWA/Workbox-konfiguraatio
├── playwright.config.js            ← Playwright-konfiguraatio
├── lighthouserc.json               ← Lighthouse CI -budjettikonfiguraatio
├── lychee.toml                     ← Linkkitarkistuksen konfiguraatio
├── .lycheeignore                   ← Linkkitarkistuksen ohitukset
├── live-smoke-test.sh              ← Polling-odotus Pages-deploylle (post-deploy)
└── TECHNICAL_DESIGN.md             ← Tämä dokumentti
```

Tuotantobuild paketoidaan komennolla `npm run build` ja testataan paikallisesti komennolla `npm run dev`.

**Dokumentaatiotiedostot sijaitsevat juuressa** – ei `docs/`-alikansioita. Kaikki `.md`-tiedostot ovat repositorion juuressa.

### `prefs.js` vs. `profile.js` — omistajuusraja

Nämä ovat kaksi erillistä moduulia, jotka molemmat liittyvät käyttäjään, mutta niillä on eri vastuualueet:

| Moduuli | Vastuualue | Ei vastaa |
|---|---|---|
| `prefs.js` | Preferenssidatan hallinta: luku, kirjoitus, synkronointi (localStorage + Firestore), migraatio, muutoskuuntelijat | UI:n piirtoon liittyvistä asioista |
| `profile.js` | Profiilimodaalin UI-elinkaari: avaus, sulkeminen, käyttäjätietojen näyttö DOM:issa | Datan tallennuksesta tai Firestoresta |

`profile.js` kutsuu `prefs.js`:n julkista API:ta (`getPrefs()`, `onPrefsChange()`) UI:n päivittämiseen — mutta se ei kirjoita dataa suoraan. Preferenssien päivittäminen käyttäjän toimesta tapahtuu aina `updatePrefs()`-kutsun kautta (`prefs.js`).

### `patterns.md` — mikä se on?

`patterns.md` on luettelo UI-komponenteista, joita tämä sovellus kuluttaa [`patterns`-reposta](https://github.com/uutisseuranta/patterns). Se dokumentoi minkä komponenttien CSS-luokat ovat käytössä tässä sovelluksessa ja mistä ne ladataan. Se ei ole normatiivinen määrittely — normatiivinen määrittely on `patterns`-repon `TECHNICAL_DESIGN.md`:ssä.

---

## Teknologiavalinnat

### Sallitut teknologiat

| Kerros | Teknologia | Perustelu |
|---|---|---|
| Rakenne | HTML5, semanttiset elementit | Standardi, ei riippuvuuksia |
| Tyyli | CSS (vanilla), CSS-muuttujat, `@layer` Cascade Layerit, Native Nesting | Standardi, ei preprosessoria, laajasti tuettu |
| Logiikka | JavaScript (vanilla ES-moduulit) | Standardi, ei frameworkia |
| Paketointi & PWA | Vite, `vite-plugin-pwa`, Workbox | Tree-shaking, code splitting, offline-caching |
| Autentikointi | Firebase Authentication | Ks. Firebase-rajaus |
| Analytiikka | Firebase Analytics + GA4 | Ks. Firebase-rajaus + Analytics/GDPR-osio |
| Fontit | Järjestelmäfonttipino tai `@font-face` + `local()` | Ei CDN-riippuvuuksia, avoimen standardin ratkaisu |
| Testit (dev) | `@playwright/test`, `@axe-core/playwright`, `@lhci/cli`, Bash+curl | Ks. Testausstrategia. DevDependencyinä — ei tuotantobundleen. |

### Kielletyt teknologiat

- **JavaScript-sovelluskehykset** (React, Vue, Angular, Svelte, tms.) — ei tarvita.
- **Testausframeworkit tuotantoriippuvuuksina** — `@playwright/test`, `@axe-core/playwright` ja `@lhci/cli` ovat hyväksyttyjä **devDependencyinä** (eivät päädy bundleen). Kielto koskee testauskirjastoja `dependencies`-listalla.
- **CSS-preprosessorit** (Sass, Less, PostCSS) — moderni vanilla CSS nestingillä riittää.
- **Vanhan liiton build-työkalut** (Webpack, Rollup, Parcel, tms. suoraan käytettynä) — käytetään vain Viten valmiita konfiguraatioita.
- **Erillinen monitorointipalvelu** (Datadog, Sentry, tms.) — laatu varmistetaan pipelinessa ennen tuotantoa.
- **PR preview -ympäristöt** (Netlify, Cloudflare Pages, tms.) — pipeline testaa ennen mergeä, erillisiä preview-ympäristöjä ei tarvita.
- **Ulkoiset fontti-CDN:t** (Google Fonts, Fontshare, Adobe Fonts, tms.) — fonttilatauksista ei saa syntyä kolmannen osapuolen verkkopyyntöjä.

### Testausstrategia

Testaus on jaettu neljään kerrokseen, jotka ajetaan eri triggerillä:

| Kerros | Työkalu | Triggeröinti | Tarkoitus |
|---|---|---|---|
| Staattinen | Vite build, lychee | Jokainen PR | Build ei hajoa, linkit toimivat |
| Integraatio | Playwright + `page.route` | Jokainen PR | API-mock — ei verkkoverkkorippuvuutta |
| A11y | `@axe-core/playwright` | Jokainen PR | WCAG 2.2 AA automaattisesti |
| E2E smoke | Playwright + live-smoke-test.sh | Post-deploy | Live-sivuston perustoiminta |
| Suorituskyky | Lighthouse CI | Viikoittain | Core Web Vitals -trendit |
| Visuaalinen regressio | Playwright screenshot | Manuaali (isot CSS-muutokset) | Kriittiset teemamuutokset |

**Bash+curl (`live-smoke-test.sh`) säilyy** post-deploy-pollingia varten: se odottaa HTTP 200:aa ennen kuin Playwright-testit käynnistetään live-sivustoa vasten. Playwright ei korvaa tätä — polling-skriptin tehtävä on eri.

Ks. [TESTING.md](TESTING.md) toteutusdetaljit, koodinäytteet ja workflow-konfiguraatiot.

---

## Suunnittelu- ja kehityskäytännöt

### Luonnos-Pull Requestit (Draft PR) ja alkudeploy (Skeletal Deploy)

Monimutkaiset tai uudet ominaisuudet aloitetaan viemällä kevyt runko, tyhjät API-rajapinnat ja koodikommentit (Draft PR tai alkudeploy) arvioitavaksi ennen varsinaisen toiminnallisuuden toteutusta.
- Tämä mahdollistaa arkkitehtuurin, arkkitehtuurirajojen ja koodin kommentoinnin katselmoinnin aikaisessa vaiheessa ennen laajempaa koodaamista.
- Avoimet arkkitehtuurikysymykset jätetään Pull Requestin kommenteiksi koodikontekstiin, jolloin niistä päättäminen tapahtuu luontevasti suoraan GitHubissa.

---

## Firebase-rajaus

Firebase-SDK:ta käytetään **ainoastaan** kolmessa tarkoituksessa:

1. **Authentication** (`firebase/auth`) — Google Sign-In, kirjautumistilan seuranta, uloskirjautuminen.
2. **Analytics** (`firebase/analytics`) — automaattinen käyttödatan keruu, linkitetty GA4-propertyyn.
3. **Database** (`firebase/firestore`) — kirjautuneen käyttäjän asetusten (seuratut tagit, teema) synkronointi laitteiden välillä.

### Firebase SDK:n lataus — npm-pakettina, ei CDN-importtina

Firebase SDK ladataan **npm-pakettina** Viten kautta. CDN-importteja **ei käytetä** Vite-kontekstissa.

**Syy:** Firebase CDN -importti lataa koko moduulin riippumatta siitä mitä funktioita kutsutaan. `firebase-firestore.js` CDN:ltä (~120–150 KB gzip) sisältää mm. `runTransaction`, `writeBatch`, `getAggregateFromServer` ja offline-indeksointilogiikan — vaikka tässä projektissa käytetään vain `getDoc`, `setDoc`, `deleteDoc` ja `onSnapshot`. Vite + npm mahdollistaa tree-shakingin: bundliin päätyy vain käytetyt funktiot (~30–50 KB gzip).

```js
// src/main.js — OIKEIN: npm-import, Vite tree-shakaa käyttämättömät pois
import { initializeApp } from 'firebase/app';
import { getAuth, onAuthStateChanged, signInWithPopup, signOut, deleteUser,
         GoogleAuthProvider } from 'firebase/auth';
import { getAnalytics } from 'firebase/analytics';
import { initializeFirestore, persistentLocalCache, getDoc, setDoc, deleteDoc, onSnapshot, doc } from 'firebase/firestore';

const app = initializeApp(firebaseConfig);

// persistentLocalCache() korvaa @deprecated enableIndexedDbPersistence().
// Kutsutaan initializeApp():n jälkeen, ennen mitään getDoc/setDoc-kutsuja.
const db = initializeFirestore(app, {
  localCache: persistentLocalCache()
});
```

> ⚠️ **Kaksoismalli-vaara:** `index.html` ei saa sisältää Firebase CDN -importteja. Jos `index.html`:ssä on `<script type="module">` joka importtaa `https://www.gstatic.com/firebasejs/...` **ja** `src/main.js` käyttää npm-versiota, Firebase alustetaan kahdesti. `initializeApp()` heittää virheen `"Firebase App named '[DEFAULT]' already exists"`. Kaikki Firebase-alustus tapahtuu **yksinomaan** `src/main.js`:ssä npm-importteina. `index.html` sisältää vain yhden `<script type="module" src="/src/main.js">` -tagin.

### Sallitut npm-riippuvuudet

Teknisen velan rajaamiseksi npm-riippuvuudet on jäädytetty. Uuden paketin lisääminen vaatii eksplisiittisen arkkitehtuuripäätöksen DECISION_LOG:iin ennen toteutusta.

**Tuotantoriippuvuudet (`dependencies`):**

| Paketti | Versio | Tarkoitus |
|---|---|---|
| `vite` | `^8.1.5` | Build-työkalu, tree-shaking, dev-server |
| `vite-plugin-pwa` | `^1.3.0` | Workbox-integraatio, Service Worker -generointi |
| `firebase` | `^12.16.0` | Auth, Firestore, Analytics — tree-shakingia varten |
| `workbox-window` | `^7.4.1` | SW-päivityskehote käyttäjälle (L-011) |

**Testausriippuvuudet (`devDependencies`) — eivät päädy tuotantobundleen:**

| Paketti | Versio | Tarkoitus |
|---|---|---|
| `@playwright/test` | `^1.45.0` | E2E-, integraatio- ja visuaalinen regressiotestaus |
| `@axe-core/playwright` | `^4.9.1` | WCAG 2.2 AA -saavutettavuustestaus PR-vaiheessa |
| `@lhci/cli` | `^0.14.0` | Lighthouse CI Core Web Vitals -auditointi |

> [!NOTE]
> Versiot `vite ^8.1.5` ja `firebase ^12.16.0` on lukittu vastaamaan uutisseurannan paikallisen/offline-kehitysympäristön erikoispaketteja laadunvarmistuksen ja testauksen vuoksi, vaikka viralliset julkiset pääversiot (Vite 6.x ja Firebase 11.x) poikkeavat tästä.

### CI/CD-vaikutus

`npm ci && npm run build` ajetaan pipelinessa ennen deployta. `npm ci` (ei `npm install`) on deterministinen — se ei päivitä `package-lock.json`:ia ja epäonnistuu jos lock-tiedosto ei täsmää. Tämä estää "works on my machine" -tilanteen.

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

> **ℹ️ Offline-persistointi (L-008 & L-012):** `initializeFirestore(app, { localCache: persistentLocalCache() })`
> mahdollistaa Firestore-kirjoitusten jonottamisen IndexedDB:hen offline-tilassa.
> Kirjoitukset synkronoidaan automaattisesti kun verkkoyhteys palautuu.
> `enableIndexedDbPersistence()` (vanha API) on poistettu — sitä ei käytetä.

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

---

## Vite-build ja Workbox (päätös L-009, L-011)

### Miksi Vite?

Vite toimii tässä projektissa kahdessa roolissa:

1. **Build-työkalu** — kääntää `src/`-kansion `dist/`-kansioon. Tree-shaking poistaa bundlista käyttämättömän koodin. Firebase SDK hyötyy tästä eniten: npm-versiolla bundliin päätyy vain kutsutut funktiot, CDN-importilla koko moduuli.
2. **Dev-server** — `npm run dev` käynnistää paikallisen palvelimen HMR-tuella (Hot Module Replacement). Muutokset näkyvät selaimessa ilman sivun uudelleenlatausta.

Tuotantobuild: `npm run build` → `dist/`. GitHub Pages julkaisee `dist/`-kansion suoraan (deploy.yml).

### Miksi Workbox?

Workbox on Googlen kirjasto Service Worker -koodin kirjoittamiseen. Service Worker on selaimen taustaprosessi, joka sieppaa HTTP-pyynnöt ja toteuttaa caching-strategian ennen kuin pyyntö lähtee verkkoon. Se on PWA:n ydin.

`vite-plugin-pwa` generoi Service Worker -tiedoston automaattisesti buildin yhteydessä `vite.config.js`-konfiguraation perusteella:

```js
// vite.config.js
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    VitePWA({
      registerType: 'prompt',          // L-011: käyttäjä hyväksyy SW-päivitykset
      workbox: {
        // L-011: Network First uutisdatalle — yritä verkosta, fallback cacheen
        runtimeCaching: [
          {
            urlPattern: /\/ap\/outbox/,
            handler: 'NetworkFirst',
            options: { cacheName: 'news-data' }
          },
          // L-011: Stale-While-Revalidate kuville — näytä cachesta heti,
          // päivitä taustalla
          {
            urlPattern: /\.(png|jpg|jpeg|svg|webp)$/,
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'images' }
          }
        ]
      }
    })
  ]
});
```

Ilman Workboxia nämä strategiat olisivat ~200 riviä manuaalista Service Worker -koodia — jokainen cache eviction, version conflict ja partial update käsin. Workbox tekee sen deklaratiivisesti.

### L-011-päätöksen ja Viten yhteys

Päätös L-011 ("Network First uutisdatalle, Stale-While-Revalidate kuville, SW-päivitykset käyttäjävahvistuksella") **edellyttää** Workboxia käytännössä. `registerType: 'prompt'` estää automaattisen `skipWaiting()`:n — selain ei ota uutta Service Workeria käyttöön ilman käyttäjän hyväksyntää. Tämä estää vanhan version jumiutumisen. `workbox-window`-paketti kuuntelee `waiting`-tapahtumaa ja näyttää käyttäjälle päivityskehotteen:

```js
// src/main.js
import { Workbox } from 'workbox-window';

if ('serviceWorker' in navigator) {
  const wb = new Workbox('/sw.js');

  // L-011: näytä päivityskehote käyttäjälle (Toast banner DOM:issa, ei confirm())
  wb.addEventListener('waiting', () => {
    const toast = document.createElement('div');
    toast.className = 'pwa-toast';
    toast.innerHTML = `
      <span>Uusi versio saatavilla.</span>
      <button class="pwa-toast__btn" id="pwa-update-btn">Päivitä</button>
    `;
    document.body.appendChild(toast);

    document.getElementById('pwa-update-btn').addEventListener('click', () => {
      wb.addEventListener('controlling', () => {
        window.location.reload();
      });
      wb.messageSkipWaiting();
    });
  });

  wb.register();
}
```

---

## Koodin kommentointi

Kommentoinnin tehtävä on selittää **miksi** — ei **mitä**. Koodi kertoo itse mitä se tekee; kommentti kertoo miksi se tehdään juuri niin. Jos kommentti toistaa koodin sanasta sanaan eri sanoilla, se on turha.

> **Nyrkkisääntö:** Kommentoi päätökset, reunaehdot ja arkkitehtuurirajat — ei mekanismeja.

### Yleinen periaate (kaikki kielet)

Kommentteja kirjoitetaan kolmeen tilanteeseen:

1. **Arkkitehtuuripäätös** — miksi tämä lähestymistapa valittiin, mitä vaihtoehtoja hylättiin ja miksi.
2. **Reunaehto tai tunnettu rajoite** — jokin asia jota koodi ei tee tai ei voi tehdä, ja syy siihen.
3. **Ei-ilmeinen sivuvaikutus** — kutsu tai operaatio jolla on kauaskantoinen tai epäintuitiivinen vaikutus.

Koodia **ei kommentoida** silloin kun nimi tai rakenne jo selittää asian riittävästi.

---

### JavaScript (`app.js`, `prefs.js`, `profile.js`)

Käytetään `//`-rivikommentteja. JSDoc-lohkokommentit (`/** ... */`) ovat tarpeettomia, koska projektissa ei generoida API-dokumentaatiota automaattisesti.

**Tiedoston yläosa** — lyhyt kuvaus moduulin vastuusta ja tärkeimmistä ulkoisista riippuvuuksista:

```js
// prefs.js — Käyttäjäpreferenssien hallinta
// Vastuu: luku, kirjoitus, synkronointi (localStorage + Firestore), migraatio
// Ei vastaa: UI:n piirtämisestä (ks. profile.js)
// Ulkoiset riippuvuudet: firebase/firestore (kirjautunut käyttäjä)
```

**Funktioiden kommentointi** — vain jos funktion nimi ja parametrit eivät kerro tarkoitusta:

```js
// Debounce: kirjoitetaan Firestoreen viimeistään 500 ms toiminnon jälkeen.
// Estää liiallisen kirjoitusmäärän nopeissa peräkkäisissä muutoksissa.
function _scheduleFirestoreWrite(uid, prefs) { ... }
```

**Arkkitehtuurirajat** — kommentoi kohtaa jossa vastuu siirtyy moduulilta toiselle:

```js
// Tästä eteenpäin vastuu siirtyy profile.js:lle.
// prefs.js:n tehtävä päättyy tähän — se palauttaa arvot, ei renderoi.
export function getPrefs() { ... }
```

**Ei-ilmeiset sivuvaikutukset** — erityisesti asynkroniset operaatiot ja Firebase-kutsut:

```js
// HUOM: tämä kutsu käynnistää Firestore-kuuntelijan joka pysyy aktiivisena
// koko sivun elinkaaren ajan. Kutsu vain kerran per käyttäjäistunto.
onSnapshot(docRef, callback);
```

**Tunnetut rajoitteet ja tietoinen valinta:**

```js
// persistentLocalCache korvaa deprecated enableIndexedDbPersistence:n.
// Tehty PR #65 yhteydessä race conditionien ja offline-ongelmien estämiseksi.
const db = initializeFirestore(app, {
  localCache: persistentLocalCache()
});
```

---

### CSS (`style.css` + patterns)

Käytetään `/* ... */`-lohkokommentteja. CSS:ssä kommentointi palvelee erityisesti **osiorakennetta** ja **ei-ilmeisiä arvovalintoja**.

**Osiokommentit** (pakollinen rakenne `style.css`:ssä, ks. [patterns#56](https://github.com/uutisseuranta/patterns/issues/56)):

```css
/* =============================================================================
   RESET
   Normalisoi selainkohtaiset oletukset. Pohjana: box-sizing border-box kaikille.
   ============================================================================= */

/* =============================================================================
   TYPOGRAPHY
   Järjestelmäfonttipino — ei ulkoisia CDN-latauksia.
   ============================================================================= */

/* =============================================================================
   LAYOUT
   Sivun päärakenne: grid, flex-kontainerit, responsiivisuus.
   ============================================================================= */

/* =============================================================================
   COMPONENTS
   Yksittäiset UI-komponentit. Jokainen komponentti omana aliosionaan:
   --- ArticleCard ---
   --- VoteBar ---
   ============================================================================= */

/* =============================================================================
   UTILITIES
   Apuluokat: piilotus, värit, etäisyydet.
   ============================================================================= */
```

**Arvojen perustelut** — kommentoi kun arvo ei ole itsestäänselvä:

```css
/* clamp(1rem, 2.5vw, 1.5rem): ei layoutin rikkoutumista pienillä tai
   suurilla näytöillä ilman media queryä — askel kohti fluid typography. */
font-size: clamp(1rem, 2.5vw, 1.5rem);

/* z-index: 100 — modaalit: 200, header: 50, sisältö: auto.
   Katso z-index-kerrosjärjestys TECHNICAL_DESIGN.md § Koodin kommentointi. */
.dropdown { z-index: 100; }
```

---

### HTML (`index.html`)

Käytetään `<!-- ... -->`-kommentteja. HTML:ssä kommentointi on **rakenteellista**: osioiden rajat ja ei-ilmeiset data-attribuutit.

**Osiorajat** — selkeyttävät pitkiä HTML-tiedostoja:

```html
<!-- ==================== HEADER ==================== -->
<header role="banner"> ... </header>

<!-- ==================== MAIN CONTENT ==================== -->
<main id="news-feed"> ... </main>

<!-- ==================== FOOTER ==================== -->
<footer> ... </footer>
```

**AS2 data-attribuutit** — selitetään mitä kuluttaa:

```html
<!-- AS2: data-as2-* -attribuutit luetaan app.js:ssä käyttäjäinteraktioihin.
     data-as2-id lähetetään write-API:lle object.id-kenttänä Like/Dislike-aktiviteeteissa. -->
<article
  data-as2-context="https://www.w3.org/ns/activitystreams"
  data-as2-id="https://uutisseuranta.fi/articles/123"
  data-as2-type="Article"
>
```

**Ei toisteta nimeä** — älä kirjoita `<!-- ArticleCard component -->` jos `<article class="article-card">` on jo selvä.

---

### Python (`bq-activitystreams`: write-api, query-api, og-scraper)

Käytetään `#`-rivikommentteja. Docstringit (`""" ... """`) kirjoitetaan **julkisiin funktioihin ja moduuleihin** — ei yksityisiin apufunktioihin.

**Moduulin yläosa** — vastuut ja ulkoiset riippuvuudet:

```python
# write_api.py — Activity Streams 2.0 -aktiviteettien vastaanotto
# Vastuu: vastaanottaa POST-pyyntö, validoi AS2-rakenne, kirjoittaa BigQueryyn
# Ei vastaa: aktiviteettien lukemisesta tai aggregoinnista (ks. query_api.py)
# Ulkoiset riippuvuudet: google-cloud-bigquery, Flask
```

**Julkisten funktioiden docstring** — lyhyt, ei toistu nimen kanssa:

```python
def receive_activity(payload: dict) -> dict:
    """
    Vastaanottaa AS2-aktiviteetin ja kirjoittaa sen BigQueryyn.

    Palauttaa: {'status': 'ok', 'id': str} tai nostaa ValueError
    jos payload ei ole validi AS2-objekti.
    """
```

**Arkkitehtuurirajat ja tietoiset päätökset:**

```python
# Idempotenssi: duplikaatti-Like samalla (actor, object) -parilla
# palautetaan 409 eikä kirjoiteta toista riviä BigQueryyn.
# Syy: BigQuery ei tue UNIQUE-rajoitteita — esto tehtävä sovelluskerroksessa.
if _like_exists(actor_id, object_id):
    return error_response(409, "Duplicate Like")
```

**BigQuery-kustannusriskin kommentointi** — pakollinen kaikissa query-funktioissa joissa on full-scan-riski:

```python
# KUSTANNUSVAROITUS: Ilman WHERE-ehtoa tämä lukee koko taulun.
# Funktiota ei saa kutsua ilman vähintään yhtä suodatinta (actor TAI object_id).
# Ks. test_query_without_filter_raises_error() — testaa tämän esteen.
def query_activities(actor: str = None, object_id: str = None) -> list:
    if not actor and not object_id:
        raise ValueError("Vähintään yksi suodatin vaaditaan")
```

---

### Bash (`live-smoke-test.sh`, `rss_fetch_job.sh`, `unit-test.sh`, `fetch_helpers.sh`)

Käytetään `#`-rivikommentteja.

**Tiedoston yläosa** — skriptin tarkoitus, ajotapa ja riippuvuudet:

```bash
#!/usr/bin/env bash
# live-smoke-test.sh — Tuotannon savutesti
# Ajetaan: GitHub Actions post-deploy-test.yml (jokaisen mergen jälkeen)
# Ympäristö: CI (ubuntu-latest) tai paikallinen bash
# Riippuvuudet: curl, grep (GNU)
# Palauttaa: exit 0 = kaikki ok, exit 1 = jokin testi epäonnistui
```

**Testiryhmien otsikointi** — selkeyttää pitkiä testiskriptejä:

```bash
# --- HTTP-statuskoodit ---
```
