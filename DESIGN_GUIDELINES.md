# Uutisseuranta design guideline

Tämä dokumentti määrittää uuden **Uutisseuranta**-käyttöliittymän suunnan. Tavoitteena on korvata nykyinen ulkoasu Uutisseuranta Pattern Labin periaatteita soveltaen, mutta toteuttaa sivu **vanilla HTML + CSS** -ratkaisuna ilman Firebase-riippuvuutta käyttöliittymäkerroksessa.

## Tavoite

Uutisseurannan ulkoasun tulee muistuttaa enemmän civic-tech- ja keskusteluvirta-tuotetta kuin geneeristä startup-landing pagea. Sivun tulee näyttää siltä, että se perustuu johdonmukaiseen design systemiin: selkeä värihierarkia, yksinkertainen typografia, modulaariset stream-komponentit, tabit, tagit ja hillitty mutta tunnistettava visuaalinen identiteetti.

## Lähde-inspiraatio

Ulkoasu perustuu soveltuvilta osin Uutisseuranta Pattern Labiin:
- pääväri teal: `#007E84`
- korostusväri magenta/purple: `#9E2E8D`
- pääteksti tumma: `#222222`
- vaaleat taustat: `#EEE`, `#D3FFFD`, `#FFEAFC`
- patternit: `tabs`, `tags`, `stream-item`, `notification`, `stream`

Näitä ei kopioida mekaanisesti pikselilleen, vaan niistä rakennetaan Uutisseurannalle yhteinäinen HTML/CSS-toteutus.

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
- sivulla voidaan käyttää kuviointikirjaston tyylisiä notification- tai info-blockeja esim. “seuratuimmat lähteet”, “aktiivisimmat aiheet”, “uudet haut”
- nämä eivät ole marketing feature -kortteja vaan informatiivisia lohkoja

## Typografia

Typografian tulee olla lähempänä Uutisseurannan henkea kuin nykyistä sivua.

Suositus:
- otsikot: `Comfortaa`, sans-serif
- leipäteksti: `Muli`, `Muli Regular` tai lähellä oleva kevyt sans-serif
- jos Muli ei ole helposti saatavilla CDN:n kautta, voidaan käyttää neutraalia fallbackia kuten `Arial`, mutta visuaalinen tavoite pysyy kevenä civic-tech-sansina

TypografiASäännöt:
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
- ei korttiruučukkoa päälistaukseen

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
- layout saa näyttää keveltä keskustelu- ja uutisalustalta, ei kampanjasivulta

## Tekninen rajaus

Tämä redesign toteutetaan seuraavilla ehdoilla:
- vain **HTML + CSS + kevyt vanilla JS**
- ei design frameworkia
- ei Tailwindia
- ei Firebase-riippuvaista UI-logiikkaa
- ei UI-rakenteita, jotka rakentuvat auth-tilan ympärille
- kaikki käyttöliittymäelementit toimivat ilman backend-riippuvuutta

## Tiedostorakenne

Projekti noudattaa tiukkaa **"ei alikansioita"** -periaatetta (ks. `TECHNICAL_DESIGN.md`). Ainoa poikkeus on GitHub Actions -työnkulkuja varten tarkoitettu `.github/`-hakemisto. Kaikki muut tiedostot — koodit, tyylit, skriptit, kuvat, fontit ja testit — sijaitsevat suoraan repositorion **juurihakemistossa**.

Tämä rakenne takaa sen, että tiedostojen väliset viittaukset ovat mahdollisimman yksinkertaisia ja vältytään polkujen hallinnan aiheuttamalta monimutkaisuudelta.

Hyväksytty rakenne:
```
uutisseuranta/
├── .github/
│   └── workflows/
│       └── post-deploy-test.yml
├── index.html          ← pääsivu
├── style.css           ← tyylimäärittelyt
├── app.js              ← sovelluksen päälogiikka (ei-Firebase)
├── prefs.js            ← preferenssien hallintamoduuli
├── profile.js          ← profiilimodaalimoduuli
├── live-smoke-test.sh  ← testiskripti
├── firebase.json       ← Firebase-konfiguraatio
├── TECHNICAL_DESIGN.md     ← arkkitehtuuridokumentti
├── patterns.md         ← Uutisseuranta-komponentit
├── DESIGN_GUIDELINES.md ← tämä dokumentti
├── logo.svg
└── favicon.ico
```

Kaikkien alihakemistojen (kuten `js/`, `tests/`, `assets/`, `css/` tms.) luominen ja käyttö on kielletty.

## Toteutusperiaate repoa varten

`index.html` korvataan uudella rakenteella. Tiedosto voi sisältää:
- uuden CSS:n suoraan `<style>`-tagissa tai erillisessä tiedostossa
- uuden semanttisen HTML-rakenteen
- vanhan landing page -rakenteen poiston
- staattiset demo-uutiset, jotta design näkyy ilman backend-integraatiota

Mahdollinen jatkorakenne:
- `index.html`
- `style.css`
- `logo.svg`

## Hyväksymiskriteerit

Design-uudistus on onnistunut, kun:
- sivu ei enää muistuta nykyistä punaista landing pagea
- sivu näyttää uutisseurantatyyliseltä mutta Uutisseurannalle sovitetulta
- uutiset esitetään streamina, ei startup-feature-kortteina
- tabit, tagit ja stream-itemit muodostavat yhteinäisen käyttöliittymän
- koko sivu toimii ilman Firebase-kytkenstää
- ulkoasu on selvästi vanillalla tehty, kevyt ja helposti jatkokehitettavä
- **kaikki tiedostot — myös assetit — sijaitsevat repositorion juuressa**
