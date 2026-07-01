# Patterns – D-CENT Pattern Lab -integraatio

Tämä dokumentti kuvaa, miten [D-CENT Pattern Lab](http://d-cent.github.io/patterns/) -kirjaston komponentit hyödynnetään täysimittaisesti uutisseuranta-projektissa ja miten ne korvaavat alkuperäisen yksittäisen HTML-template-lähestymistavan. Periaatteet noudattavat `ARCHITECTURE.md`:ssä määritettyjä teknisiä linjauksia: ei build-työkaluja, ei alikansioita, kaikki root-tasossa.

---

## Mikä on D-CENT Pattern Lab?

D-CENT Pattern Lab on Atomic Design -filosofiaan perustuva UI-komponenttikirjasto, joka on alun perin rakennettu avoimen demokratian ja kansalaisosallistumisen digitaalisia alustoja varten. Se jakaa käyttöliittymärakenteet neljään tasoon:

| Taso | Kuvaus | Esimerkit |
|---|---|---|
| **Atomit** | Pienimmät itsenäiset UI-elementit | Napit, kentät, linkit, ikonit, värimäärittelyt |
| **Molekyylit** | Atomien yhdistelmiä, yksi tehtävä | Hakukenttä + nappi, notifikaatiopalkki, tagin klikkauspari |
| **Organismit** | Toiminnalliset kokonaisuudet sivulla | Navigaatiopalkki, uutiskortti, kommenttivirta, kirjautumismodaali |
| **Templatet** | Sivu-layoutit ilman oikeaa sisältöä | Syötevirta-template, profiilisivu-template, asetussivu-template |

Nykyinen `index.html` on yksi monoliittinen template. Tavoite on pilkkoa se näihin tasoihin niin, että jokainen osa on uudelleenkäytettävä, testattava ja vaihdettavissa itsenäisesti.

---

## Atomit – perustason rakennuspalikat

Atomit määritellään `style.css`:ssä CSS-muuttujina ja yksittäisinä luokkaselektoreina. Ne eivät sisällä liiketoimintalogiikkaa, vaan ovat puhtaasti visuaalisia yksikköjä.

### Värit

D-CENT-paletti ja projektin oma Nexus-pohjainen värimuuttujisto yhdistetään:

```css
/* style.css */
:root {
  /* D-CENT primääriväri – hallitseva, kaikissa tiloissa */
  --color-primary: #01696f;
  --color-primary-hover: #0c4e54;

  /* Pinnat */
  --color-bg: #f7f6f2;
  --color-surface: #f9f8f5;

  /* Teksti */
  --color-text: #28251d;
  --color-text-muted: #7a7974;
}
```

Sääntö: D-CENT-väri on aina hallitseva. Aksentteja käytetään vain CTA-elementeissä, ei dekoratiivisesti.

### Typografia

```css
/* Fontshare CDN – ei Google Fonts */
@import url('https://api.fontshare.com/v2/css?f[]=satoshi@400,500,700&display=swap');

:root {
  --font-body: 'Satoshi', 'Helvetica Neue', sans-serif;
  --text-base: clamp(1rem, 0.95rem + 0.25vw, 1.125rem);
  --text-lg:   clamp(1.125rem, 1rem + 0.75vw, 1.5rem);
  --text-xl:   clamp(1.5rem, 1.2rem + 1.25vw, 2.25rem);
}
```

### Napit (Atoms → `style.css`)

```css
.btn {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-4);
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  font-weight: 500;
  cursor: pointer;
  transition: background 180ms ease, color 180ms ease;
}
.btn-primary  { background: var(--color-primary); color: #fff; border: none; }
.btn-secondary { background: transparent; color: var(--color-primary); border: 1px solid var(--color-primary); }
.btn-ghost     { background: transparent; color: var(--color-text-muted); border: none; }

.btn-primary:hover  { background: var(--color-primary-hover); }
.btn-secondary:hover { background: oklch(from var(--color-primary) l c h / 0.07); }
```

### Listat

Järjestämätön lista: elementtien järjestyksellä ei ole merkitystä. Käytä `role="list"` ja poista oletusmerkinnät:

```html
<ul role="list" class="tag-list">
  <li><a href="#" class="tag">Politiikka</a></li>
  <li><a href="#" class="tag">Talous</a></li>
</ul>
```

```css
.tag-list { list-style: none; display: flex; flex-wrap: wrap; gap: var(--space-2); }
.tag {
  padding: var(--space-1) var(--space-3);
  border-radius: var(--radius-full);
  background: var(--color-surface);
  border: 1px solid oklch(from var(--color-text) l c h / 0.12);
  font-size: var(--text-xs);
  color: var(--color-text-muted);
  text-decoration: none;
  transition: background 180ms ease;
}
.tag:hover { background: var(--color-primary-highlight); color: var(--color-primary); }
```

---

## Molekyylit – yhdistelmiä yhdellä tehtävällä

Molekyylit ovat HTML-paloja, joilla on yksi selkeä tarkoitus. Ne kirjoitetaan `index.html`:ään omina lohkoinaan ja stailataan `style.css`:ssä omilla nimialustoillaan.

### Notifikaatiopalkki

```html
<!-- Molekyyli: notifikaatiopalkki -->
<div class="notification" role="status" aria-live="polite">
  <span class="notification__icon" aria-hidden="true">●</span>
  <span class="notification__text">3 uutta uutista aiheesta Energia</span>
  <button class="notification__dismiss btn-ghost" aria-label="Sulje ilmoitus">✕</button>
</div>
```

```css
.notification {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  background: var(--color-surface);
  border-left: 3px solid var(--color-primary);
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
}
/* Poikkeus: border-left sallittu notifikaatiossa semanttisena tilaindikaattorina,
   ei dekoratiivisena elementtinä. Korteissa border-left on kielletty. */
```

### Hakumolekyyli

```html
<form class="search" role="search">
  <label for="search-input" class="sr-only">Etsi uutisia</label>
  <input id="search-input" type="search" class="search__input" placeholder="Etsi...">
  <button type="submit" class="btn btn-primary search__btn">Hae</button>
</form>
```

---

## Organismit – toiminnalliset kokonaisuudet

Organismit koostuvat molekyyleistä ja atomeista. Ne vastaavat sivun yksittäisiä toiminnallisia alueita.

### Navigaatiopalkki

D-CENT Pattern Labin navigaatio-organismi: logo vasemmalla, linkit keskellä/oikealla, kirjautumistila oikeassa reunassa. Firebase Auth -tila päivittää vain `.nav__auth`-elementin – muu navigaatio pysyy staattisena.

```html
<header class="site-header">
  <nav class="nav" aria-label="Päänavigaatio">
    <a href="/" class="nav__logo" aria-label="Uutisseuranta – etusivu">
      <!-- SVG logo tähän -->
    </a>
    <ul class="nav__links" role="list">
      <li><a href="#virta" class="nav__link">Virta</a></li>
      <li><a href="#aiheet" class="nav__link">Aiheet</a></li>
    </ul>
    <div class="nav__auth">
      <!-- Firebase Auth päivittää tämän: anonyymi → kirjautunut -->
      <button class="btn btn-primary" id="login-btn">Kirjaudu</button>
    </div>
  </nav>
</header>
```

### Uutiskortti (Stream Item)

D-CENT:n stream-item-organismi sovitettuna uutisseurantaan. Ei border-left -väripalkki, ei ikoneita värillisissä ympyröissä – vain sisältö, lähde, aika ja tagit.

```html
<article class="news-card">
  <header class="news-card__header">
    <span class="news-card__source">Yle</span>
    <time class="news-card__time" datetime="2026-07-01T12:00">tänään 12:00</time>
  </header>
  <h2 class="news-card__title">
    <a href="#" class="news-card__link">Otsikko tähän</a>
  </h2>
  <p class="news-card__summary">Tiivistelmä uutisesta. Maksimissaan kaksi kolme virkettä.</p>
  <ul class="tag-list" role="list">
    <li><a href="#" class="tag">Energia</a></li>
    <li><a href="#" class="tag">EU</a></li>
  </ul>
</article>
```

```css
.news-card {
  padding: var(--space-4) var(--space-5);
  background: var(--color-surface);
  border: 1px solid oklch(from var(--color-text) l c h / 0.08);
  border-radius: var(--radius-lg);
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  transition: box-shadow 180ms ease;
}
.news-card:hover { box-shadow: var(--shadow-md); }
.news-card__header { display: flex; justify-content: space-between; align-items: center; }
.news-card__source { font-size: var(--text-xs); font-weight: 600; color: var(--color-primary); text-transform: uppercase; letter-spacing: 0.05em; }
.news-card__time   { font-size: var(--text-xs); color: var(--color-text-muted); }
.news-card__title  { font-size: var(--text-lg); line-height: 1.3; margin: 0; }
.news-card__link   { color: var(--color-text); text-decoration: none; }
.news-card__link:hover { color: var(--color-primary); }
.news-card__summary { font-size: var(--text-base); color: var(--color-text-muted); max-width: 72ch; }
```

### Kirjautumismodaali

```html
<dialog class="modal" id="login-modal" aria-labelledby="modal-title">
  <div class="modal__inner">
    <h2 id="modal-title" class="modal__title">Kirjaudu sisään</h2>
    <p class="modal__desc">Tallenna seurantasi kirjautumalla Google-tilillä.</p>
    <button class="btn btn-primary modal__google" id="google-signin-btn">
      Kirjaudu Google-tilillä
    </button>
    <button class="btn-ghost modal__close" aria-label="Sulje" id="modal-close">✕</button>
  </div>
</dialog>
```

Käytä natiivia `<dialog>`-elementtiä. Se hoitaa focus-loukon ja Escape-näppäimen automaattisesti ilman JS-kirjastoja.

```javascript
// app.js – modaalin ohjaus
const modal = document.getElementById('login-modal');
document.getElementById('login-btn').addEventListener('click', () => modal.showModal());
document.getElementById('modal-close').addEventListener('click', () => modal.close());
modal.addEventListener('click', e => { if (e.target === modal) modal.close(); });
```

---

## Templatet – sivukohtaiset layoutit

Template on sivu-layout ilman oikeaa sisältöä. Uutisseurannan kontekstissa kaikki templatet elävät `index.html`:ssä yhtenä tiedostona hash-navigaatiolla tai CSS-näkyvyydellä.

### Nykyinen template → patterneiksi

Alkuperäinen monoliittinen `index.html` pilkotaan seuraavasti:

```
ALKUPERÄINEN (yksi template)
  └── index.html (kaikki sekaisin)

TAVOITE (Atomic Design)
  ├── index.html          ← kokoaa organismit templateiksi
  ├── style.css           ← atomit + molekyylit + organismi-tyylit
  └── app.js              ← organismien logiikka + Firebase Auth
```

### Virta-template (oletushome)

```html
<main id="virta" class="template-stream">
  <aside class="sidebar">
    <!-- Organismi: aihesuodatin -->
  </aside>
  <section class="stream" aria-label="Uutisvirta">
    <!-- Organismi: news-card × N -->
  </section>
</main>
```

```css
.template-stream {
  display: grid;
  grid-template-columns: 260px 1fr;
  gap: var(--space-8);
  max-width: var(--content-wide);
  margin-inline: auto;
  padding: var(--space-6) var(--space-4);
}
@media (max-width: 768px) {
  .template-stream { grid-template-columns: 1fr; }
  .sidebar { display: none; } /* korvautuu bottom-sheet-suodattimella */
}
```

---

## Migraatiosuunnitelma

Nykyisen `index.html`:n korvaaminen patterneilla tapahtuu inkrementaalisesti. Jokainen vaihe on oma PR:

| Vaihe | Kuvaus | Tiedostot |
|---|---|---|
| 1 | Atomit: CSS-muuttujat ja utility-luokat `style.css`:ään | `style.css` |
| 2 | Molekyylit: notifikaatio, haku, tagit `style.css`:ään | `style.css` |
| 3 | Navorganismi: header + Firebase Auth -tila | `index.html`, `app.js` |
| 4 | Uutiskortti-organismi: korvaa nykyinen uutisvirta | `index.html`, `style.css` |
| 5 | Kirjautumismodaali: korvaa nykyinen modaali `<dialog>`-elementillä | `index.html`, `app.js` |
| 6 | Virta-template: sidebar + grid-layout | `index.html`, `style.css` |

Jokainen vaihe on itsenäisesti testattavissa pipelinen smoke-testillä ennen mergeä.

---

## Poikkeukset arkkitehtuurilinjauksiin

Pattern-integraatio ei muuta `ARCHITECTURE.md`:n perusperiaatteita:

- Kaikki tiedostot juuressa – ei `components/`-, `patterns/`- tai `src/`-alikansioita
- Ei build-steppiä – pattern-komponentit kirjoitetaan suoraan `index.html`:ään ja `style.css`:ään
- Ei ulkoisia pattern-kirjastojen CDN-riippuvuuksia – D-CENT Pattern Lab toimii inspiraationa ja rakennemallina, ei asennettavana pakettina
- `<dialog>`-elementti on standardi HTML5 – ei vaadi JS-kirjastoa
