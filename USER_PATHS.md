# Uutisseuranta – Käyttäjäpolut ja käyttötapaukset

Tämä dokumentti kuvaa uutisseuranta.net-sivuston käyttäjäpolut ja käyttötapaukset. Se kattaa sekä nykyisin toteutetut perustoiminnot (UP-1–8) että tulevat ehdotetut laajennukset (UP-9–15).

Dokumentti pohjautuu `index.html`-toteutukseen, `TECHNICAL_DESIGN.md`-linjauksiin ja kuviointikirjaston suunnittelumalleihin ([d-cent.github.io/patterns](https://d-cent.github.io/patterns/)).

---

## Käyttäjäprofiilit

Sivustolla on kaksi käyttäjäroolia:

| Rooli | Kuvaus | Autentikointi |
|---|---|---|
| **Anonyymi käyttäjä** | Vierailee sivustolla ilman kirjautumista | Ei vaadi |
| **Kirjautunut käyttäjä** | Tunnistautunut Google-tunnuksella | Firebase Auth / Google Sign-In |

---

## Nykyiset käyttäjäpolut (UP-1 – UP-8)

### UP-1 · Ensivierailu (anonyymi)

**Lähtötilanne:** Käyttäjä saapuu sivustolle ensimmäistä kertaa suoraan URL:n tai haun kautta.

```
Saapuu uutisseuranta.net
  └─ Näkee hero-osion
       ├─ Lukee arvolupauksen ("Seuraa uutisia älykkäästi")
       ├─ Näkee tilastot: 150+ lähdettä, 10k+ artikkelia/pv, reaaliajassa
       ├─ [CTA] "Aloita seuranta" → vie GitHubiin (ulkoinen linkki)
       └─ [CTA] "Katso esimerkkejä" → ankkuroi #uutiset-osioon
```

**Lopputulos:** Käyttäjä ymmärtää palvelun tarkoituksen ja voi jatkaa tutustumaan sivuston sisältöön.

---

### UP-2 · Uutisvirran selaaminen (anonyymi tai kirjautunut)

**Lähtötilanne:** Käyttäjä haluaa selata päivän uutisia.

```
Klikkaa navigaation "Uutiset" tai "Katso esimerkkejä" -linkkiä
  └─ Scrollaa #uutiset-osioon
       ├─ Näkee pääuutisen (feed-item--lead, 2-sarake-leveys)
       │    ├─ Kuva, kategoriamerkki (esim. Politiikka)
       │    ├─ Otsikko ja kappale
       │    └─ Lähde + aikaleima
       └─ Näkee 2 sivuuutista (feed-item--small)
            ├─ Teknologia-artikkeli
            └─ Talous-artikkeli
```

**Kategoriat:** Politiikka (punainen), Teknologia (sininen), Talous (vihreä).

**Lopputulos:** Käyttäjä saa yleiskuvan päivän uutisista ja voi klikata artikkelia lukeakseen alkuperäisen jutun ulkoisessa lähteessä.

---

### UP-3 · Teeman vaihto (anonyymi tai kirjautunut)

**Lähtötilanne:** Käyttäjä haluaa vaihtaa vaalean ja tumman teeman välillä.

```
Klikkaa navigaation aurinko/kuu-ikonipainike (btn-theme)
  └─ JavaScript vaihtaa data-theme-attribuuttia dokumentin juuressa
       ├─ "light" → CSS-muuttujat vaaleat sävyt
       └─ "dark"  → CSS-muuttujat tummat sävyt
```

**Huomio:** Teema-asetus ei tallennu istuntojen välillä ilman kirjautumista tai asetusten tallennusta — sivulatauksen jälkeen tunnistetaan `prefers-color-scheme` selaimen asetuksesta (ks. UP-10 laajempia asetuksia varten).

---

### UP-4 · Kirjautuminen Google-tunnuksella

**Lähtötilanne:** Anonyymi käyttäjä haluaa kirjautua sisään.

```
Klikkaa "Kirjaudu"-painiketta navigaatiossa (btn-login)
  └─ Firebase Auth käynnistää signInWithPopup(GoogleAuthProvider)
       ├─ [Onnistuu] → Google-kirjautumispopup aukeaa
       │    └─ Käyttäjä valitsee Google-tilin
       │         └─ onAuthStateChanged laukeaa, user ≠ null
       │              ├─ "Kirjaudu"-painike piilotetaan
       │              ├─ Avatarkuva (Google-profiili) näytetään
       │              └─ "Ulos"-painike tulee näkyviin
       └─ [Epäonnistuu: auth/unauthorized-domain]
            └─ Alert: "Tämä verkkotunnus ei ole sallittu..."
```

**Hyväksytyt domainit (Firebase Authorized Domains):**
- `uutisseuranta.net`
- `jaakkokorhonen.github.io`

---

### UP-5 · Uloskirjautuminen

**Lähtötilanne:** Kirjautunut käyttäjä haluaa kirjautua ulos.

```
Klikkaa avatarin vieressä olevaa "Ulos"-painiketta (btn-logout)
  └─ signOut(auth) kutsutaan
       └─ onAuthStateChanged laukeaa, user = null
            ├─ Avatarkuva piilotetaan
            └─ "Kirjaudu"-painike palaa näkyviin
```

---

### UP-6 · Lähteiden aktiivisuuden tarkastelu

**Lähtötilanne:** Käyttäjä haluaa nähdä, mitkä lähteet julkaisevat eniten.

```
Scrollaa #ominaisuudet-osioon
  └─ Näkee features-visual -widgetin "Aktiivisimmat lähteet tänään"
       ├─ Yle Uutiset        → 312 artikkelia (88% palkki)
       ├─ Helsingin Sanomat  → 255 artikkelia (72%)
       ├─ Kauppalehti        → 204 artikkelia (58%)
       ├─ MTV Uutiset        → 161 artikkelia (45%)
       ├─ Iltalehti          → 136 artikkelia (38%)
       └─ Taloussanomat      →  99 artikkelia (28%)
```

**Huomio:** Tämä on tällä hetkellä staattinen esittelykomponentti (`aria-hidden="true"`). Reaaliaikainen data integroidaan myöhemmin.

---

### UP-7 · Avoin lähdekoodi – osallistuminen

**Lähtötilanne:** Kehittäjä tai muu kiinnostunut haluaa osallistua projektin kehitykseen.

```
Klikkaa CTA-osion "Katso GitHubissa" -painiketta
     tai navigaation "GitHub"-painiketta
     tai footerin "GitHub"- tai "Ilmoita virhe" -linkkejä
  └─ Uusi välilehti: github.com/jaakkokorhonen/uutisseuranta
       ├─ Voi forkata repositorion
       ├─ Voi avata issuen (ominaisuuspyyntö tai bugi)
       └─ Voi tehdä pull requestin
```

---

### UP-8 · Mobiiliselaus

**Lähtötilanne:** Käyttäjä avaa sivuston mobiililaitteella (leveys ≤ 768px).

```
Mobiiliselain lataa sivuston
  └─ Responsiiviset mediakyselyt aktivoituvat
       ├─ Navigaation linkit (.nav__links) piilotetaan
       ├─ feed-grid muuttuu yksisarakkeiseksi
       ├─ features-visual -widget piilotetaan
       └─ hero__heading skaalautuu pienemmäksi (clamp)
```

**Toimivat ominaisuudet mobiilissa:** logo, teeman vaihto, kirjautumispainike, hero-teksti, uutisvirtakortit, CTA-osio, footer.

---

## Tulevat käyttötapaukset ja laajennukset (UP-9 – UP-15)

Nämä käyttötapaukset perustuvat kuviointikirjaston vuorovaikutusmalleihin (streams, notifications-list, profile, settings, discussion, argumenting, registration) ja niiden avulla toteutetaan uutisseuranta.netin puuttuvat toiminnallisuudet.

**Arkkitehtuuriperiaate:** `TECHNICAL_DESIGN.md` rajaa Firebase-käytön vain Authenticationiin ja Analyticsiin. Kaikki persistointi, joka edellyttäisi Firestorea tai muuta Firebase-palvelua, vaatii eksplisiittisen arkkitehtuuripäätöksen ennen pilvisynkronoinnin toteuttamista.

---

### UP-9 · Henkilökohtainen uutisvirtanäkymä

**kuviointikirjastomalli:** `streams` (suodatettu sisältövirta)

**Kuvaus:** Käyttäjä haluaa seurata vain tiettyjä aiheita. Aiheet valitaan klikkaamalla uutiskorteissa näkyviä tageja (ei erillisellä aihevalintasivulla tai -osiolla).

```
Käyttäjä näkee uutiskortissa tagin (esim. "Teknologia", "Politiikka")
  └─ Klikkaa tagia
       ├─ [Anonyymi] Tag lisätään istuntokohtaiseen suodatinlistaan (JS-muistissa)
       │    └─ Uutisvirtaan jää vain valitun tagin artikkelit
       │         └─ Tagipallo syttyy aktiiviseksi navigaatiopalkissa
       └─ [Kirjautunut] Sama + tag tallennetaan localStorage:iin UID:lla avainparina
            └─ Seuraavan sivulatauksen yhteydessä tagi palautetaan automaattisesti
```

**Tekniset valinnat (ei Firestorea aluksi):**
- Istuntokohtainen tila: JS-objekti muistissa (`selectedTags = new Set()`)
- Kirjautuneelle persistointi: `localStorage.setItem('prefs_' + uid, JSON.stringify([...selectedTags]))`
- Lukeminen: `onAuthStateChanged` → `localStorage.getItem('prefs_' + uid)` → suodatin käyttöön
- localStorage on tuettava arkkitehtuuripäätös (ei Firestore); sisältö on vain käyttöliittymäpreferenssi, ei sensitiivistä dataa

**Hyväksymiskriteerit:**
- Tagiklikki suodattaa virran välittömästi ilman sivulatausta (client-side filter)
- Anonyymi käyttäjä menettää valinnat istunnon päättyessä
- Kirjautunut käyttäjä näkee samat valinnat seuraavalla vierailulla (localStorage)
- Useampi tagi on valittavissa samanaikaisesti (OR-logiikka)
- "Nollaa suodattimet" -linkki palauttaa oletusvirran

---

### UP-10 · Käyttäjäasetusten hallinta

**kuviointikirjastomalli:** `settings` (käyttäjän preferenssinäkymä)

**Kuvaus:** Kirjautunut käyttäjä haluaa hallita seurattavia tageja ja teema-asetusta pysyvästi.

> ⚠️ **Arkkitehtuurihuomio:** Alkuperäinen ehdotus vaati Firestorea (`TECHNICAL_DESIGN.md` kieltää ilman erillistä päätöstä). Tässä versiossa peruspersistointi toteutetaan **localStorage:lla** samoin kuin UP-9:ssä. Firestore otetaan käyttöön myöhemmin synkronointilaajennuksena.

```
Kirjautunut käyttäjä avaa asetukset (avatarklikkaus → "Asetukset")
  └─ Asetuspaneeli (modal tai sivu) aukeaa
       ├─ Seuratut tagit – aktiiviset tagit näkyvät listana, poistettavissa
       ├─ Näkymä – teemavalinta (vaalea/tumma/järjestelmä)
       │    └─ Korvaa nykyisen istuntokohtaisen vaihdon
       └─ "Tyhjennä kaikki asetukset" – poistaa localStorage-avaimen
  └─ Tallennetaan välittömästi (ei erillistä Tallenna-painiketta)
       └─ Pieni animoitu checkmark-vahvistus muutoksen kohdalla
```

**Tekniset valinnat:**
- Kaikki asetukset tallennetaan yhteen JSON-objektiin: `localStorage.setItem('prefs_' + uid, JSON.stringify({tags, theme}))`
- Synkronointi laitteiden välillä: **ei toteuteta** heti; vaatii Firestoren/taustapalvelun käyttöönoton (ks. arkkitehtuurilaajennus alla)
- Teemavalinta: `data-theme`-attribuutti `<html>`-elementissä, luetaan käynnistyksessä ennen renderöintiä (välähdyksen estämiseksi)

**Hyväksymiskriteerit:**
- Asetukset säilyvät saman laitteen istuntojen välillä (localStorage)
- Teema aktivoituu ennen first-paintia (skripti `<head>`:ssä, inline tai deferoitu)
- Kirjautumattoman käyttäjän asetukset tallennetaan ilman UID-etuliitettä (`prefs_anon`)

---

### UP-11 · "Uutta seuraamissasi aiheissa" -ilmoitus

**kuviointikirjastomalli:** `notifications-list`

**Kuvaus:** Käyttäjä haluaa tietää, onko hänen valitsemiinsa tageihin ilmestynyt uusia artikkeleita sivulatauksen jälkeen.

> **Tekninen rajaus:** Kyseessä on **in-app-ilmoitus**, ei push-ilmoitus. Web Push API vaatii palvelinpuolen push-endpointin, mikä ei sovi nykyiseen palvelimettomaan arkkitehtuuriin. Tässä toteutetaan kevyempi malli: sivuston sisäinen uusien artikkelien merkintä.

```
Käyttäjällä on tageja valittuna (UP-9/UP-10)
  └─ Käyttäjä palaa sivulle (uusi istunto tai sivulataus)
       └─ Sovellus vertaa: nykyinen uutissyöte vs. edellisen käynnin "viimeisin artikkeli" per tagi
            ├─ Uusia artikkeleita löytyy → navigaatiopalkin kellokuvakkeessa numero
            │    └─ Klikkaus avaa "Uudet artikkelit" -paneelin
            │         ├─ Ryhmitelty tageittain
            │         └─ "Merkitse kaikki luetuksi" nollaa laskurin
            └─ Ei uusia → kelloa ei näytetä
```

**Tekniset valinnat:**
- Viimeisin nähty artikkeli per tagi: `localStorage.setItem('seen_' + tag, latestArticleId)`
- Vertailu tapahtuu `onAuthStateChanged`-callbackin jälkeen, kun uutissyöte on ladattu
- Uutissyöte haetaan RSS/JSON-feedistä (sama mekanismi kuin nykyisin) — ei erillistä backendiä
- Artikkelin tunniste: URL tai otsikon hash (deterministinen, ilman tietokantaa)

**Hyväksymiskriteerit:**
- Laskuri näkyy vain, jos käyttäjällä on tageja valittuna
- Toimii ilman kirjautumista (localStorage-pohjainen)
- Ei vaadi push-lupaa eikä palvelinpuolta

---

### UP-12 · Käyttäjäprofiilisivu

**kuviointikirjastomalli:** `profile`

**Kuvaus:** Kirjautunut käyttäjä haluaa nähdä omat tietonsa ja hallita tiliään.

> ⚠️ **Arkkitehtuurihuomio:** Alkuperäinen ehdotus luki tilastoja Firestoresta. Alla oleva versio laskee kaiken localStorage-datasta ja Firebase Authin tiedoista.

```
Klikkaa avatarikuvaa → "Profiili"
  └─ Profiilipaneeli aukeaa
       ├─ Google-profiilikuva ja nimi (Firebase Auth currentUser.displayName / photoURL)
       ├─ Seurantatilastot (lasketaan localStorage-datasta):
       │    ├─ Seurattujen tagien määrä
       │    └─ "Seuranta aloitettu" (Firebase Auth currentUser.metadata.creationTime)
       └─ "Kirjaudu ulos" ja "Poista tili" (Firebase Auth deleteUser + localStorage-siivous)
```

**Hyväksymiskriteerit:**
- Profiilitiedot haetaan Firebase Auth `currentUser`-objektista — ei Firestorea
- Tilin poisto siivoaa myös kaikki `prefs_` ja `seen_`-avaimet localStorage:sta
- Paneeli ei lataa mitään ulkoista dataa

---

### UP-13 · Artikkelin kontekstuaalinen vertailu

**kuviointikirjastomalli:** `discussion` + `argumenting`

**Kuvaus:** Käyttäjä haluaa nähdä, mitkä muut mediat käsittelevät samaa aihetta kuin valittu artikkeli.

```
Käyttäjä klikkaa uutiskorttia
  └─ Artikkelimodal aukeaa
       ├─ Pääartikkeli: otsikko, lähde, aikaleima, katkelma + "Lue alkuperäinen" -linkki
       └─ "Sama aihe muualla" -osio
            ├─ Suodatetaan jo ladatusta uutissyötteestä: otsikon avainsanat → muut kortit
            │    └─ Algoritmi: tokenisoi otsikot, laske Jaccard-samankaltaisuus, kynnys (threshold) > 0.2
            ├─ Näytetään 2–5 artikkelia eri lähteistä
            └─ Jos alle 2 lähdettä löytyy → osio piilotetaan
```

**Tekniset valinnat:**
- Kaikki suodatus asiakaspuolella, jo ladatusta datasta (ei lisäpyyntöjä)
- Jaccard-samankaltaisuus tokenisoiduille otsikoille (~10 rivin JS-funktio)
- Ei NLP-kirjastoa eikä backendiä

**Hyväksymiskriteerit:**
- Vertailu perustuu yksinomaan jo ladattuun syötteeseen (ei uusia verkkopyyntöjä)
- Toimii molemmille käyttäjärooleille

---

### UP-14 · Hakutoiminto

**kuviointikirjastomalli:** `streams` (hakusuodatin sisältövirran päälle)

**Kuvaus:** Käyttäjä haluaa löytää tiettyä aihetta koskevat artikkelit avainsanalla.

```
Hakuikoni navigaatiossa → hakukenttä laajenee
  └─ Käyttäjä kirjoittaa
       └─ Debounce 200ms → client-side suodatus
            ├─ Suodatuskohde: artikkelin otsikko + lähteen nimi + tagit
            ├─ Hakusana korostetaan otsikoissa (<mark>-elementti)
            ├─ Tyhjä tulos: "Ei tuloksia haulle '[x]'"
            └─ ESC tai tyhjennys → palaa alkuperäiseen virtaan
```

**Tekniset valinnat:**
- Haku kohdistuu **muistissa olevaan** artikkelilistaan (sama JS-array, josta virta renderöidään)
- Ei erillistä hakuindeksiä eikä verkkopyyntöjä hakuhetkellä
- `String.prototype.toLowerCase().includes()` riittää MVP-vaiheessa
- Hakutila tallennetaan URL-hashiin: `#haku=ukraina` → jaettava linkki toimii

**Hyväksymiskriteerit:**
- Hakuaika < 50ms (client-side, muistissa)
- Mobiilissa hakukenttä vie koko navigaatiopalkin leveyden
- Hash-parametri (`#haku=...`) luetaan sivulatauksen yhteydessä

---

### UP-15 · Kirjautuminen ja anonyymiys (suunnitteluperiaatteet)

Kirjautuminen on valinnaista eikä toimi porttina sisällölle. Palvelun käyttökynnys pidetään nollassa: kirjautuminen ei avaa uusia sisältöjä, vaan ainoastaan tallentaa asetukset ja preferenssit istuntojen välillä.

```
Uutisvirtaan pääsee aina kirjautumatta
  ├─ Anonyymi → täysi lukunäkymä, tagivalinnat vain tässä istunnossa
  └─ Kirjautunut Google-tilillä → samat toiminnot + tagivalinnat muistetaan
```

#### Kirjautumisen rajaus Google-tunnuksiin:
- **Ei salasanahallintaa** — Firebase Auth Google Sign-In on projektin ainoa auth-mekanismi; sähköposti+salasana toisi salasanavaatimukset, vahvistussähköpostit ja unohtuneen salasanan palautuksen ilman merkittävää hyötyä.
- **Ei rekisteröitymisvaihetta** — käyttäjä joko kirjautuu Google-tilillä tai käyttää palvelua anonyymisti.
- **Yhdenmukaisuus** — kaikki kirjautumiseen liittyvä koodi käsittelee vain yhtä auth-provideria.

#### UI-käytännöt:

| Tilanne | Toiminto |
|---|---|
| Anonyymi avaa etusivun | Ei pakotusta kirjautua; diskreetti "Kirjaudu tallentaaksesi valinnat" -linkki headerissa |
| Anonyymi klikkaa tallennusta vaativaa toimintoa | Laukaisee kirjautumismodalin selityksellä: "Kirjaudu Google-tilillä, niin valinnat muistetaan" |
| Kirjautunut käyttäjä | Avatar headerissa; ei kirjautumiskehotteita |
| Kirjautuminen epäonnistuu (popup suljettu) | Virheilmoitus: "Kirjautuminen peruutettiin" — ei uudelleenohjausta |
| Uloskirjautuminen | Asetukset säilyvät localStorage:ssa → palautuvat, jos sama käyttäjä kirjautuu uudelleen samalla laitteella |

---

## Käyttötapausten yhteenveto (UP-1 – UP-15)

| Tunnus | Käyttötapaus | Autentikointi | Nykyinen tila |
|---|---|---|---|
| UP-1 | Ensivierailu ja arvolupauksen ymmärtäminen | Ei vaadi | ✅ Toteutettu |
| UP-2 | Uutisvirran selaaminen | Ei vaadi | ✅ Staattinen demo |
| UP-3 | Teeman vaihto (vaalea/tumma) | Ei vaadi | ✅ Toteutettu |
| UP-4 | Kirjautuminen Google-tunnuksella | Vaatii | ✅ Toteutettu |
| UP-5 | Uloskirjautuminen | Vaatii | ✅ Toteutettu |
| UP-6 | Lähteiden aktiivisuuden tarkastelu | Ei vaadi | 🔲 Staattinen demo |
| UP-7 | Osallistuminen avoimeen lähdekoodiin | Ei vaadi | ✅ Toteutettu (GitHub-linkit) |
| UP-8 | Mobiiliselaus | Ei vaadi | ✅ Toteutettu |
| UP-9 | Henkilökohtainen uutisvirtanäkymä | Ei vaadi | 🔲 Ehdotettu (localStorage / muisti) |
| UP-10 | Käyttäjäasetusten hallinta | Ei vaadi | 🔲 Ehdotettu (localStorage) |
| UP-11 | "Uutta seuraamissasi aiheissa" -ilmoitus | Ei vaadi | 🔲 Ehdotettu (localStorage) |
| UP-12 | Käyttäjäprofiilisivu | Vaatii | 🔲 Ehdotettu (Firebase Auth) |
| UP-13 | Artikkelin kontekstuaalinen vertailu | Ei vaadi | 🔲 Ehdotettu (Jaccard client-side) |
| UP-14 | Hakutoiminto | Ei vaadi | 🔲 Ehdotettu (client-side haku) |
| UP-15 | Kirjautuminen ja anonyymiys | Ei vaadi | 🔲 Ehdotettu (suunnittelulinjaus) |

**Legenda:** ✅ = toiminnallinen · 🔲 = placeholder / tuleva ominaisuus

---

## Teknologiavaihtoehdot laitteiden väliseen synkronointiin

Laitteiden välinen synkronointi tarkoittaa, että käyttäjän tagit ja teema eivät ole enää pelkkä paikallinen selainasetus, vaan käyttäjäkohtainen pilvidata. Tähän on useita vaihtoehtoja, mikäli arkkitehtuurilinjausta (`TECHNICAL_DESIGN.md`) muutetaan:

| Vaihtoehto | Miten toimisi | Hyödyt | Haitat | Sopivuus |
|---|---|---|---|---|
| **Firestore** | Firebase Auth UID → `/users/{uid}/preferences/main` | Luonteva integraatio nykyiseen Google-kirjautumiseen, reaaliaikainen SDK, helppo clientiltä | Rikkoo nykyistä arkkitehtuurilinjaa, vaatii Security Rulesit | **Paras jos hyväksytään Firebase-laajennus** |
| **Supabase Postgres** | Google/OIDC tai oma auth-linkitys → `user_preferences`-taulu | Selkeä relaatiomalli, SQL, hyvä vendor neutrality | Uusi palvelu ja auth-integraatio, enemmän liikkuvia osia | Hyvä jos halutaan pienentää Firebase-riippuvuutta |
| **Cloudflare Workers + KV / D1** | Selain kutsuu omaa edge-API:a, joka lukee/kirjoittaa käyttäjän asetukset | Pieni, nopea, sopii staattiselle sivulle | Vaatii oman backend-kerroksen ja token-validoinnin | Hyvä jos halutaan edge-arkkitehtuuri |
| **Tiedostovienti (JSON export)** | Käyttäjä vie ja tuo asetukset itse tiedostona | Hyvin yksinkertainen, ei jatkuvaa backendia | Ei oikea automaattinen synkronointi | Sopii varmuuskopiointiin, ei ensisijaiseksi ratkaisuksi |

### Firestore-synkronointilaajennuksen ehdotettu tietomalli ja arkkitehtuuri

Jos tavoitteeksi asetetaan automaattinen synkronointi Firestorella:

#### 1. Tietomalli
```
/users/{uid}/preferences/main
  {
    followedTags: ["teknologia", "ukraina", "tekoäly"],
    theme: "dark",
    updatedAt: <server timestamp>,
    schemaVersion: 1
  }
```

#### 2. Synkronointivirta
```
Sovellus käynnistyy
  └─ Firebase Auth ratkaisee kirjautumistilan
       ├─ [Ei kirjautunut] käytä vain muistia + localStoragea
       └─ [Kirjautunut]
            ├─ Lue localStorage-välimuisti heti → UI renderöityy nopeasti
            ├─ Hae Firestore-dokumentti taustalla
            ├─ Vertaa updatedAt-arvoja
            │    ├─ Firestore uudempi → korvaa localStorage + päivitä UI
            │    └─ localStorage uudempi → kirjoita Firestoreen
            └─ Kaikki myöhemmät muutokset:
                 ├─ päivitä localStorage heti
                 └─ debouncattu write Firestoreen (esim. 500 ms)
```

#### 3. Firestore Security Rules
```
match /users/{userId}/preferences/{docId} {
  allow read, write: if request.auth != null && request.auth.uid == userId;
}
```

---

## Toteutusjärjestys (priorisoitu)

| Prioriteetti | Käyttötapaus | Tekninen riippuvuus | Firebase? |
|---|---|---|---|
| 1 | UP-9 Tagipohjainen suodatus | JS-muisti + localStorage | Ei |
| 2 | UP-14 Hakutoiminto | Client-side, muistissa oleva lista | Ei |
| 3 | UP-10 Asetuspaneeli | localStorage | Ei |
| 4 | UP-11 Uusien artikkelien merkki | localStorage + syötteen vertailu | Ei |
| 5 | UP-13 Kontekstuaalinen vertailu | Client-side Jaccard | Ei |
| 6 | UP-12 Profiilipaneeli | Firebase Auth `currentUser` | Auth (jo käytössä) |
| 7 | UP-10 laajennus: pilvisynkronointi | Firestore tai vaihtoehtoinen backend | Vaatii erillisen päätöksen |

---

*Viite: [uutisseurannan kuviot](https://d-cent.github.io/patterns/) · [TECHNICAL_DESIGN.md](TECHNICAL_DESIGN.md)*
