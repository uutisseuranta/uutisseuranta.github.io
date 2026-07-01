# Uutisseuranta design guideline

Tämä dokumentti määrittää uuden **Uutisseuranta**-käyttöliittymän suunnan. Tavoitteena on korvata nykyinen ulkoasu D-CENT Pattern Labin periaatteita soveltaen, mutta toteuttaa sivu **vanilla HTML + CSS** -ratkaisuna ilman Firebase-riippuvuutta käyttöliittymäkerroksessa.

## Tavoite

Uutisseurannan ulkoasun tulee muistuttaa enemmän civic-tech- ja keskusteluvirta-tuotetta kuin geneeristä startup-landing pagea. Sivun tulee näyttää siltä, että se perustuu johdonmukaiseen design systemiin: selkeä värihierarkia, yksinkertainen typografia, modulaariset stream-komponentit, tabit, tagit ja hillitty mutta tunnistettava visuaalinen identiteetti.

## Lähde-inspiraatio

Ulkoasu perustuu soveltuvilta osin D-CENT Pattern Labiin:
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
- ulkoasu D-CENT-henkinen: paljon valkoista tilaa, ohut rakenteellisuus, ei raskasta hero-banneria

### 2. Tabs + search
- uutisvirran yläpuolelle tabirivi
- esimerkiksi: `Kaikki`, `Politiikka`, `Talous`, `Teknologia`, `Maailma`
- oikeaan reunaan tai viimeiseksi hakukenttä/hakuikoni D-CENT `tabs-with-search` -ajatuksella
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
- seuratut / painotetut / poissuljetut tilat erotetaan väreillä jotka on määritelty d-cent patterneissa
- tagien mittasuhteet pidetään kompakteina

### 5. Notification / info blocks
- sivulla voidaan käyttää D-CENT-tyylisiä notification- tai info-blockeja esim. “seuratuimmat lähteet”, “aktiivisimmat aiheet”, “uudet haut”
- nämä eivät ole marketing feature -kortteja vaan informatiivisia lohkoja

## Typografia

Typografian tulee olla lähempänä D-CENTin henkeä kuin nykyistä sivua.

Suositus:
- otsikot: `Comfortaa`, sans-serif
- leipäteksti: `Muli`, `Muli Regular` tai lähellä oleva kevyt sans-serif
- jos Muli ei ole helposti saatavilla CDN:n kautta, voidaan käyttää neutraalia fallbackia kuten `Arial`, mutta visuaalinen tavoite pysyy kevyenä civic-tech-sansina

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

## Komponenttisäännöt

### Buttonit
- perusnappi: teal-tausta tai vaalea teal + teal-border D-CENTin tapaan
- alternate-nappi: harmaa tausta ja tumma border
- ei moderneja pehmeitä varjo-CTA-nappeja
- kulmien pyöristys pieni, noin 5–6 px

### Tabit
- tabit muistuttavat D-CENT `tab`-rakennetta
- aktiivinen tabi liittyy visuaalisesti sisältöpaneeliin
- tabit ovat litteitä, eivät pill-chipsejä

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

Tämä redesign toteutetaan seuraavilla ehdoilla:
- vain **HTML + CSS + kevyt vanilla JS**
- ei design frameworkia
- ei Tailwindia
- ei Firebase-riippuvaista UI-logiikkaa
- ei UI-rakenteita, jotka rakentuvat auth-tilan ympärille
- kaikki käyttöliittymäelementit toimivat ilman backend-riippuvuutta

## Toteutusperiaate repoa varten

`index.html` korvataan uudella rakenteella. Tiedosto voi sisältää:
- uuden CSS:n suoraan `<style>`-tagissa tai erillisessä tiedostossa
- uuden semanttisen HTML-rakenteen
- vanhan landing page -rakenteen poiston
- staattiset demo-uutiset, jotta design näkyy ilman backend-integraatiota

Mahdollinen jatkorakenne:
- `index.html`
- `styles.css`
- `logo.svg`

## Hyväksymiskriteerit

Design-uudistus on onnistunut, kun:
- sivu ei enää muistuta nykyistä punaista landing pagea
- sivu näyttää D-CENT-henkiseltä mutta Uutisseurannalle sovitetulta
- uutiset esitetään streamina, ei startup-feature-kortteina
- tabit, tagit ja stream-itemit muodostavat yhtenäisen käyttöliittymän
- koko sivu toimii ilman Firebase-kytkentää
- ulkoasu on selvästi vanillalla tehty, kevyt ja helposti jatkokehitettävä
