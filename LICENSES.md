# LICENSES.md — Avointen komponenttien lisenssit ja ylläpito (uutisseuranta.github.io)

Tämä tiedosto kuvaa **uutisseuranta.github.io** -repositoriossa käytetyt avoimen lähdekoodin kolmannen osapuolen ohjelmistokomponentit, niiden lisenssit, ylläpidon tilan ja vastuutahot.

| Komponentti | Lisenssi | Ylläpidon tila | Vastuutaho | Ylläpitäjän maa |
| :--- | :--- | :--- | :--- | :--- |
| **Comfortaa Font** | OFL-1.1 | Vakaa (ylläpitotila) | Google Fonts / Johan Kallas | 🇪🇪 Viro / 🇺🇸 Yhdysvallat |
| **Muli / Mulish Font** | OFL-1.1 | Vakaa (ylläpitotila) | Google Fonts / Vernon Adams & Cyreal | 🇺🇸 Yhdysvallat / 🇺🇦 Ukraina / 🇬🇧 UK |
| **D-CENT Patterns** | MIT | Kuollut (arkistoitu 2016) | D-CENT Project / D-CENT Lab | 🇪🇺 Euroopan unioni |
| **Firebase JS SDK** | Apache-2.0 | Aktiivinen | Google LLC | 🇺🇸 Yhdysvallat |

---

## Komponenttien kuvaus

### 1. Comfortaa-fontti
- **Rooli:** Otsikkofontti — antaa D-CENT-tyyliä kuvaavan ilmeen.
- **Elinvoima:** Vakaa. Ei vaadi jatkuvaa kehitystä.
- **Maantiede:** Alun perin suunnitellut Johan Kallas (Viro), ylläpitää Google Fonts (Yhdysvallat).
- **Lisenssi:** [SIL Open Font License 1.1](https://scripts.sil.org/OFL)

### 2. Muli / Mulish -fontti
- **Rooli:** Leipätekstin typografia.
- **Elinvoima:** Vakaa.
- **Maantiede:** Alun perin suunnitellut Vernon Adams (Yhdistynyt kuningaskunta), ylläpitää Cyreal (Ukraina) ja Google Fonts (Yhdysvallat).
- **Lisenssi:** [SIL Open Font License 1.1](https://scripts.sil.org/OFL)

### 3. D-CENT Patterns
- **Rooli:** UI-komponenttikirjaston perusta — Atomic Design -hierarkia, CSS-arkkitehtuuri, komponenttimallit.
- **Elinvoima:** Arkistoitu 2016. Ei aktiivista ylläpitoa. Käytetään sovellettuna pohjana.
- **Alkuperäinen repo:** [https://github.com/d-cent/patterns](https://github.com/d-cent/patterns)
- **Lisenssi:** [MIT](https://opensource.org/licenses/MIT)

### 4. Firebase JS SDK
- **Rooli:** Authentication (Google Sign-In), Analytics (GA4), Firestore (käyttäjäpreferenssit).
- **Elinvoima:** Aktiivinen.
- **Lisenssi:** [Apache License 2.0](https://www.apache.org/licenses/LICENSE-2.0)
- **Rajaus:** Käyttö rajattu kolmeen tarkoitukseen — ks. [TECHNICAL_DESIGN.md § Firebase-rajaus](./TECHNICAL_DESIGN.md#firebase-rajaus)

---

## Ristiin-linkit

- [patterns/LICENSES.md](https://github.com/uutisseuranta/patterns/blob/main/LICENSES.md) — patterns-repon lisenssiluettelo
- [gcs-activitystreams/LICENSES.md](https://github.com/uutisseuranta/gcs-activitystreams/blob/main/LICENSES.md) — backend-repon lisenssiluettelo
