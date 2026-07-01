# Uutisseuranta – Tekniset linjaukset

Tämä dokumentti määrittää projektin tekniset linjaukset ja arkkitehtuuripäätökset. Kaikki uudet ominaisuudet ja muutokset noudattavat näitä periaatteita, ellei yksittäisestä poikkeuksesta erikseen päätetä.

---

## Tiedostorakenne

Kaikki staattiset tiedostot sijaitsevat repositorion **juurihakemistossa**. Alikansioita ei käytetä. GitHub Pages deployaa suoraan rootista.

```
uutisseuranta/
├── index.html       ← pääsivu
├── style.css        ← kaikki tyylimäärittelyt
├── app.js           ← sovelluksen logiikka (ei-Firebase)
├── firebase.json    ← Firebase-projektin konfiguraatio
├── ARCHITECTURE.md  ← tämä dokumentti
├── tests/           ← pipeline-testit (ks. Testausstrategia)
└── .github/
    └── workflows/
        └── post-deploy-test.yml
```

Ei build-tooleja, ei paketinhallintaa (`package.json`), ei `node_modules`-hakemistoa. Sivusto on suoraan selaimessa ajettavaa HTML/CSS/JS:ää.

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
| Fontit | Fontshare CDN | Laadukkaat, ei Google Fonts -ylitarjontaa |
| Testit | Bash + `curl` + standardit Unix-työkalut | Ks. Testausstrategia |

### Kielletyt teknologiat

- **Testausframeworkit** (Playwright, Puppeteer, Jest, Vitest, Cypress, tms.) — ei käytetä koskaan. Testit kirjoitetaan vanilla Bash/curl-pohjaisesti avoimen standardin työkaluilla.
- **JavaScript-frameworkit** (React, Vue, Angular, Svelte, tms.) — ei tarvita staattiselle sivulle.
- **CSS-preprosessorit** (Sass, Less, PostCSS) — moderni vanilla CSS riittää.
- **Build-työkalut** (Webpack, Vite, Rollup, Parcel, tms.) — ei build-steppiä.
- **Erillinen monitorointipalvelu** (Datadog, Sentry, tms.) — laatu varmistetaan pipelinessa ennen tuotantoa.
- **PR preview -ympäristöt** (Netlify, Cloudflare Pages, tms.) — pipeline testaa ennen mergeä, erillisiä preview-ympäristöjä ei tarvita.

---

## Firebase-rajaus

Firebase-SDK:ta käytetään **ainoastaan** kahdessa tarkoituksessa:

1. **Authentication** (`firebase-auth`) — Google Sign-In, kirjautumistilan seuranta, uloskirjautuminen
2. **Analytics** (`firebase-analytics`) — automaattinen käyttödatan keruu, linkitetty GA4-propertyyn

Kaikki muu toiminnallisuus (tietokanta, tallennus, hosting, funktiot jne.) toteutetaan muilla teknologioilla. Firebase-SDK:n laajentaminen uusiin palveluihin vaatii eksplisiittisen arkkitehtuuripäätöksen ennen toteutusta.

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

- **Kaikki testaus tapahtuu CI/CD-pipelinessa.** Ei erillistä monitorointia tuotannossa, ei erillisiä testiymppäristöjä.
- **Testit kirjoitetaan vanilla Bash + `curl` + standardit Unix-työkalut.** Ei testausframeworkeja (Playwright, Jest, Cypress tms.) koskaan.
- **Pipeline on portti tuotantoon.** Kaikki testit ajetaan ennen tai välittömästi deployn jälkeen. Eppäonnistunut testi estää tai ilmoittaa ongelmasta.
- **Yksinkertaisuus ennen kattavuutta.** Yksi luotettava smoke-testi on parempi kuin kymmenen haurasta yksikkötestiä.

### Testit käytännössä

Testit sijaitsevat `tests/`-kansiossa `.sh`-tiedostoina. Jokainen testi on ajettavissa myös manuaalisesti:

```bash
bash tests/live-smoke-test.sh
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
            └─ Aja tests/live-smoke-test.sh
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
- **API Key HTTP referrer -rajoitus** — Google Cloud Consolessa avain voidaan rajata hyväksymään pyynnöt vain tuotantodomain-URLista. Suositellaan lisätäväksi, kun projekti kasvaa.

### Palvelinpuolen avaimet

Palvelinpuolen avaimet (Firebase Admin SDK service account, kolmansien osapuolten API-avaimet) **ei koskaan `index.html`:ssä**. Ne tallennetaan GitHub Secretseihin ja injektoidaan pipelinessa. Tällä hetkellä projektissa ei ole palvelinpuolen avaimia.

### Content Security Policy

CSP määritellään `<meta http-equiv="Content-Security-Policy">`-tagilla `index.html`:ssä rajoittamaan sallitut skriptilähteet.

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
