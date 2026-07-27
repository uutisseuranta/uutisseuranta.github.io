# Ehdotetut testaus- ja laadunvarmistusissuet (Päivitetty 2026-07-28)

Tämä dokumentti sisältää analyysin, käyttötapaukset, teknologiavalinnat ja toteutussuunnitelmat uutisseurannan **kaikille avoimille ja äskettäin suljetuille/päivitetyille tiketille**, ryhmiteltynä loogisiin kokonaisuuksiin.

---

## 1. ÄSKETTÄIN SULJETUT TIKETIT (Peruttu, toteutettu tai korvattu)

Seuraavat tiketit on suljettu tai todettu tarpeettomiksi kehittäjäkommenttien ja arkkitehtuurilinjausten perusteella:

### Issue #7: feat: hakutoiminto — client-side suodatus URL-hashilla (UP-14)
*   **Tila:** Peruttu / Ei toteuteta (Suljettu).
*   **Perustelu:** Client-side-pohjaista tekstihakua ei toteuteta. Haku ja uutissuodatus korvautuvat kokonaan dynaamisella tag-pohjaisella haulla, jossa uusia artikkeleita pyydetään suoraan palvelimelta (päätös `L-011`).

### Issue #6: feat: artikkelin kontekstuaalinen vertailu — Jaccard-samankaltaisuus client-side (UP-13)
*   **Tila:** Peruttu / Ei toteuteta (Suljettu).
*   **Perustelu:** Client-side Jaccard-laskentaa ja erillistä "Sama aihe muualla" -osioita ei tarvita erillisenä, sillä samankaltaiset artikkelit ryhmittyvät ja ilmestyvät suoraan uutisvirtaan.

### Issue #57: infra: CI/CD-pipeline — automaattinen deploy GitHub Pagesille
*   **Tila:** Suljettu (Toteutettu).
*   **Perustelu:** Automaattinen deploy-pipeline GitHub Actionsin kautta (`.github/workflows/deploy.yml`) on valmis.

### Issue #23: arch: persistointiarkkitehtuuri — localStorage vs Firestore offline vs SW cache
*   **Tila:** Suljettu (Päätetty).
*   **Perustelu:** localStorage valittu ensisijaiseksi persistointimenetelmäksi (`L-008`).

### Issue #51: feat: käyttäjäkohtainen uutisvirran personointi (Firestore-preferenssit)
*   **Tila:** Suljettu (Korvattu localStoragella).
*   **Perustelu:** Korvattu localStorage-personoinnilla (`prefs_[uid]`) tietosuojan ja palvelinkustannusten minimoimiseksi.

### Issue #49: Tilinhallinta: poistetun käyttäjän Firestore-preferenssidatan siivous (GDPR)
*   **Tila:** Suljettu (Obsolete).
*   **Perustelu:** Koska preferenssejä ei tallenneta Firestoreen, siivoustarvetta ei ole.

---

## 2. UX1-RYHMÄ (Kriittiset käyttökokemustiketit)

### Issue #20: feat: näytä Like/Dislike-äänet Agree/Disagree-näyttönimillä ja summaa laskurit
*   **Käyttötapaukset (Use Cases):**
    - **UC-20.1 (Reaktiot):** Kirjautunut käyttäjä antaa "Samaa mieltä" tai "Eri mieltä" reaktion. Järjestelmä tallentaa `Like` tai `Dislike` -aktiviteetin.
    - **UC-20.2 (Bandwagon-esto):** Laskureita **ei näytetä ollenkaan ennen kuin käyttäjä on äänestänyt** kyseistä uutista sosiaalisen paineen ehkäisemiseksi.
*   **Teknologiavalinnat:** AS2 `Like` ja `Dislike` -tyypit. `aria-pressed="true"/"false"` esteettömyyteen.
*   **Toteutustavat & Idempotenssi:** Optimistinen UI rollback-tuella (mukaan lukien `aria-pressed` -rollback). Palvelimen on varmistettava idempotenssi, ettei sama käyttäjä voi antaa useita ääniä.
*   **Toteutettavuus:** Valmis. Vaatii backendiltä `gcs-activitystreams#33` ja `patterns#42` reaktiotyylit.

### Issue #15: UI: #tägi kommentissa periytyy artikkelille
*   **Käyttötapaukset (Use Cases):**
    - **UC-15.1 (Periytyminen):** Käyttäjän kommenttikenttään kirjoittama `#kaupunkisuunnittelu` liitetään sekä kommenttiin että sen ylätason uutisartikkelille.
*   **Teknologiavalinnat:** Tribute.js tai `@github/combobox-nav`. AS2 `Hashtag` -tyyppi.
*   **Toteutustavat & Idempotenssi:** Estetään duplikaatit ylätason uutisessa (idempotentti `Add`). Päivitetään artikkelin `updated`-aikaleima.
*   **Toteutettavuus:** Valmis.

### Issue #14: UI: @mention kommenttikentässä
*   **Käyttötapaukset (Use Cases):**
    - **UC-14.1 (Maininta):** Käyttäjä kirjoittaa `@matti`. Rekisteröitynyt käyttäjä saa in-app-ilmoituksen; anonyymi sähköpostikutsun (`mailto:`). Linkkirakenne: `/artikkeli/{id}?ref=mention#kommentti-{id}`.
*   **Teknologiavalinnat:** `@github/combobox-nav` tai `tributejs`-fork. AS2 `Mention` -tyyppi.
*   **Toteutustapa & GDPR:** GDPR-selvitys `mailto:`-osoitteiden tallennuksesta tietosuojaselosteeseen. In-app notifikaatioiden backlog-toteutus backendissä.
*   **Toteutettavuus:** Keskivaikea (vaatii backendiltä notifikaatiotukea).

### Issue #13: UI: käyttäjä voi lisätä tägin artikkeliin
*   **Käyttötapaukset (Use Cases):**
    - **UC-13.1 (Tagilisäys):** Käyttäjä lisää tagin suoraan uutiskortista "+ Lisää tagi" -painikkeella, mikä lisää hänet tagin seuraajaksi.
*   **Teknologiavalinnat:** AS2 `Add`-aktiviteetti.
*   **Toteutustapa:** Kirjoitetaan sosiaalisen datan kantaan, josta kopioidaan avoimeen kantaan.
*   **Toteutettavuus:** Valmis.

### Issue #8: arch: kirjautuminen ja anonyymiyskäytännot (UP-15)
*   **Käyttötapaukset (Use Cases):**
    - **UC-8.1 (Anonyymiys):** Lukeminen aina vapaata. Pysyvässä tallennuksessa / reaktiossa näytetään Google-kirjautumismodal hyötyineen.
*   **Teknologiavalinnat:** Firebase Auth `GoogleAuthProvider`, `prefs_[uid]` localStoragessa.
*   **Toteutettavuus:** Valmis.

### Issue #4: feat: "Uutta seuraamissasi aiheissa" (UP-11)
*   **Käyttötapaukset (Use Cases):**
    - **UC-4.1 (Uutuusbadge):** Kellokuvakkeessa unread-badge, joka heijastaa uusia artikkeleita `seen_<tag>`-tilaan localStoragessa verrattuna.
*   **Teknologiavalinnat:** Puhdas client-side localStorage.
*   **Toteutettavuus:** Valmis.

### Issue #1: feat: lähteiden aktiivisuuswidget (UP-6)
*   **Käyttötapaukset (Use Cases):**
    - **UC-1.1 (Aktiivisuus):** Dynaaminen palkkivisualisointi 8 aktiivisimmalle lähteelle. Widget heijastaa reaaliajassa tagisuodattimia.
*   **Teknologiavalinnat:** Client-side laskenta `OrderedCollection`-datasta.
*   **Toteutettavuus:** Valmis.

---

## 3. UX2-RYHMÄ (Käyttökokemuksen laajennukset)

### Issue #2: feat: henkilökohtainen uutisvirtanäkymä — tagipohjainen suodatus (UP-9)
*   **Käyttötapaukset (Use Cases):**
    - **UC-2.1 (Tagisuodatus):** Käyttäjä klikkaa tagia uutiskortissa, jolloin uutisvirta suodattuu näyttämään vain kyseisen aiheen uutiset.
*   **Teknologiavalinnat:** LocalStorage-suodatus client-sidellä OR-logiikalla.
*   **Toteutustapa:** Suodatetaan `orderedItems`-lista `prefs_[uid].tags`-taulukon perusteella.
*   **Toteutettavuus:** Helppo.

### Issue #21: feat: käyttäjäprofiilin Agree/Disagree-jakaumagrafiikka (Like/Dislike-historia)
*   **Käyttötapaukset (Use Cases):**
    - **UC-21.1 (Reaktiohistoria):** Käyttäjä näkee profiilisivullaan visualisoinnin (esim. jakaumapalkki) omasta reaktiohistoriastaan.
*   **Teknologiavalinnat:** Canvas tai SVG-pohjainen visualisointi.
*   **Esteettömyys (WCAG 2.2 SC 1.4.11):** Teal (`--c-teal`) ja maroon (`--c-maroon`) kontrastisuhde tarkistettava vähintään 3:1 suhteeseen taustaan nähden. `role="img"` + dynaaminen `aria-label` ruudunlukijoille.
*   **Toteutustapa:** Luetaan reaktiodata localStoragesta ja piirretään SVG-palkki.
*   **Toteutettavuus:** Valmis.

### Issue #19: feat: PWA Service Worker (Workbox + vite-plugin-pwa) — offline-tuki
*   **Käyttötapaukset (Use Cases):**
    - **UC-19.1 (Offline-käyttö):** Uutisseuranta toimii offline-tilassa. Käyttäjä näkee aiemmin ladatut uutiset verkkoyhteyden katketessa.
*   **Teknologiavalinnat:** `vite-plugin-pwa` ja Workbox. Network First `/ap/outbox` -syötteelle, Cache First staattisille asseteille, Stale-While-Revalidate kuville.
*   **Toteutustapa & Cache-päivitys:** Käytetään `skipWaiting()` ja `clients.claim()` -kutsuja välittömään SW-päivitykseen, jottei käyttäjä näe vanhentunutta koodiversiota news-sovelluksessa.
*   **Toteutettavuus:** Keskivaikea.

---

## 4. LAADUNVARMISTUS JA INFRATIKETIT

### Issue #24: feat: näytä arkistolinkki kun artikkelin alkuperäinen URL ei vastaa (Wayback Machine)
*   **Käyttötapaukset (Use Cases):**
    - **UC-24.1 (Wayback Linkki):** Uutiskortissa näytetään "Lue arkistosta" -painike, jos uutisen alkuperäinen URL ei vastaa tai on rikki.
*   **Teknologiavalinnat & Suorituskyky:** Passiivinen linkki (näytetään aina kun `url_archive`-kenttä on asetettu AS2-objektissa). Hylätään aktiiviset HEAD-pyynnöt selaimesta suorituskykyriskin (CORS-ongelmat, 50 rinnakkaista pyyntöä) vuoksi.
*   **Toteutustapa:** Riippuu backend-toteutuksesta `gcs-activitystreams#26`, joka tallentaa arkistolinkin suoraan AS2-objektiin.
*   **Toteutettavuus:** Valmis (odotettaessa backendia).

### Issue #81: qa: Laajenna Playwright-testikattavuutta (a11y, visuaalinen regressio, mock)
*   **Toteutustapa:** Playwright E2E visual regression ja a11y-auditointi.

### Issue #62: production: Vite-pakkaajan käyttöönotto (#17)
*   **Toteutustapa:** Vite on jo käytössä. Issue pidetään auki PWA-integraation (#19) viimeistelyyn asti.

### Issue #61: a11y: WCAG AA -saavutettavuusauditointi
*   **Toteutustapa:** WCAG-auditoinnit ajetaan automaattisesti CI:ssä osana Issue #81:n testejä.

### Issue #60: sec: rate limiting — /ap/outbox-endpointin väärinkäytön esto
*   **Toteutustapa:** Backend-tason suojatoimenpide BigQuery-rajapinnassa API Gatewaylla.

### Issue #59: qa: alpha smoke test — tarkistuslista ennen julkaisua
*   **Toteutustapa:** Manuaalinen ja automaattinen tarkistuslista ennen tuotantojulkaisua.

### Issue #58: qa: error boundary ja fallback-tilat — verkkovirhe, API timeout, tyhjä vastaus
*   **Toteutustapa:** Luodaan Error Boundary -yleisvirherajat käyttöliittymään.

### Issue #53: bug: teematoggle rikki — vaalea/tumma teema ei pysy
*   **Toteutustapa:** Korjataan localStorage-regressio (toteutetaan Issue 5 / UP-10 yhteydessä).

### Issue #52: sec: CSP-otsakepolitiikka
*   **Toteutustapa:** CSP-otsakkeet `github.tf` Pages-määrityksiin tai HTML-metaotsakkeisiin.

### Issue #50: Tilinhallinta: Re-autentikointiflow tilin poiston yhteydessä
*   **Toteutustapa:** `reauthenticateWithCredential`-modal ennen tilin lopullista poistoa Firebase Authissa.
