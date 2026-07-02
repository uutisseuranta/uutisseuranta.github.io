# LICENSES.md — Avointen komponenttien lisenssit ja ylläpito

Tämä tiedosto kuvaa **uutisseuranta.github.io**-repositoriossa käytetyt avoimen lähdekoodin kolmannen osapuolen ohjelmistokomponentit, niiden lisenssit, ylläpidon tilan, vastuutahot ja ylläpitäjien ensisijaiset toimintamaat.

| Komponentti | Lisenssi | Ylläpidon tila | Vastuutaho | Ylläpitäjän maa |
| :--- | :--- | :--- | :--- | :--- |
| **Firebase Web SDK (v10)** | Apache-2.0 | Erittäin aktiivinen | Google LLC / Firebase-tiimi | 🇺🇸 Yhdysvallat |
| **Mulish Font (WOFF2)** | OFL-1.1 | Vakaa (ylläpitotila) | Google Fonts / Vernon Adams (perikunta) & Cyreal | 🇺🇸 Yhdysvallat / 🇺🇦 Ukraina |
| **IntersectionObserver Polyfill / Native API** | W3C / Native | Selainten tukema standardi | W3C / Selainvalmistajat | 🌐 Kansainvälinen (W3C) |
| **D-CENT Patterns (D-CENT UI)** | MIT | Kuollut (arkistoitu 2016) | D-CENT Project / D-CENT Lab | 🇪🇺 Euroopan unioni (UK/Espanja/Suomi) |

---

## Komponenttien yksityiskohtainen kuvaus

### 1. Firebase Web SDK
- **Rooli:** Autentikaatio (Google Auth), tietokanta (Firestore-synkronointi offline-tuella) ja Google Analytics -integraatio.
- **Elinvoima:** Erittäin vahva. Google kehittää ja tukee aktiivisesti. Kyseessä on maailmanlaajuinen de facto -standardi Backend-as-a-Service (BaaS) -ratkaisuissa.
- **Maantiede:** Ensisijaisesti Yhdysvallat (Google LLC:n pääkonttori Kaliforniassa).

### 2. Mulish Font (aiemmin Muli)
- **Rooli:** Paikallisesti ladattava (WOFF2) typografia otsikoille ja leipätekstille offline- ja PWA-tukea varten.
- **Elinvoima:** Vakaa. Fontti on valmis eikä vaadi jatkuvaa kehitystä. Google Fonts ylläpitää jakelua.
- **Maantiede:** Alun perin Vernon Adams (Yhdistynyt kuningaskunta), myöhemmin Cyreal-fonttivalimon (Ukraina) ja Google Fontsin (Yhdysvallat) ylläpitämä.

### 3. D-CENT Patterns
- **Rooli:** Käyttöliittymäsuunnittelun patterneiden ja värijärjestelmän esikuva.
- **Elinvoima:** Ei elinvoimaa. Projekti on päättynyt ja arkistoitu vuonna 2016. Koodia ei tule käyttää sellaisenaan, vaan sen periaatteet modernisoidaan vanilla HTML/CSS-ratkaisuiksi.
- **Maantiede:** Kehitetty EU-hankkeessa, kumppaneina mm. Nesta (UK), Barcelona City Council (Espanja) ja Forum Virium Helsinki (Suomi).
