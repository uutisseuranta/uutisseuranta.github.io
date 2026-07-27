# Ehdotetut testaus- ja laadunvarmistusissuet (Päivitetty 2026-07-28)

Tämä dokumentti sisältää analyysin, käyttötapaukset, teknologiavalinnat ja toteutussuunnitelmat uutisseurannan **kaikille 37 avoimelle tiketille**, ryhmiteltynä loogisiin kokonaisuuksiin.

---

## 1. SUOSITELTAVAT PIKAISET SULJEMISET (Jo toteutetut tai perutut)

Nämä tiketit ovat jo valmiita (toteutettu PR-paketeissa tai päätöksissä) ja ne suositellaan suljettaviksi välittömästi:

### Issue #57: infra: CI/CD-pipeline — automaattinen deploy GitHub Pagesille
*   **Tila:** Suljettava (Jo toteutettu).
*   **Perustelu:** Automaattinen deploy-pipeline GitHub Actionsin kautta (`.github/workflows/deploy.yml`) on täysin pystyssä ja toiminnassa.

### Issue #23: arch: persistointiarkkitehtuuri — localStorage vs Firestore offline vs SW cache
*   **Tila:** Suljettava (Päätös tehty).
*   **Perustelu:** Valinta localStorage-pohjaisesta persistoinnista on tehty ja kirjattu päätöslokiin (`L-008`).

### Issue #51: feat: käyttäjäkohtainen uutisvirran personointi (Firestore-preferenssit)
*   **Tila:** Suljettava / Päivitettävä (Korvautunut localStoragella).
*   **Perustelu:** Pysyvä Firestore-pohjainen personointi korvataan localStorage-personoinnilla (`prefs_[uid]`) tietojen minimoinnin ja palvelinkulujen säästämisen vuoksi (päätös `L-008`).

---

## 2. UX1-RYHMÄ (Kriittiset käyttökokemustiketit)

Nämä tiketit on päivitetty suoraan GitHub-tietokantaan.

### Issue #20: feat: näytä Like/Dislike-äänet Agree/Disagree-näyttönimillä ja summaa laskurit
*   **Käyttötapaukset:** Kirjautunut käyttäjä antaa "Samaa mieltä" / "Eri mieltä" reaktion. **Laskureita ei näytetä ennen kuin käyttäjä on äänestänyt** bandwagon-ilmiön ehkäisemiseksi (Muchnik et al. 2013).
*   **Teknologiavalinnat:** AS2 `Like` ja `Dislike` tyypit. `aria-pressed="true"/"false"` esteettömyyteen.
*   **Toteutustapa:** Optimistinen UI rollbackilla. Palvelinpuolen idempotenssitarkistukset.
*   **Toteutettavuus:** Valmis. Vaatii backendin `gcs-activitystreams#33` ja `patterns#42` reaktiotyylit.

### Issue #15: UI: #tägi kommentissa periytyy artikkelille
*   **Käyttötapaukset:** Käyttäjän kommenttikenttään kirjoittama `#kaupunkisuunnittelu` periytyy kommentin lisäksi ylätason uutisartikkelille.
*   **Teknologiavalinnat:** Tribute.js tai `@github/combobox-nav`. AS2 `Hashtag` -tyyppi.
*   **Toteutustapa:** Idempotentti `Add`-aktiviteetti artikkelille. Päivitetään artikkelin `updated`-aikaleima.
*   **Toteutettavuus:** Valmis.

### Issue #14: UI: @mention kommenttikentässä
*   **Käyttötapaukset:** Käyttäjä kirjoittaa `@matti`. Rekisteröitynyt käyttäjä saa in-app-ilmoituksen; anonyymi sähköpostikutsun (`mailto:`). Linkkirakenne: `/artikkeli/{id}?ref=mention#kommentti-{id}`.
*   **Teknologiavalinnat:** `@github/combobox-nav` tai `tributejs`-fork. AS2 `Mention` -tyyppi.
*   **Toteutustapa & GDPR:** GDPR-selvitys `mailto:`-osoitteiden tallennuksesta. In-app notifikaatioiden backlog-toteutus backendissä.
*   **Toteutettavuus:** Keskivaikea (vaatii uusia backend-tikettejä).

### Issue #13: UI: käyttäjä voi lisätä tägin artikkeliin
*   **Käyttötapaukset:** Käyttäjä lisää tagin suoraan uutiskortista.
*   **Teknologiavalinnat:** AS2 `Add`-aktiviteetti.
*   **Toteutustapa:** Kirjoitetaan sosiaalisen datan kantaan, josta kopioidaan avoimeen kantaan.
*   **Toteutettavuus:** Valmis.

### Issue #8: arch: kirjautuminen ja anonyymiyskäytännot (UP-15)
*   **Käyttötapaukset:** Lukeminen ja suodattaminen aina ilmaista. Pysyvässä tallennuksessa / äänestyksessä näytetään Google-kirjautumismodal hyötyineen.
*   **Teknologiavalinnat:** Firebase Auth `GoogleAuthProvider`, `prefs_[uid]` localStoragessa.
*   **Toteutettavuus:** Valmis.

### Issue #4: feat: "Uutta seuraamissasi aiheissa" (UP-11)
*   **Käyttötapaukset:** Kellokuvakkeessa unread-badge, joka heijastaa uusia artikkeleita `seen_<tag>`-tilaan localStoragessa verrattuna.
*   **Teknologiavalinnat:** Puhdas client-side localStorage.
*   **Toteutettavuus:** Valmis.

### Issue #1: feat: lähteiden aktiivisuuswidget (UP-6)
*   **Käyttötapaukset:** Dynaaminen palkkivisualisointi 8 aktiivisimmalle lähteelle. Widget heijastaa reaaliajassa tagisuodattimia.
*   **Teknologiavalinnat:** Client-side laskenta `OrderedCollection`-datasta.
*   **Toteutettavuus:** Valmis.

---

## 3. UX2-RYHMÄ (Käyttökokemuksen laajennukset)

### Issue #2: feat: henkilökohtainen uutisvirtanäkymä — tagipohjainen suodatus (UP-9)
*   **Käyttötapaukset:** Käyttäjä näkee uutisvirrassa vain ne uutiset, jotka sisältävät hänen seuraamiaan tageja.
*   **Teknologiavalinnat:** LocalStorage-suodatus client-sidellä.
*   **Toteutustapa:** Suodatetaan `orderedItems`-lista `prefs_[uid].tags`-taulukon perusteella.
*   **Toteutettavuus:** Helppo (tehty täysin client-sidellä).

### Issue #21: feat: käyttäjäprofiilin Agree/Disagree-jakaumagrafiikka (Like/Dislike-historia)
*   **Käyttötapaukset:** Käyttäjä näkee profiilisivullaan visualisoinnin (esim. piirakkakaavio) omasta reaktiohistoriastaan.
*   **Teknologiavalinnat:** Canvas tai SVG-pohjainen kevyt kuvaaja (esim. Chart.js tai kevyt oma SVG-toteutus).
*   **Toteutustapa:** Luetaan reaktiodata localStoragen tai Firebase Authin lokista.
*   **Toteutettavuus:** Valmis.

### Issue #19: feat: PWA Service Worker (Workbox + vite-plugin-pwa) — offline-tuki
*   **Käyttötapaukset:** Uutisseuranta toimii offline-tilassa. Käyttäjä näkee aiemmin ladatut uutiset verkkoyhteyden katketessa.
*   **Teknologiavalinnat:** `vite-plugin-pwa` ja Workbox.
*   **Toteutustapa:** Konfiguroidaan Service Worker välimuistuttamaan staattiset assetit (`index.html`, `js`, `css`) sekä viimeisin `/ap/outbox`-API-vastaus.
*   **Toteutettavuus:** Keskivaikea (vaatii testausta ja huolellista invalidointia).

---

## 4. LAADUNVARMISTUS JA INFRATIKETIT

### Issue #81: qa: Laajenna Playwright-testikattavuutta (a11y, visuaalinen regressio, mock)
*   **Käyttötapa:** Automaattiset visual regression testit `toHaveScreenshot()`-metodilla ja a11y-auditointi `@axe-core/playwright`-kirjastolla.
*   **Toteutustapa:** Katso tarkka suunnitelma [ proposed-issues.md Issue 2:sta](#issue-2-qa-laajenna-playwright-testikattavuutta-a11y-visuaalinen-regressio-ja-mock-integraatio-github-issue-81).

### Issue #62: production: Vite-pakkaajan käyttöönotto (#17)
*   **Toteutustapa:** Vite on jo otettu käyttöön repositoriossa. Tämä issue pidetään auki ainoastaan PWA-integraation (#19) ja tuotantobuildin hienosäädön ajan, jonka jälkeen se suljetaan.

### Issue #61: a11y: WCAG AA -saavutettavuusauditointi
*   **Toteutustapa:** Suoritetaan osana Issue #81 a11y-testitiedostoja. Auditointiraportit ajetaan CI:ssä ja tulokset korjataan.

### Issue #60: sec: rate limiting — /ap/outbox-endpointin väärinkäytön esto
*   **Toteutustapa:** Backend-tason suojatoimenpide, joka toteutetaan Cloud Runissa tai BigQuery-rajapinnassa API Gatewayn avulla.

### Issue #59: qa: alpha smoke test — tarkistuslista ennen julkaisua
*   **Toteutustapa:** Manuaalinen ja automaattinen tarkistuslista, joka ajetaan ennen lopullista tuotantojulkaisua.

### Issue #58: qa: error boundary ja fallback-tilat — verkkovirhe, API timeout, tyhjä vastaus
*   **Toteutustapa:** Luodaan yleiset virherajat (Error Boundary) käyttöliittymään, jotka näyttävät ystävällisen "Hups, jotain meni pieleen" -viestin ja rollback-mahdollisuuden API-virheissä.

### Issue #53: bug: teematoggle rikki — vaalea/tumma teema ei pysy
*   **Toteutustapa:** Korjataan localStorage-regressio teemanvaihdossa (toteutetaan Issue 5 / UP-10 yhteydessä).

### Issue #52: sec: CSP-otsakepolitiikka
*   **Toteutustapa:** Määritellään Content Security Policy (CSP) otsakkeet `github.tf` / Pages-määrityksiin tai HTML-metaotsakkeisiin sallimaan ainoastaan Firebase Auth ja BigQuery-yhteydet.

---

## 5. GDPR & TIETOSUOJA

### Issue #50: Tilinhallinta: Re-autentikointiflow tilin poiston yhteydessä
*   **Käyttötapaukset:** GDPR:n mukaisen tilinpoiston yhteydessä Firebase Auth vaatii re-autentikoinnin (uudelleenkirjautumisen), jos edellisestä kirjautumisesta on kulunut pitkä aika.
*   **Toteutustapa:** Avataan Firebase Auth `reauthenticateWithCredential`-modal ennen tilin lopullista poistoa.

### Issue #49: Tilinhallinta: poistetun käyttäjän Firestore-preferenssidatan siivous (GDPR)
*   **Toteutustapa:** Koska personointidata tallennetaan nyt ainoastaan `localStorage`-välimuistiin eikä Firestoreen, tämä issue on **superseded/obsolete** ja suositellaan suljettavaksi, sillä Firestoreen ei jää siivottavaa dataa.
