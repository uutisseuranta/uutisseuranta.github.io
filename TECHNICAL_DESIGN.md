# Uutisseuranta – Tekniset linjaukset

Tämä dokumentti määrittää projektin tekniset linjaukset ja arkkitehtuuripäätökset. Kaikki uudet ominaisuudet ja muutokset noudattavat näitä periaatteita, ellei yksittäisestä poikkeuksesta erikseen päätetä.

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

## Design Guidelines

Nämä linjaukset ohjaavat kaikkia visuaalisia ja rakenteellisia päätöksiä. Yksityiskohtainen komponenttikirjasto on dokumentoitu `patterns.md`:ssä.

### Atomic Design -rakenne

UI-komponentit noudattavat Atomic Design -hierarkiaa:

- **Atomit** — CSS-muuttujat, typografia, värit, napit, tagit (`style.css`)
- **Molekyylit** — notifikaatiopalkki, hakukenttä, tagipari (`style.css` + `index.html`)
- **Organismit** — navigaatio, uutiskortti, kirjautumismodaali (`index.html` + `app.js`)
- **Templatet** — sivu-layoutit, grid-rakenteet (`index.html`)

Kaikki komponentit elävät juuritason tiedostoissa – ei alikansioita, ei komponenttihakemistoa.

### Värinkäyttö

- **D-CENT-väri on aina hallitseva.** Primääriaksentti (`--color-primary`) esiintyy CTA-elementeissä, aktiivilinkissä ja semanttisissa tiloissa.
- Enintään kaksi ei-neutraalia sävyä yhdessä näkymässä samanaikaisesti.
- Väriä käytetään merkitykseen, ei koristeluun. Poikkeus: notifikaatiopalkin `border-left` on sallittu semanttisena tilaindikaattorina.
- **Kielletty:** korttien `border-left` väripalkki, ikonit värillisissä ympyröissä, gradient-napit.

### Typografia

- **Ei ulkoisia fontti-CDN-riippuvuuksia** (ei Fontshare, ei Google Fonts). Fonttilatauksista ei saa syntyä kolmannen osapuolen verkkopyyntöjä.
- Ensisijainen ratkaisu: **järjestelmäfonttipino** (`system-ui`, `-apple-system`, `Segoe UI`, `sans-serif`). Toimii ilman latauksia, nolla CDN-riippuvuuksia.
- Tarvittaessa omien fonttitiedostojen lataus `@font-face` + `local()`-menetelmällä – fontit voivat sijaita repositorion juuressa tai käyttäjän laitteella jo valmiina. Ei ulkoisia URL-osoitteita `src:`-arvossa.
- Nestemäinen kirjasinkoko `clamp()`-funktiolla kaikissa tekstielementeissä.
- Kehon teksti: `--text-base` (16 px). Napit: `--text-sm` (14 px). Minimialaraja: 12 px.
- Otsikkofontit (`--font-display`) vain koossa `--text-xl` (24 px) tai suuremmissa.

```css
/* style.css – hyväksytty typografiaratkaisu */
:root {
  --font-body:    system-ui, -apple-system, 'Segoe UI', sans-serif;
  --font-display: system-ui, -apple-system, 'Segoe UI', sans-serif;
}

/* Vaihtoehto: oma fonttitiedosto repositoriossa */
@font-face {
  font-family: 'OmaFontti';
  src: local('OmaFontti'), url('./omafontit/OmaFontti.woff2') format('woff2');
  font-display: swap;
}
```

### Layoutperiaatteet

- **Mobiili ensin (375 px).** Responsiivisuus `clamp()`- ja `@media`-pohjaisesti, ei JS:llä.
- Prosateksti: `max-width: 72ch`. Datatiheä layout (stream, taulukot): koko leveys.
- Sisäkkäinen `border-radius`: sisäelementti = ulompi säde − padding. Ei tasaista isokulmaista pyöristystä kaikkialla.
- Varjot (`--shadow-sm/md/lg`) sävytetty pinnan lämpötilaan. Puhtaan mustan varjo on kielletty.
- Siirtymäanimaatiot: `180ms cubic-bezier(0.16, 1, 0.3, 1)`. Ei välitöntä show/hide:ta.

### Saavutettavuus

- Semanttinen HTML pakollinen: `<header>`, `<nav>`, `<main>`, `<article>`, `<dialog>` jne.
- Jokainen interaktiivinen elementti saavutettavissa näppäimistöllä. Fokus-indikaattori aina näkyvissä.
- Kosketuskohteet vähintään 44 × 44 px.
- Kontrastivaatimus WCAG AA: 4,5:1 kehon teksti, 3:1 suuri teksti.
- `prefers-reduced-motion` kunnioitetaan – animaatiot poistetaan pyynnöstä.
- Natiivi `<dialog>`-elementti kirjautumismodaalissa: hoitaa focus-loukon ja Escape-näppäimen ilman JS-kirjastoa.

### Defensive UI

- Jokainen latausvaiheen näkymä näyttää skeleton-lataajan, joka vastaa oikean sisällön rakennetta.
- Tyhjä virta ei näytä tyhjää – näyttää ohjatun toimintakehotteen ("Lisää aiheita seurantaan").
- Virhetilat inline-palautteena virheen vieressä, ei toast-ilmoituksina kriittisissä tapauksissa.

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
3. **Database** (`firebase-firestore`) — käyttäjäpreferenssien (seuratut tagit) synkronointi laitteiden välillä offline-tuella.

Kaikki muu toiminnallisuus (uutisten haku, tallennus, hosting, funktiot jne.) toteutetaan muilla teknologioilla. Firebase-SDK:n laajentaminen uusiin palveluihin vaatii eksplisiittisen arkkitehtuuripäätöksen ennen toteutusta.

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

### Periaatteet

- **Kaikki testaus tapahtuu CI/CD-pipelinessa.** Ei erillistä monitorointia tuotannossa, ei erillisiä testiympäristöjä.
- **Testit kirjoitetaan vanilla Bash + `curl` + standardit Unix-työkalut.** Ei testausframeworkeja (Playwright, Jest, Cypress tms.) koskaan.
- **Pipeline on portti tuotantoon.** Kaikki testit ajetaan ennen tai välittömästi deployn jälkeen. Epäonnistunut testi estää tai ilmoittaa ongelmasta.
- **Yksinkertaisuus ennen kattavuutta.** Yksi luotettava smoke-testi on parempi kuin kymmenen haurasta yksikkötestiä.

### Testit käytännössä

Testit sijaitsevat juurikansiossa `.sh`-tiedostoina. Jokainen testi on ajettavissa myös manuaalisesti:

```bash
bash live-smoke-test.sh
```

Testi tarkistaa vain sivuston toiminnan kannalta kriittiset asiat `curl`-pyynnöllä:
- HTTP 200 vastaus
- Kriittisten HTML-elementtien läsnäolo
- Firebase Auth -konfiguraation toimivuus

Testit eivät simuloi käyttäjän toimintaa, eivätkä vaadi selainta. Jos jokin toiminnallisuus vaatii selainta testaakseen, se kuuluu manuaalisen tarkistuksen piiriin ennen PR:n mergeä.

### Pipeline-rakenne

```
push → main
  └─ GitHub Pages deploy (automaattinen)
       └─ Odota deployn valmistuminen (Pages API -pollaus)
            └─ Aja live-smoke-test.sh
                 ├─ OK  → sivu on tuotannossa
                 └─ ERR → GitHub Actions -ilmoitus, korjaa ja pushaa uudelleen
```

Pipelinessa ei ole erillisiä staging- tai preview-ympäristöjä. `main`-haara on aina tuotanto.

---

## Deployment

Sivusto deployataan **GitHub Pagesille** suoraan `main`-haarasta. Deploy tapahtuu automaattisesti jokaisen `main`-pushin jälkeen.

- Tuotanto-URL: `https://uutisseuranta.net`
- GitHub Pages -URL: `https://jaakkokorhonen.github.io/uutisseuranta`
- Molemmat URLit ovat voimassa ja testataan pipelinessa

Ei Netlifyä, ei Cloudflare Pagesia, ei muita hostingpalveluja. GitHub Pages riittää staattiselle sivulle.

---

## Turvallisuus

### Firebase Web API -avain on tarkoituksellisesti julkinen

Firebase Web API -avain näkyy `index.html`:ssä selkotekstinä sekä GitHub-repositoriossa että sivuston tuotanto-HTML:ssä (`Ctrl+U`). Tämä on **tietoinen ja oikea päätös**, ei tietoturvaongelma.

Google dokumentoi eksplisiittisesti, että Firebase Web API -avain on tarkoitettu julkiseksi:

> *"The API key for a Firebase Web App is actually included in the HTML of the web page. It's not considered sensitive."*
> — [Firebase documentation](https://firebase.google.com/docs/projects/api-keys)

Avain identifioi Firebase-projektin, mutta ei anna pääsyä dataan. Se vastaa toiminnaltaan Google Analytics Measurement ID:ä — näkyy kaikille, mutta yksinään hyödytön ilman oikeuksia.

**Secrets-injektiota ei tehdä**, koska:
1. Se tuo merkittävää kompleksisuutta (erillinen deploy-workflow, Pages Source -vaihto manuaalisesti, sed-korvauslogiikka)
2. Se ei poista avainta tuotanto-HTML:stä — selain näkee sen joka tapauksessa
3. Hyöty on nolla: avain on julkinen by design

### Missä oikea turvallisuus on

Turvallisuus varmistetaan Firebase-projektin puolella, ei avainten piilottamisella:

- **Authorized Domains** — vain `uutisseuranta.net` ja `jaakkokorhonen.github.io` voivat käynnistää Auth-flown. Mikään muu domain ei voi käyttää avainta kirjautumiseen, vaikka se olisi näkyvissä.
- **Firebase Security Rules** — määritellään erikseen, kun tietokanta tai tallennus otetaan käyttöön. Säännöt määrittävät kuka pääsee dataan — ei avain.
- **API Key HTTP referrer -rajoitus** — Google Cloud Consolessa avain voidaan rajata hyväksymään pyynnöt vain tuotantodomain-URLista. Suositellaan lisättäväksi, kun projekti kasvaa.

### Palvelinpuolen avaimet

Palvelinpuolen avaimet (Firebase Admin SDK service account, kolmansien osapuolten API-avaimet) **ei koskaan `index.html`:ssä**. Ne tallennetaan GitHub Secretseihin ja injektoidaan pipelinessa. Tällä hetkellä projektissa ei ole palvelinpuolen avaimia.

### Content Security Policy

CSP määritellään `<meta http-equiv="Content-Security-Policy">`-tagilla `index.html`:ssä rajoittamaan sallitut skriptilähteet.

---

## Release-prosessi ja automaatio

Kaikki käyttöliittymän muutokset ja julkaisut viedään läpi täysin automatisoidun julkaisuprosessin (release-prosessi) kautta. Ylläpito (ops) ei tee manuaalisia muutoksia palvelinympäristöön tai GitHub Pages -asetuksiin.

### CI/CD-työnkulku (GitHub Actions)

1. **Kehitys ja testaus:** 
   - Muutokset kehitetään omassa haarassa ja integroidaan `main`-haaraan Pull Requestin kautta.
2. **Automaattinen julkaisu (Deploy):**
   - Push `main`-haaraan käynnistää automaattisen julkaisun GitHub Pagesiin (`pages build and deployment` workflow).
   - Työnkulku tarkistaa koodin oikeellisuuden ja siirtää staattiset tiedostot (`index.html`, `style.css`, `app.js`, `prefs.js`, `profile.js`) tuotantoympäristöön `https://uutisseuranta.github.io/`.
3. **Julkaisun jälkeinen laadunvarmistus (Post-deploy smoke tests):**
   - Heti onnistuneen deployn jälkeen käynnistyy `post-deploy-test.yml`-työnkulku, joka ajaa `/live-smoke-test.sh`-savutestin tuotanto-URL-osoitetta vasten. Testi varmistaa sivuston latautuvan oikein ja vastaavan HTTP 200 OK -tilakoodilla.

---

## Muutosten tekeminen

Kaikki muutokset tehdään **pull requestina**. Suora push `main`-haaraan on sallittu vain dokumentaatiomuutoksille.

PR:n otsikko noudattaa [Conventional Commits](https://www.conventionalcommits.org/) -käytäntöä:
- `feat:` — uusi ominaisuus
- `fix:` — bugikorjaus
- `docs:` — dokumentaatiomuutos
- `refactor:` — koodin rakennemuutos ilman toiminnallisuusmuutosta
- `chore:` — ylläpito (riippuvuudet, konfiguraatio)

Arkkitehtuurilinjausten muuttaminen (tämä dokumentti) vaatii eksplisiittisen päätöksen PR:n kuvauksessa.
