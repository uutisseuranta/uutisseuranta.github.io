# Uutisseuranta design guideline

Tämä dokumentti määrittää **Uutisseuranta**-käyttöliittymän visuaalisen suunnan ja tiedostorakenteen. Toteutus perustuu Uutisseuranta Pattern Labin periaatteisiin vanilla HTML + CSS + JS -ratkaisuna — Vite-pakkaajan ja npm-paketinhallinnan kautta käännetyille lähdetiedostoille.

## Tavoite

Uutisseurannan ulkoasun tulee muistuttaa enemmän civic-tech- ja keskusteluvirta-tuotetta kuin geneeristä startup-landing pagea. Sivun tulee näyttää siltä, että se perustuu johdonmukaiseen design systemiin: selkeä värihierarkia, yksinkertainen typografia, modulaariset stream-komponentit, tabit, tagit ja hillitty mutta tunnistettava visuaalinen identiteetti.

## Lähde-inspiraatio

Ulkoasu perustuu soveltuvilta osin Uutisseuranta Pattern Labiin:
- pääväri teal: `#007E84`
- korostusväri magenta/purple: `#9E2E8D`
- pääteksti tumma: `#222222`
- vaaleat taustat: `#EEE`, `#D3FFFD`, `#FFEAFC`
- patternit: `tabs`, `tags`, `stream-item`, `notification`, `stream`

Näitä ei kopioida mekaanisesti pikselilleen, vaan niistä rakennetaan Uutisseurannalle yhtenäinen HTML/CSS-toteutus.

## Mitä poistetaan

Seuraavat nykyisen etusivun piirteet poistetaan tai korvataan:
- editorial-hero suurella markkinointitekstillä
- nykyinen punainen väripaletti
- Cabinet Grotesk + Satoshi -typografia
- feature-card-painotteinen landing-page-rakenne
- geneerinen SaaS-tyylinen CTA-ajattelu
- käyttöliittymässä kaikki Firebaseen viittaava visuaalinen rakenne

## Mitä rakennetaan tilalle

Uusi etusivu rakentuu viidestä perusosasta:

### 1. Header
- kevyt yläpalkki
- vasemmalla Uutisseuranta-logo/wordmark
- oikealla yksinkertainen navigaatio
- ulkoasu uutisseurantatyylinen: paljon valkoista tilaa, ohut rakenteellisuus, ei raskasta hero-banneria

### 2. Tabs + search
- uutisvirran yläpuolelle tabirivi
- esimerkiksi: `Kaikki`, `Politiikka`, `Talous`, `Teknologia`, `Maailma`
- oikeaan reunaan tai viimeiseksi hakukenttä/hakuikoni Uutisseuranta `tabs-with-search` -ajatuksella
- aktiivinen tabi käyttää teal-sävyä

### 3. Stream
- pääsisältö esitetään streamina, ei markkinointikortteina
- jokainen uutinen on yksi stream-item
- stream-item sisältää:
  - lähde / kirjoittaja / aika
  - otsikko
  - ingressi
  - tagit
  - toimintorivi
- stream on pystysuuntainen, luettava ja modulaarinen

### 4. Tagit
- aiheet esitetään isoina chip-kortteina joista ilmenee myös tagit
- perus-tagit neutraalilla tai vaalealla taustalla
- seuratut / painotetut / poissuljetut tilat erotetaan väreillä jotka on määritelty uutisseuranta patterneissa
- tagien mittasuhteet pidetään kompakteina

### 5. Notification / info blocks
- sivulla voidaan käyttää kuviointikirjaston tyylisiä notification- tai info-blockeja esim. "seuratuimmat lähteet", "aktiivisimmat aiheet", "uudet haut"
- nämä eivät ole marketing feature -kortteja vaan informatiivisia lohkoja

## Typografia

Typografian tulee olla lähempänä Uutisseurannan henkea kuin nykyistä sivua.

Suositus:
- otsikot: `Comfortaa`, sans-serif
- leipäteksti: `Muli`, `Muli Regular` tai lähellä oleva kevyt sans-serif
- jos Muli ei ole helposti saatavilla CDN:n kautta, voidaan käyttää neutraalia fallbackia kuten `Arial`, mutta visuaalinen tavoite pysyy kevenä civic-tech-sansina

Typografiasäännöt:
- otsikot pyöristetympiä ja ystävällisiä
- leipäteksti neutraalia ja hyvin luettavaa
- ei raskasta display-typografiaa
- ei suuria sankariotsikoita

## Värit

Uusi peruspaletti:

```css
--color-base: #007E84;
--color-base-dark: #00444A;
--color-base-light: #00D3CA;
--color-base-lightest: #D3FFFD;
--color-comp: #9E2E8D;
--color-comp-lightest: #FFEAFC;
--color-text: #222222;
--color-grey-lightest: #EEEEEE;
--color-white: #FFFFFF;
```

Säännöt:
- teal on päätoimintaväri
- purple/magenta on toissijainen korostus, ei pääväri
- taustat ovat pääosin valkoisia tai vaaleanharmaita
- komponenttien väri-ilmaisu on kevyt, ei raskas eikä glossy
- vältetään nykyisen sivun punainen identiteetti kokonaan

## CSS-arkkitehtuuri (päätös L-013)

CSS toteutetaan natiivilla nestauksella ja `@layer` Cascade Layereilla. Kerrosjärjestys:

```css
@layer reset, tokens, components, utilities;
```

- **reset** — selaindefaultien nollaus
- **tokens** — CSS-muuttujat (`--color-*`, `--space-*`, jne.)
- **components** — komponenttikohtaiset tyylit natiivilla nestingillä
- **utilities** — yksittäiset apuluokat, korkeimmalla prioriteetilla

Ei Sass- eikä PostCSS-esikääntäjiä. Moderni vanilla CSS nestingillä riittää.

## Komponenttisäännöt

### Buttonit
- perusnappi: teal-tausta tai vaalea teal + teal-border Uutisseurannan tapaan
- alternate-nappi: harmaa tausta ja tumma border
- ei moderneja pehmeitä varjo-CTA-nappeja
- kulmien pyöristys pieni, noin 5–6 px

### Tabit
- tabit muistuttavat Uutisseuranta `tab`-rakennetta
- aktiivinen tabi liittyy visuaalisesti sisältöpaneeliin
- tabit ovat litteä, eivät pill-chipsejä

### Tagit
- pieni fontti
- vaalea tausta
- hillitty border radius
- selkeä tilaerottelu mahdollisille positive/negative-tiloille

### Stream item
- meta ylös
- varsinainen sisältö keskelle
- tagit alle
- action-rivi alimmaksi
- erotellaan toisistaan ohuilla viivoilla tai tilalla
- ei korttiruudukkoa päälistaukseen

### Reaktiot (Samaa mieltä / Eri mieltä)

Uutisten reaktiot toteutetaan AS2 Like/Dislike -aktiviteeteilla, jotka näytetään käyttöliittymässä nimillä **Samaa mieltä** / **Eri mieltä** (päätös L-010). Laskurit näytetään erillisinä — ei nettokertymänä — kriittisen ajattelun tukemiseksi.

- Molemmat reaktiot ovat toggle: uudelleenklikkaus poistaa reaktion
- Yhtäaikaisesti voi olla voimassa vain toinen (Samaa mieltä poistaa Eri mieltä ja päinvastoin)
- Undo-operaatio ei kirjata lokiin anonymisoinnin säilyttämiseksi

## Layout

Layout ei ole enää landing page -sivu vaan sisältölähtöinen näkymä.

Rakenne:
- yläosa: logo + navigaatio
- sen alle tabs/haku
- pääalue: stream
- sivualue tai alempi lisäalue: notification/infobox-listat

Responsiivisuus:
- mobiilissa kaikki pinoutuu yhdeksi kolumniksi
- desktopissa stream voi olla keskitetty ja infolohkot oikealla tai alhaalla
- layout saa näyttää kevyeltä keskustelu- ja uutisalustalta, ei kampanjasivulta

## Tekninen rajaus

Toteutus käyttää **Vite-pakkaajaa** ja **npm-paketinhallintaa** (päätös L-009). Lähdekoodi on `src/`-kansiossa; Vite kääntää sen `dist/`-kansioon, josta GitHub Pages julkaisee.

Teknologiarajaukset:
- **HTML + CSS + vanilla JS** — ei JS-frameworkia (React, Vue, Angular, Svelte tms.)
- **Vite** build-työkaluna — ei Webpackia, Rolluppia tai Parcelia suoraan
- **Ei CSS-esikääntäjiä** — Sass, Less, PostCSS eivät ole käytössä; natiivi CSS nestingillä riittää
- **Ei Tailwindia**
- UI-komponentit eivät rakenna rakennettaan auth-tilan ympärille — Firebase näkyy vain `src/main.js`:ssä ja `src/prefs.js`:ssä, ei template-rakenteissa

Firebase SDK ladataan **npm-pakettina**, ei CDN-importtina. `index.html` ei saa sisältää Firebase-importteja — kaikki alustus tapahtuu `src/main.js`:ssä (ks. TECHNICAL_DESIGN.md → Firebase SDK).

## Toiminnallisuuksien jakelu ja päällekkäisyyden esto

- **Yksikäsitteisyys**: Jokaisen käyttötapauksen (Use Case) ja käyttäjätarinan (User Story) toiminnallisuuden tulee olla uniikki ilman päällekkäisiä tai kilpailevia toteutuksia.
- **Yhden paikan periaate**: Jokainen toiminnallisuus toteutetaan ja julkaistaan vain yhdessä paikassa (Single Source of Truth käyttöliittymässä tai taustajärjestelmässä). Samaa logiikkaa tai näkymää ei saa monistaa tarpeettomasti eri paikkoihin.

## Tiedostorakenne

Tiedostorakenne noudattaa organisaation yhteistä [CODE_CONVENTIONS.md](https://github.com/uutisseuranta/uutisseuranta.github.io/blob/main/CODE_CONVENTIONS.md) -ohjeistusta. Projekti käyttää Vite-pakkaajaa (päätös L-009): lähdekoodi on `src/`-kansiossa ja tuotantobuild käännetään `dist/`-kansioon.

Hyväksytty rakenne:
```
uutisseuranta.github.io/
├── .github/
│   └── workflows/
│       ├── deploy.yml              ← automaattinen Vite-build ja GitHub Pages -deploy
│       └── post-deploy-test.yml    ← smoke-testit deployauksen jälkeen
├── dist/                           ← Viten generoima tuotantobuild (Pages-julkaisukohde)
├── src/                            ← lähdekoodikansio (L-009)
│   ├── main.js                     ← Viten entrypoint — kaikki Firebase-alustus täällä
│   ├── app.js                      ← sovelluksen päälogiikka (UI-orkestrointi, Auth)
│   ├── prefs.js                    ← preferenssien hallinta (localStorage + Firestore)
│   ├── profile.js                  ← profiilimodaalin UI-logiikka
│   └── style.css                   ← native CSS, @layer Cascade Layerit (L-013)
├── index.html                      ← Vite-entrypoint juuressa — EI Firebase-importteja
├── package.json                    ← npm-paketit ja build-skriptit
├── package-lock.json
├── vite.config.js                  ← Vite- ja PWA/Workbox-konfiguraatio
├── .env.example                    ← Firebase-ympäristömuuttujien malli
├── .gitignore
├── live-smoke-test.sh              ← smoke-testiskripti
├── TECHNICAL_DESIGN.md             ← arkkitehtuuridokumentti
├── DESIGN_GUIDELINES.md            ← tämä dokumentti
├── logo.svg
└── favicon.ico
```

`src/`-kansion ulkopuolelle **ei luoda** muita JS- tai CSS-alikansioita (kuten `js/`, `assets/`, `css/`). Dokumentaatiotiedostot sijaitsevat juuressa — ei `docs/`-alikansioita.

## Toteutusperiaate

`index.html` on Viten entrypoint. Se sisältää vain rakenteellisen HTML:n ja yhden `<script type="module" src="/src/main.js">` -tagin. Kaikki logiikka ja Firebase-alustus tapahtuu `src/`-kansion tiedostoissa.

Tuotantobuild: `npm run build` → `dist/`. Paikallinen kehityspalvelin: `npm run dev`.

## Hyväksymiskriteerit

Design-uudistus on onnistunut, kun:
- sivu ei enää muistuta nykyistä punaista landing pagea
- sivu näyttää uutisseurantatyyliseltä mutta Uutisseurannalle sovitetulta
- uutiset esitetään streamina, ei startup-feature-kortteina
- tabit, tagit ja stream-itemit muodostavat yhtenäisen käyttöliittymän
- ulkoasu on selvästi vanillalla tehty, kevyt ja helposti jatkokehitettävä
- CSS käyttää `@layer`-rakennetta ja natiivia nestingiä (L-013)
- `index.html` ei sisällä Firebase CDN -importteja
- kaikki lähdetiedostot sijaitsevat `src/`-kansiossa tai repositorion juuressa — ei muita alikansioita
