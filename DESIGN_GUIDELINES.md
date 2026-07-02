# DESIGN_GUIDELINES.md — Uutisseuranta visuaalinen kieli

> **DESIGN_GUIDELINES.md** sisältää UI-visuaalisen kielen: värit, typografia, komponenttiperiaatteet.
> Normatiiviset vaatimukset (WCAG, AS2) ovat [STANDARDS.md](https://github.com/uutisseuranta/patterns/blob/main/STANDARDS.md):ssä.

Tavoitteena on korvata nykyinen ulkoasu D-CENT Pattern Labin periaatteita soveltaen, toteutettuna **vanilla HTML + CSS** -ratkaisuna.

---

## Visuaalinen kieli

### Värit

Uusi peruspaletti — D-CENT-henkinen, civic-tech-identiteetti:

```css
--color-base:           #007E84;  /* teal — päätoimintaväri */
--color-base-dark:      #00444A;
--color-base-light:     #00D3CA;
--color-base-lightest:  #D3FFFD;
--color-comp:           #9E2E8D;  /* magenta — toissijainen korostus */
--color-comp-lightest:  #FFEAFC;
--color-text:           #222222;
--color-grey-lightest:  #EEEEEE;
--color-white:          #FFFFFF;
```

Säännöt:
- Teal on päätoimintaväri — käytetään CTA-elementeissä, aktiivilinkissä, semanttisissa tiloissa.
- Magenta/purple on toissijainen korostus, ei pääväri. Enintään kaksi ei-neutraalia sävyä yhdessä näkymässä.
- Väriä käytetään merkitykseen, ei koristeluun.
- **Kielletty:** kortit `border-left`-väripalkki, ikonit värillisissä ympyröissä, gradient-napit.

### Typografia

- Otsikot: `Comfortaa`, sans-serif — pyöristetty ja ystävällinen, D-CENT-henkinen.
- Leipäteksti: `Muli` / `Mulish` tai kevyt sans-serif fallback (`Arial`).
- **Ei ulkoisia fontti-CDN-riippuvuuksia** — fontit `@font-face` + `local()` tai järjestelmäfonttipino.
- Nestemäinen kirjasinkoko `clamp()`-funktiolla. Kehon teksti 16 px, napit 14 px, minimi 12 px.
- Ei raskasta display-typografiaa, ei suuria sankariotsikoita.

---

## Komponenttiperiaatteet

### Artikkelikortti (stream-item)

Uutiset esitetään streamina, ei markkinointikortteina:

```
[meta: lähde / kirjoittaja / aika]
[otsikko]
[ingressi]
[tagit]
[toimintorivi]
```

- Pystysuuntainen, luettava, modulaarinen.
- Erotetaan toisistaan ohuilla viivoilla tai tilalla — ei korttiruudukkoa päälistaukseen.

### Kommentit (Note)

- D-CENT-kommenttirakenne: avatar, teksti, metadata, toimintopainikkeet.
- Kommentit ovat AS2 `Note`-objekteja `replies`-kokoelmassa.

### Tagit

- Pieni fontti, vaalea tausta, hillitty border-radius.
- Selkeä tilaerottelu: neutraali / seurattu / poissuljettu.
- Kompaktit mittasuhteet.

### Välilehdet (Tabs)

- Muistuttavat D-CENT `tab`-rakennetta — litteät, ei pill-chipsejä.
- Aktiivinen välilehti liittyy visuaalisesti sisältöpaneeliin, käyttää teal-sävyä.
- `role="tab"`, nuolinäppäinnavigaatio (ARIA Authoring Practices).

### Painikkeet

- Perusnappi: teal-tausta tai vaalea teal + teal-border D-CENTin tapaan.
- Alternate-nappi: harmaa tausta ja tumma border.
- Ei moderneja pehmeitä varjo-CTA-nappeja. Kulmien pyöristys ~5–6 px.

---

## D-CENT-spesifiset poikkeamat

- **tag-agree / tag-disagree -semantiikka:** positiiviset/negatiiviset tilat erotetaan väreillä (teal / magenta).
- **Magenta-erikoiskorostus:** `--color-comp` (`#9E2E8D`) käytetään toissijaisen huomion merkkinä, ei pääaksenttina.
- **Hallittu poikkeama-lista:** täydellinen lista [patterns/STANDARDS.md § Hallitut poikkeamat](https://github.com/uutisseuranta/patterns/blob/main/STANDARDS.md#hallitut-poikkeamat).

---

## Layout

Sisältölähtöinen näkymä, ei landing page:

```
[header: logo + navigaatio]
[tabs + hakukenttä]
[stream — pääsisältö]
[notification/infobox-listat]
```

- Mobiilissa kaikki pinoutuu yhdeksi kolumniksi (mobiili ensin, 375 px).
- Desktopissa stream keskitetty, infolohkot oikealla tai alhaalla.
- Prosateksti `max-width: 72ch`, datatiheä layout koko leveys.
- Siirtymäanimaatiot: `180ms cubic-bezier(0.16, 1, 0.3, 1)`. Ei välitöntä show/hide.
- `prefers-reduced-motion` kunnioitetaan.

---

## Mitä poistetaan

- Editorial-hero suurella markkinointitekstillä
- Nykyinen punainen väripaletti
- Cabinet Grotesk + Satoshi -typografia
- Feature-card-painotteinen landing-page-rakenne
- Geneerinen SaaS-tyylinen CTA-ajattelu
