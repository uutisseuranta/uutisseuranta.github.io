# TECHNICAL_DESIGN.md — Uutisseuranta tekniset linjaukset

> **TECHNICAL_DESIGN.md** sisältää miten normatiiviset vaatimukset toteutetaan
> tässä projektissa. Ulkoiset normatiiviset vaatimukset ovat STANDARDS.md:ssä.

Tämä dokumentti määrittää projektin tekniset linjaukset ja arkkitehtuuripäätökset. Kaikki uudet ominaisuudet ja muutokset noudattavat näitä periaatteita, ellei yksittäisestä poikkeuksesta erikseen päätetä.

---

## Muutoshistoria

| Päivämäärä | Päätös | Perustelu | Vaihtoehto jota harkittiin | Revisit-kriteeri | Issue |
|---|---|---|---|---|---|
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
├── app.js              ← sovelluksen päälogiikka (ei-Firebase)
├── prefs.js            ← preferenssien hallintamoduuli
├── profile.js          ← profiilimodaalimoduuli
├── live-smoke-test.sh  ← pipeline-testiskripti
├── firebase.json       ← Firebase-projektin konfiguraatio
├── TECHNICAL_DESIGN.md ← tämä dokumentti
└── patterns.md         ← D-CENT-komponentit
```

Ei build-tooleja, ei paketinhallintaa (`package.json`), ei `node_modules`-hakemistoa. Sivusto on suoraan selaimessa ajettavaa HTML/CSS/JS:ää.

**Dokumentaatiotiedostot sijaitsevat juuressa** – ei `docs/`-alikansioita. Kaikki `.md`-tiedostot ovat repositorion juuressa.

---

## Teknologiavalinnat

### Sallitut teknologiat

| Kerros | Teknologia | Perustelu |
|---|---|---|
| Rakenne | HTML5, semanttiset elementit | Standardi, ei riippuvuuksia |
| Tyyli | CSS (vanilla), CSS-muuttujat, `clamp()` | Standardi, ei preprosessoria |
| Logiikka | JavaScript (vanilla ES-moduulit) | Standardi, ei frameworkia |
| Autentikointi | Firebase Authentication | Ks. Firebase-rajaus |
| Analytiikka | Firebase Analytics + GA4 | Ks. Firebase-rajaus |
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
| 1. (nopea) | `localStorage` | Paikallinen välimuisti — UI piirtyy ilman verkkoviivettä, toimii offline |
| 2. (kanoninen) | Firestore | Laitteiden välinen synkronointi kirjautuneille käyttäjille |

- **Kirjautumaton käyttäjä:** vain `localStorage` (avain `prefs_anonymous`)
- **Kirjautunut käyttäjä:** localStorage + Firestore molemmat
- **Kirjoitusjärjestys:** ensin `localStorage` välittömästi → sitten Firestore 500 ms debounce-viiveellä
- **Lukujärjestys käynnistyksessä:** ensin `localStorage` (synkroninen) → sitten Firestore (asynkroninen, korvaa jos uudempi)

Kaikki muu toiminnallisuus (uutisten haku, tallennus, hosting jne.) toteutetaan muilla teknologioilla. Firebase-SDK:n laajentaminen uusiin palveluihin vaatii eksplisiittisen arkkitehtuuripäätöksen ennen toteutusta.

Firebase SDK ladataan ES-moduuleina suoraan Googlen CDN:ltä ilman build-steppiä:
```html
<script type="module">
  import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
  import { getAuth, ... } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
  import { getAnalytics } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-analytics.js';
</script>
```

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

---

## Deployment

Sivusto deployataan **GitHub Pagesille** suoraan `main`-haarasta. Deploy tapahtuu automaattisesti jokaisen `main`-pushin jälkeen.

- Tuotanto-URL: `https://uutisseuranta.net`
- GitHub Pages -URL: `https://jaakkokorhonen.github.io/uutisseuranta`

Ei Netlifyä, ei Cloudflare Pagesia, ei muita hostingpalveluja.

---

## Turvallisuus

### Firebase Web API -avain on tarkoituksellisesti julkinen

Firebase Web API -avain näkyy `index.html`:ssä selkotekstinä. Tämä on tietoinen päätös — Google dokumentoi eksplisiittisesti, että avain on tarkoitettu julkiseksi. Turvallisuus varmistetaan Firebase-projektin puolella (Authorized Domains, Security Rules).

### Content Security Policy

CSP määritellään `<meta http-equiv="Content-Security-Policy">`-tagilla `index.html`:ssä rajoittamaan sallitut skriptilähteet.

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

Kaikki muutokset tehdään **pull requestina**. Suora push `main`-haaraa on sallittu vain dokumentaatiomuutoksille.

PR:n otsikko noudattaa [Conventional Commits](https://www.conventionalcommits.org/) -käytäntöä:
- `feat:` — uusi ominaisuus
- `fix:` — bugikorjaus
- `docs:` — dokumentaatiomuutos
- `refactor:` — koodin rakennemuutos ilman toiminnallisuusmuutosta
- `chore:` — ylläpito (riippuvuudet, konfiguraatio)
