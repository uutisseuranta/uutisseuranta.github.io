# Uutisseuranta - Käyttäjäpolut ja käyttäjätarinat

Tämä dokumentti kuvaa uutisseuranta.net-sivuston käyttäjäpolut, käyttäjätarinat ja niiden teknisen toteutuksen. Dokumentti erittelee koodissa toteutetut toiminnallisuudet ja tulevaisuudelle suunnitellut laajennukset.

Kaikki kuvaukset pohjautuvat suoraan lähdekoodiin:
- [src/main.js](file:///Users/jaakkokorhonen/uutisseuranta/src/main.js): Sovelluksen päälogiikka, uutisvirran renderöinti, ActivityStreams 2.0 -syöte, kommentointi ja PWA-tuki.
- [src/prefs.js](file:///Users/jaakkokorhonen/uutisseuranta/src/prefs.js): Käyttäjäpreferenssien hybrid-persistointi (`localStorage` + Firestore).
- [src/profile.js](file:///Users/jaakkokorhonen/uutisseuranta/src/profile.js): Profiilimodaali, asetusten hallinta, JSON-vienti ja GDPR-tilinpoisto.
- [src/theme.js](file:///Users/jaakkokorhonen/uutisseuranta/src/theme.js): Teeman alustus ennen first-paint-vaihetta.
- [bq-activitystreams/query_api.py](file:///Users/jaakkokorhonen/uutisseuranta/bq-activitystreams/query_api.py): Uutisvirran haku ja backend-suodatus (`/ap/outbox`).
- [TECHNICAL_DESIGN.md](file:///Users/jaakkokorhonen/uutisseuranta/TECHNICAL_DESIGN.md): Arkkitehtuurilinjaukset ja teknologiarajaukset.
- [STANDARDS.md](file:///Users/jaakkokorhonen/uutisseuranta/STANDARDS.md): WCAG- ja GDPR-standardivaatimukset.

---

## Käyttäjätarinan rakenne

Jokainen käyttötapaus on kuvattu käyttäjätarinana (User Story), joka noudattaa ketterän kehityksen vakiomuotoa:
> **Roolina [kuka]** haluan **[mitä / toiminto]**, jotta **[miksi / saavutettava arvo tai hyöty]**.

Käyttäjätarinoiden yhteydessä määritellään:
1. **Käyttäjätarina:** Käyttäjälähtöinen tavoite ja arvo.
2. **Hyväksymiskriteerit (Acceptance Criteria):** Tarkistuslista vaatimuksista, joiden perusteella toiminnallisuus todetaan valmiiksi.
3. **Konkreettinen toteutus koodissa:** Tekninen toteutustapa, kutsuttavat funktiot, rajapinnat ja tietorakenteet.

---

## Käyttäjäprofiilit ja roolit

| Rooli | Kuvaus | Autentikointi ja tallennus |
|---|---|---|
| **Anonyymi käyttäjä** | Selaa uutisia ilman kirjautumista. | Ei vaadi tunnistautumista. Luettujen artikkelien tunnisteet lähetetään backendille `seen_ids`-listana (`POST /ap/outbox`). Asetukset tallennetaan paikallisesti selaimen `localStorage`-muistiin (`prefs_anonymous`). |
| **Kirjautunut käyttäjä** | Tunnistautuu Google-tilillä. | Firebase Authentication (`GoogleAuthProvider`). Luetut artikkelit synkronoidaan taustalle AS2 `Read` -aktiviteetteina ja backend suodattaa luetut pois automaattisesti käyttäjätunnisteen perusteella. Asetukset synkronoidaan Firestoreen (`/users/{uid}/preferences/main`). |

---

## Käyttötapausten tila ja yhteenveto

| Tunnus | Käyttötapaus | Tila | Keskeiset kooditiedostot |
|---|---|---|---|
| **UP-1** | Ensivierailu ja arvolupauksen tarkastelu | ✅ Toteutettu | [index.html](file:///Users/jaakkokorhonen/uutisseuranta/index.html), [src/main.js](file:///Users/jaakkokorhonen/uutisseuranta/src/main.js) |
| **UP-2** | Uutisvirran selaaminen ja backend-suodatettu sivutus | ✅ Toteutettu | [src/main.js](file:///Users/jaakkokorhonen/uutisseuranta/src/main.js), [bq-activitystreams/query_api.py](file:///Users/jaakkokorhonen/uutisseuranta/bq-activitystreams/query_api.py) |
| **UP-3** | Teeman vaihto (vaalea / tumma / järjestelmä) | ✅ Toteutettu | [src/theme.js](file:///Users/jaakkokorhonen/uutisseuranta/src/theme.js), [src/prefs.js](file:///Users/jaakkokorhonen/uutisseuranta/src/prefs.js), [src/main.js](file:///Users/jaakkokorhonen/uutisseuranta/src/main.js) |
| **UP-4** | Kirjautuminen Google-tunnuksella | ✅ Toteutettu | [src/main.js](file:///Users/jaakkokorhonen/uutisseuranta/src/main.js) (`signInWithPopup`) |
| **UP-5** | Uloskirjautuminen | ✅ Toteutettu | [src/profile.js](file:///Users/jaakkokorhonen/uutisseuranta/src/profile.js) (`signOut`) |
| **UP-6** | Lähteiden aktiivisuuden tarkastelu | ✅ Toteutettu | [src/main.js](file:///Users/jaakkokorhonen/uutisseuranta/src/main.js) (`loadHomepageStats`, `updateActiveSourcesWidget`) |
| **UP-7** | Avoin lähdekoodi ja kehitykseen osallistuminen | ✅ Toteutettu | [index.html](file:///Users/jaakkokorhonen/uutisseuranta/index.html) |
| **UP-8** | Responsiivinen mobiiliselaus ja PWA-offline-tuki | ✅ Toteutettu | [src/main.js](file:///Users/jaakkokorhonen/uutisseuranta/src/main.js) (`Workbox`), [src/style.css](file:///Users/jaakkokorhonen/uutisseuranta/src/style.css) |
| **UP-9** | Tagipohjainen uutisvirtanäkymä ja tagipilvi | ✅ Toteutettu | [src/main.js](file:///Users/jaakkokorhonen/uutisseuranta/src/main.js) (`renderTagCloud`, tagisuodatus) |
| **UP-10** | Käyttäjäasetusten hybrid-hallinta | ✅ Toteutettu | [src/prefs.js](file:///Users/jaakkokorhonen/uutisseuranta/src/prefs.js), [src/profile.js](file:///Users/jaakkokorhonen/uutisseuranta/src/profile.js) |
| **UP-11** | "Uutta seuraamissasi aiheissa" -ilmoitukset | ✅ Toteutettu | [src/main.js](file:///Users/jaakkokorhonen/uutisseuranta/src/main.js) (`updateNotificationsBadge`) |
| **UP-12** | Käyttäjäprofiili ja seurantatiedot | ✅ Toteutettu | [src/profile.js](file:///Users/jaakkokorhonen/uutisseuranta/src/profile.js) |
| **UP-13** | Artikkelin kontekstuaalinen vertailu ("Sama aihe muualla") | 🔲 Suunniteltu | Suunniteltu Jaccard-samankaltaisuudella muistissa |
| **UP-14** | Vapaatekstihaku ja URL-hash-tila | 🔲 Suunniteltu | Suunniteltu asiakaspuolen hakuna (`#haku=...`) |
| **UP-15** | Kirjautumisen valinnaisuus ja matala käyttökynnys | ✅ Toteutettu | [src/main.js](file:///Users/jaakkokorhonen/uutisseuranta/src/main.js), [src/prefs.js](file:///Users/jaakkokorhonen/uutisseuranta/src/prefs.js) |
| **UP-16** | 2-tasoinen kommentointi ja vastausketjut (D-CENT) | ✅ Toteutettu | [src/main.js](file:///Users/jaakkokorhonen/uutisseuranta/src/main.js) (`fetchReplies`, `postComment`, autocomplete) |
| **UP-17** | Maksumuuritunnistus ja Wayback Machine -arkistolinkki | ✅ Toteutettu | [src/main.js](file:///Users/jaakkokorhonen/uutisseuranta/src/main.js) (`/ap/check-status`, `url_archive`) |
| **UP-18** | GDPR-tietojen vienti (JSON) ja tilin poisto | ✅ Toteutettu | [src/prefs.js](file:///Users/jaakkokorhonen/uutisseuranta/src/prefs.js) (`exportPrefsAsJson`), [src/profile.js](file:///Users/jaakkokorhonen/uutisseuranta/src/profile.js) (`deleteUserPrefs`) |

---

## Toteutetut käyttäjätarinat (konkreettinen toteutus koodissa)

### UP-1 · Ensivierailu ja dynaamiset tilastot
* **Käyttäjätarina:**
  > **Uutistenlukijana** haluan nähdä heti etusivulta palvelun arvolupauksen, reaaliaikaiset julkaisutilastot ja selkeät toimintanapit, jotta ymmärrän mistä palvelussa on kyse ja voin siirtyä lukemaan uutisia yhdellä klikkauksella.
* **Hyväksymiskriteerit:**
  1. Hero-osio latautuu välittömästi esittäen palvelun pääotsikon ja kuvauksen.
  2. Tilastoluvut (lähteiden määrä, 24h artikkelimäärä ja päivitysväli) haetaan asynkronisesti taustapalvelusta.
  3. "Katso esimerkkejä" ja "Uutiset" siirtävät käyttäjän uutisnäkymään ilman sivulatausta.
* **Konkreettinen toteutus koodissa:**
  * [src/main.js](file:///Users/jaakkokorhonen/uutisseuranta/src/main.js): Funktio `loadHomepageStats()` hakee BigQuery-tilastot endpointista `GET /ap/stats` ja päivittää DOM-elementit `stat-sources`, `stat-articles` ja `stat-interval`.
  * SPA-reititin ohjaa uutisnäkymään kutsumalla `updatePrefs({ currentView: 'news' })`.

---

### UP-2 · Uutisvirran selaaminen ja progressiivinen laajennus (5 -> 50 -> 500)
* **Käyttäjätarina:**
  > **Aktiivisena uutisseuraajana** haluan selata lukemattomia uutisia asteittain (1–5 -> 1–50 -> 1–500) siten, että uutiset laajenevat saumattomasti samasta lukemattomien artikkeleiden joukosta eivätkä aiemmat uutiset koskaan katoa tai vaihdu kesken selaussession, ja luetut uutiset kuitataan palvelimelle vasta setin lukemisen jälkeen (Päätös L-025).
* **Hyväksymiskriteerit:**
  1. Alussa ladataan käyttäjän lukemattomien artikkeleiden joukko (enintään 500 kpl) ja näytetään heti ensimmäiset 5 artikkelia (1–5).
  2. Kun käyttäjä vierittää 5. uutisen ohi, näkymään liitetään uutiset 6–50 (näkymässä yhteensä ensimmäiset 50 uutista, sisältäen samat ensimmäiset 5 kpl).
  3. Kun käyttäjä vierittää 30. uutisen kohdalle, näkymään liitetään uutiset 51–500 (näkymässä yhteensä ensimmäiset 500 uutista, sisältäen samat ensimmäiset 50 kpl).
  4. Selaussession aikana aiemmin nähdyt kortit pysyvät täsmälleen paikoillaan eikä sivu räpsähdä tai hypi.
  5. Uutisvirran lopussa piirretään tagipilvi ja luettujen artikkeleiden tunnisteet kuitataan palvelimelle (`POST /ap/inbox` ja selaimen `seen_list_${uid}`), jolloin seuraavalla kerralla palvelin suodattaa luetut pois (paitsi jos artikkelille on tullut uudempi aikaleima).
* **Uutisvirran toiminta-algoritmi:**
  1. **Ensilataus:** Sivu hakee lukemattomat uutiset (`POST /ap/outbox`, n=500) ja näyttää uutiset 1–5.
  2. **Progressiivinen laajennus:** Skrollattaessa näytetään uutiset 1–50 ja edelleen 1–500 samasta lukemattomien artikkeleiden perusjoukosta.
  3. **Luettujen kuittaus setin lopussa:** Kun setti on selattu, kuitataan kaikki näytetyt artikkelit luetuiksi (`markArticlesAsReadBatch` -> `POST /ap/inbox`), ennen kuin seuraavia uusia uutisia kysytään.
  4. **Artikkelin avaaminen:** Linkin klikkaus avaa uutisen tai sen arkistoversion suoraan uuteen välilehteen ilman asynkronisia viiveitä.

---

### UP-3 · Teeman vaihto ja synkronointi
* **Käyttäjätarina:**
  > **Käyttäjänä** haluan vaihtaa käyttöliittymän tumman ja vaalean teeman välillä milloin tahansa ja säilyttää valintani seuraavilla vierailukerroilla, jotta sivuston lukeminen on miellyttävää eri valaistuksissa.
* **Hyväksymiskriteerit:**
  1. Teemanvaihtopainike vaihtaa heti `data-theme`-attribuutin arvon (`light`/`dark`).
  2. Valittu teema tallentuu pysyvästi eikä sivu välkähdy sivulatauksen yhteydessä.
  3. Kirjautuneen käyttäjän teemavalinta synkronoituu kaikille laitteille.
* **Konkreettinen toteutus koodissa:**
  * [src/theme.js](file:///Users/jaakkokorhonen/uutisseuranta/src/theme.js): Lukee tallennetun teeman heti `<head>`-osiossa ennen renderöintiä.
  * [src/main.js](file:///Users/jaakkokorhonen/uutisseuranta/src/main.js): Navigaation aurinko/kuu-painike kutsuu `updatePrefs({ theme })`.
  * [src/prefs.js](file:///Users/jaakkokorhonen/uutisseuranta/src/prefs.js): Tallentaa teeman välittömästi `localStorage`-muistiin ja Firestoreen.

---

### UP-4 · Kirjautuminen Google-tunnuksella
* **Käyttäjätarina:**
  > **Käyttäjänä** haluan kirjautua palveluun olemassa olevalla Google-tililläni ilman erillistä salasanaa tai rekisteröitymislomaketta, jotta saan personoidut asetukseni ja seuratut aiheet käyttöön vaivattomasti.
* **Hyväksymiskriteerit:**
  1. "Kirjaudu"-painike avaa modaalin, josta voi käynnistää Google-kirjautumisen.
  2. Onnistuneen kirjautumisen jälkeen profiilikuva tulee näkyviin ja asetukset ladataan pilvestä.
  3. Ennen kirjautumista aloitettu kommenttiluonnos palautuu automaattisesti kenttään.
* **Konkreettinen toteutus koodissa:**
  * [src/main.js](file:///Users/jaakkokorhonen/uutisseuranta/src/main.js): Kutsutaan `signInWithPopup(auth, provider)`.
  * `myOnAuthStateChanged` alustaa `initPrefs(app, user.uid)` ja `initProfileModal(user)`.

---

### UP-5 · Uloskirjautuminen
* **Käyttäjätarina:**
  > **Kirjautuneena käyttäjänä** haluan kirjautua ulos tililtäni, jotta voin lopettaa istunnon jaettavalla laitteella turvallisesti.
* **Hyväksymiskriteerit:**
  1. Profiilimodaalissa on selkeä "Kirjaudu ulos" -painike.
  2. Uloskirjautumisen jälkeen tila palaa anonyymiin tilaan ja käyttäjän profiilikuva piilotetaan.
* **Konkreettinen toteutus koodissa:**
  * [src/profile.js](file:///Users/jaakkokorhonen/uutisseuranta/src/profile.js): Kutsuu `signOut(getAuth())`.
  * [src/main.js](file:///Users/jaakkokorhonen/uutisseuranta/src/main.js): Palauttaa `initPrefs(app, null)` ja näyttää "Kirjaudu"-painikkeen.

---

### UP-6 · Lähteiden aktiivisuuden tarkastelu
* **Käyttäjätarina:**
  > **Käyttäjänä** haluan nähdä mitkä suomalaiset mediat julkaisevat aktiivisimmin uutisia, jotta tiedän mistä lähteistä uutisvirta muodostuu.
* **Hyväksymiskriteerit:**
  1. Etusivun widget näyttää aktiivisimmat lähteet ja julkaisumäärät.
  2. Uutissivulla widget päivittyy dynaamisesti kulloinkin valittujen suodatinten mukaisesti.
* **Konkreettinen toteutus koodissa:**
  * [src/main.js](file:///Users/jaakkokorhonen/uutisseuranta/src/main.js): `loadHomepageStats()` lataa globaalit tilastot ja `updateActiveSourcesWidget(articles)` päivittää visualisointipalkit näytettävän uutisjoukon perusteella.

---

### UP-7 · Avoin lähdekoodi ja kehitykseen osallistuminen
* **Käyttäjätarina:**
  > **Kehittäjänä ja avoimen datan harrastajana** haluan löytää linkit projektin lähdekoodiin ja virheilmoituksiin, jotta voin osallistua palvelun kehitykseen tai raportoida havaitsemani bugin.
* **Hyväksymiskriteerit:**
  1. GitHub- ja virheraportointilinkit ovat saavutettavissa hero-osiosta, CTA-lohkosta ja footerista (Päätös L-005).
* **Konkreettinen toteutus koodissa:**
  * [index.html](file:///Users/jaakkokorhonen/uutisseuranta/index.html): Semanttiset linkit GitHub-repositorioon ja issue-seurantaan.

---

### UP-8 · Responsiivinen mobiiliselaus ja PWA-offline-tuki
* **Käyttäjätarina:**
  > **Mobiilikäyttäjänä** haluan asentaa palvelun sovelluksena puhelimeeni ja pystyä lukemaan ladattuja uutisia myös huonon tai katkeilevan verkkoyhteyden aikana.
* **Hyväksymiskriteerit:**
  1. Sivusto skaalautuu mobiilinäytöille ilman vaakavieritystä.
  2. Service Worker tallentaa uutisdatan ja kuvat välimuistiin.
  3. Uuden version julkaisusta ilmoitetaan ei-blokkaavalla toast-viestillä.
* **Konkreettinen toteutus koodissa:**
  * [src/main.js](file:///Users/jaakkokorhonen/uutisseuranta/src/main.js): Workbox Service Worker (`/sw.js`), `NetworkFirst` uutisdatalle, `StaleWhileRevalidate` kuville.
  * [src/style.css](file:///Users/jaakkokorhonen/uutisseuranta/src/style.css): Responsiiviset mediamäärittelyt.

---

### UP-9 · Tagipohjainen uutisvirtanäkymä ja tagipilvi
* **Käyttäjätarina:**
  > **Lukijana** haluan suodattaa uutisia aihetunnisteiden (tagien) mukaan ja lisätä artikkeleille uusia aihetta kuvaavia tageja, jotta löydän minua kiinnostavat teemat nopeasti.
* **Hyväksymiskriteerit:**
  1. Uutiskortin tagia klikkaamalla uutisvirta rajautuu välittömästi kyseiseen tagiin.
  2. 500 uutisen latauduttua sivun alareunaan piirtyy 42 suosituimman tagin tagipilvi.
  3. Käyttäjä voi lisätä uutiselle uuden tagin `+`-painikkeella, jolloin uusi tagi lisätään suoraan kyseisen kortin näkymään ilman uutisvirran uudelleenlatausta (Päätös L-026).
* **Konkreettinen toteutus koodissa:**
  * [src/main.js](file:///Users/jaakkokorhonen/uutisseuranta/src/main.js): `renderTagCloud()`, tagiklikkikuuntelijat, in-place DOM-lisäys ja `POST /ap/inbox` AS2 `Add Hashtag` -pyyntö.

---

### UP-10 · Käyttäjäasetusten hybrid-hallinta
* **Käyttäjätarina:**
  > **Käyttäjänä** haluan, että tekemäni asetukset tallentuvat heti ilman erillistä Tallenna-painiketta ja ovat käytettävissä myös offline-tilassa.
* **Hyväksymiskriteerit:**
  1. Asetusmuutokset tallentuvat välittömästi paikalliseen `localStorage`-muistiin.
  2. Kirjautuneella käyttäjällä muutokset synkronoituvat 500 ms viiveellä Firestoreen.
  3. Firestore `persistentLocalCache` varmistaa offline-kirjoitusten jonoutumisen.
* **Konkreettinen toteutus koodissa:**
  * [src/prefs.js](file:///Users/jaakkokorhonen/uutisseuranta/src/prefs.js): `updatePrefs()`, `_scheduleFirestore()`, `initializeFirestore` `persistentLocalCache`-tuella.

---

### UP-11 · "Uutta seuraamissasi aiheissa" -ilmoitukset
* **Käyttäjätarina:**
  > **Seuraajatahona** haluan nähdä heti sivulle palatessani merkin, jos seuraamissani aiheissa on julkaistu uusia artikkeleita edellisen käyntini jälkeen.
* **Hyväksymiskriteerit:**
  1. Navigaatiopalkin ilmoituskellossa näkyy lukemattomien aiheiden määrä.
  2. Laskuri päivittyy vertaamalla syötteen uusimpia tunnisteita edelliseen käyntiin.
* **Konkreettinen toteutus koodissa:**
  * [src/main.js](file:///Users/jaakkokorhonen/uutisseuranta/src/main.js): `updateNotificationsBadge()` vertaa tagien uusimpia artikkeleita avaimeen `seen_${uid}_${tag}`.

---

### UP-12 · Käyttäjäprofiilimodaali
* **Käyttäjätarina:**
  > **Kirjautuneena käyttäjänä** haluan hallita omaa profiiliani, tarkastella tilitietojani ja poistaa seurattuja tageja yhdestä keskitetystä näkymästä.
* **Hyväksymiskriteerit:**
  1. Avatar-painike avaa saavutettavan dialogin (`role="dialog"`).
  2. Näyttää nimen, sähköpostin, liittymisajan ja listan seuratuista tageista poistonapeilla.
* **Konkreettinen toteutus koodissa:**
  * [src/profile.js](file:///Users/jaakkokorhonen/uutisseuranta/src/profile.js): `initProfileModal()`, `openProfileModal()`, `unfollowTag()`.

---

### UP-15 · Kirjautumisen valinnaisuus ja matala käyttökynnys
* **Käyttäjätarina:**
  > **Uudelta käyttäjältä** haluan päästä kokeilemaan ja käyttämään palvelua täysipainoisesti ilman pakollista rekisteröitymispakkoa tai henkilötietojen luovuttamista.
* **Hyväksymiskriteerit:**
  1. Kaikki uutiset, teemanvaihdot ja suodatukset toimivat anonyymisti.
  2. Kirjautumisikkunassa on selkeä "Jatka ilman kirjautumista" -toiminto.
* **Konkreettinen toteutus koodissa:**
  * [src/main.js](file:///Users/jaakkokorhonen/uutisseuranta/src/main.js), [src/prefs.js](file:///Users/jaakkokorhonen/uutisseuranta/src/prefs.js): Anonyymi tila käyttää `prefs_anonymous`-avainta.

---

### UP-16 · 2-tasoinen kommentointi ja vastausketjut (D-CENT)
* **Käyttäjätarina:**
  > **Keskustelijana** haluan kirjoittaa uutisille kommentteja, vastata muiden viesteihin 2-tasoisessa ketjussa, mainita muita käyttäjiä `@`-merkillä ja ilmaista kantani kommentteihin Samaa mieltä / Eri mieltä -reaktioilla (Päätös L-017).
* **Hyväksymiskriteerit:**
  1. Uutiskortissa on suora pikakommenttikenttä sekä avattava kommenttiosio.
  2. Kommentit tukevat 2-tasoista hierarkiaa (pääkommentti ja vastaus).
  3. Tekstikenttä tarjoaa `@`-autocompleten ketjun keskustelijoille ja `#`-autocompleten tageille.
  4. Kommenteille voi antaa 👍 Samaa mieltä / 👎 Eri mieltä -reaktioita.
* **Konkreettinen toteutus koodissa:**
  * [src/main.js](file:///Users/jaakkokorhonen/uutisseuranta/src/main.js): `fetchReplies()`, `postComment()`, `bindAutocompleteToTextarea()`, `postCommentReaction()`.

---

### UP-17 · Maksumuuritunnistus ja Wayback Machine -arkistolinkki
* **Käyttäjätarina:**
  > **Uutistenlukijana** haluan päästä lukemaan artikkelin toimivaa arkistoversiota suoraan, jos alkuperäinen uutinen on maksumuurin takana, ilman häiritseviä viiveitä tai ponnahdusikkunoiden estoja.
* **Hyväksymiskriteerit:**
  1. Maksumuurilliset artikkelit (`#tilaajille`, `isAccessibleForFree: false`) ohjaavat automaattisesti toimivaan Wayback Machine -arkistolinkkiin (`targetUrl = (isPaywalled && archiveUrl) ? archiveUrl : originalUrl`).
  2. Artikkelilinkit toimivat selaimen natiiveina linkkeinä välittömästi ilman asynkronista klikinsieppausta (Päätökset L-019 ja L-022).
* **Konkreettinen toteutus koodissa:**
  * [src/main.js](file:///Users/jaakkokorhonen/uutisseuranta/src/main.js): Linkin kohdeosoite määritetään korttia luotaessa. Jos artikkeli on tilaajasisältöä ja sille on arkistolinkki, `href` osoittaa suoraan `url_archive`-osoitteeseen.

---

### UP-18 · GDPR-tietojen vienti (JSON) ja tilin poisto (Right to Erasure)
* **Käyttäjätarina:**
  > **Tietosuojastaan huolehtivana käyttäjänä** haluan ladata kaikki minusta tallennetut tiedot koneluettavana JSON-tiedostona tai poistaa tilini ja kaikki tietoni pysyvästi yhdellä toiminnolla.
* **Hyväksymiskriteerit:**
  1. Profiilista voi ladata `uutisseuranta-asetukset-YYYY-MM-DD.json` -tiedoston.
  2. "Poista tili" poistaa Firestore-dokumentin, Firebase Auth -tilin ja kaikki selaimen paikalliset tiedot.
  3. Mikäli kirjautumissessio on vanhentunut, käyttäjältä pyydetään automaattinen uudelleentunnistautuminen.
* **Konkreettinen toteutus koodissa:**
  * [src/prefs.js](file:///Users/jaakkokorhonen/uutisseuranta/src/prefs.js): `exportPrefsAsJson()`.
  * [src/profile.js](file:///Users/jaakkokorhonen/uutisseuranta/src/profile.js): `deleteUserPrefs()`, `deleteUser()`, `reauthenticateWithPopup()`.

---

## Suunnitellut käyttäjätarinat (tulevat laajennukset)

### UP-13 · Artikkelin kontekstuaalinen vertailu ("Sama aihe muualla")
* **Käyttäjätarina:**
  > **Kriittisenä medianseuraajana** haluan nähdä uutisen yhteydessä miten muut kotimaiset mediat uutisoivat samasta aiheesta, jotta saan monipuolisemman kokonaiskuvan aiheesta.
* **Hyväksymiskriteerit:**
  1. Artikkelin avauksessa näytetään 2-5 vaihtoehtoista uutista muista lähteistä.
  2. Vertailu lasketaan kevyesti asiakaspuolella Jaccard-samankaltaisuudella ladatuista uutisista.

---

### UP-14 · Vapaatekstihaku ja URL-hash-tila
* **Käyttäjätarina:**
  > **Tiedonhakijana** haluan hakea uutisvirrasta artikkeleita vapaalla sanahaulla ja jakaa hakutuloksen suoralla linkillä ystävilleni.
* **Hyväksymiskriteerit:**
  1. Hakukenttä suodattaa uutisotsikoita, tiivistelmiä ja tageja reaaliaikaisesti.
  2. Hakusana tallentuu URL-osoitteen hashiin (`#haku=termi`).
