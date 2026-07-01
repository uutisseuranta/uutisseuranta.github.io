# Uutisseuranta – Seuraavat käyttötapaukset (ehdotukset)

Tämä dokumentti ehdottaa seuraavia käyttötapauksia uutisseuranta.net-palvelulle.
Ehdotukset on johdettu kahdesta lähteestä:

1. **Nykyinen toteutus** – `user-paths.md`:ssä tunnistetut puuttuvat polut (UP-10–14)
2. **D-CENT-suunnittelumallit** – [d-cent.github.io/patterns](https://d-cent.github.io/patterns/) -kirjaston organism-tason vuorovaikutusmallit: `streams`, `notifications-list`, `profile`, `settings`, `discussion`, `argumenting`, `registration`

D-CENT-mallit on suunniteltu osallistaviin kansalaispalveluihin, mutta niiden ydinrakenteet — suodatettu virta, ilmoitukset, profiili, asetukset — sopivat suoraan uutisaggregaattorin kontekstiin.

**Arkkitehtuuriperiaate:** `ARCHITECTURE.md` rajaa Firebase-käytön vain Authenticationiin ja Analyticsiin. Kaikki persistointi, joka edellyttäisi Firestorea tai muuta Firebase-palvelua, merkitään tässä dokumentissa eksplisiittisesti **arkkitehtuuripäätöstä vaativaksi** ennen toteutusta.

---

## UP-10 · Henkilökohtainen uutisvirtanäkymä

**D-CENT-malli:** `streams` (suodatettu sisältövirta)

**Lähtötilanne:** Käyttäjä haluaa seurata vain tiettyjä aiheita. Aiheet valitaan klikkaamalla artikkeleissa näkyviä tageja — ei erillisellä asetusnäkymällä.

```
Käyttäjä näkee uutiskortissa tagin (esim. "Teknologia", "EU-politiikka")
  └─ Klikkaa tagia
       ├─ [Anonyymi] Tag lisätään istuntokohtaiseen suodatinlistaan (JS-muistissa)
       │    └─ Uutisvirtaan jää vain valitun tagin artikkelit
       │         └─ Tagipallo syttyy aktiiviseksi navigaatiopalkissa
       └─ [Kirjautunut] Sama + tag tallennetaan localStorage:iin UID:lla avainparina
            └─ Seuraavalla sivulatauksen yhteydessä tagi palautetaan automaattisesti
```

**Tekniset valinnat (ei Firestorea):**
- Istuntokohtainen tila: JS-objekti muistissa (`selectedTags = new Set()`)
- Kirjautuneelle persistointi: `localStorage.setItem('prefs_' + uid, JSON.stringify([...selectedTags]))`
- Lukeminen: `onAuthStateChanged` → `localStorage.getItem('prefs_' + uid)` → suodatin käyttöön
- localStorage on tuettava arkkitehtuuripäätös (ei Firestore); sisältö on vain käyttöliittymäpreferenssi, ei sensitiivistä dataa

**Hyväksymiskriteerit:**
- Tagiklikki suodattaa virran välittömästi ilman sivulatauksen (client-side filter)
- Anonyymi käyttäjä menettää valinnat istunnon päättyessä
- Kirjautunut käyttäjä näkee samat valinnat seuraavalla vierailulla (localStorage)
- Useampi tagi on valittavissa samanaikaisesti (OR-logiikka)
- "Nollaa suodattimet" -linkki palauttaa oletusvirran

---

## UP-11 · Käyttäjäasetusten hallinta

**D-CENT-malli:** `settings` (käyttäjän preferenssinäkymä)

**Lähtötilanne:** Kirjautunut käyttäjä haluaa hallita seurattavia tageja ja teema-asetusta pysyvästi.

> ⚠️ **Arkkitehtuurihuomio:** Alkuperäinen ehdotus vaati Firestorea (`ARCHITECTURE.md` kieltää ilman eksplisiittistä päätöstä). Tässä versiossa persistointi toteutetaan **localStorage:lla** samoin kuin UP-10:ssä. Firestore harkitaan erikseen, jos käyttäjä haluaa synkronoida asetukset laitteiden välillä.

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
- Synkronointi laitteiden välillä: **ei toteuteta** tässä vaiheessa; vaatisi Firestoren ja arkkitehtuuripäätöksen
- Teemavalinta: `data-theme`-attribuutti `<html>`-elementissä, luetaan käynnistyksessä ennen renderöintiä (ei välähdystä)

**Hyväksymiskriteerit:**
- Asetukset säilyvät saman laitteen istuntojen välillä (localStorage)
- Teema aktivoituu ennen first-paint (skripti `<head>`:ssä, inline tai deferoitu)
- Kirjautumattoman käyttäjan asetukset tallennetaan ilman UID-etuliitettä (`prefs_anon`)

---

## UP-12 · "Uutta seuraamissasi aiheissa" -ilmoitus

**D-CENT-malli:** `notifications-list`

**Lähtötilanne:** Käyttäjä haluaa tietää, onko hänen valitsemiinsa tageihin ilmestynyt uusia artikkeleita sivulatauksen jälkeen.

> **Tekninen rajaus:** Tämä on **in-app-ilmoitus**, ei push-ilmoitus. Web Push API vaatii palvelinpuolen push-endpointin, mikä ei sovi arkkitehtuuriin (ei backendiä). Tässä toteutetaan kevyempi malli: sivuston sisäinen uusien artikkelien merkkaus.

```
Käyttäjällä on tageja valittuna (UP-10/UP-11)
  └─ Käyttäjä palaa sivulle (uusi istunto tai sivulataus)
       └─ Sovellus vertaa: nykyinen uutissyöte vs. edellisen käynnin "viimeisin artikkeli" per tagi
            ├─ Uusia artikkeleita löytyy → navigaatiopalkin kellokuvakkeessa numero
            │    └─ Klikkaus avaa "Uudet artikkelit" -paneeli
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
- Laskuri näkyy vain jos käyttäjällä on tageja valittuna
- Toimii ilman kirjautumista (localStorage-pohjainen)
- Ei vaadi push-lupaa, ei palvelinpuolta

---

## UP-13 · Käyttäjäprofiilisivu

**D-CENT-malli:** `profile`

**Lähtötilanne:** Kirjautunut käyttäjä haluaa nähdä omat tietonsa ja hallita tiliään.

> ⚠️ **Arkkitehtuurihuomio:** Alkuperäinen ehdotus luki tilastoja Firestoresta. Alla oleva versio laskee kaiken localStorage-datasta.

```
Klikkaa avatarikuvaa → "Profiili"
  └─ Profiilipaneeli aukeaa
       ├─ Google-profiilikuva ja nimi (Firebase Auth currentUser.displayName / photoURL)
       ├─ Seurantatilastot (lasketaan localStorage-datasta):
       │    ├─ Seurattujen tagien määrä
       │    └─ "Seurannan aloitettu" (Firebase Auth currentUser.metadata.creationTime)
       └─ "Kirjaudu ulos" ja "Poista tili" (Firebase Auth deleteUser + localStorage-siivous)
```

**Hyväksymiskriteerit:**
- Profiilitiedot haetaan Firebase Auth `currentUser`-objektista — ei Firestorea
- Tilin poisto siivoaa myös kaikki `prefs_` ja `seen_`-avaimet localStorage:sta
- Paneeli ei lataa mitään ulkoista dataa

---

## UP-14 · Artikkelin kontekstuaalinen vertailu

**D-CENT-malli:** `discussion` + `argumenting`

**Lähtötilanne:** Käyttäjä haluaa nähdä, miten muut mediat käsittelevät samaa aihetta kuin valittu artikkeli.

```
Käyttäjä klikkaa uutiskorttia
  └─ Artikkelimodal aukeaa
       ├─ Pääartikkeli: otsikko, lähde, aikaleima, katkelma + "Lue alkuperäinen" -linkki
       └─ "Sama aihe muualla" -osio
            ├─ Suodatetaan jo ladatusta uutissyötteestä: otsikon avainsanat → muut kortit
            │    └─ Algoritmi: tokenisoi otsikot, laske Jaccard-samankaltaisuus, threshold > 0.2
            ├─ Näytetään 2–5 artikkelia eri lähteistä
            └─ Jos alle 2 lähdettä löytyy → osio piilotetaan
```

**Tekniset valinnat:**
- Kaikki suodatus asiakaspuolella, jo ladatusta datasta (ei lisäpyyntöjä)
- Jaccard-samankaltaisuus tokenisoiduille otsikoille (~10 rivin JS-funktio)
- Ei NLP-kirjastoa, ei backendiä

**Hyväksymiskriteerit:**
- Vertailu perustuu yksinomaan jo ladattuun syötteeseen (ei uusia verkkopyyntöjä)
- Toimii molemmille käyttäjärooleille

---

## UP-15 · Hakutoiminto

**D-CENT-malli:** `streams` (hakusuodatin sisältövirran päälle)

**Lähtötilanne:** Käyttäjä haluaa löytää tiettyä aihetta koskevat artikkelit avainsanalla.

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
- Ei erillistä hakuindeksiä, ei verkkopyyntöjä hakuhetkellä
- `String.prototype.toLowerCase().includes()` riittää MVP:hen — ei tarvita Fuse.js tai vastaavaa
- `sessionStorage` ei käytetä hakuhistoriaan (ARCHITECTURE.md:n periaatteen mukaisesti yksinkertaisinta ensin)
- Hakutila tallennetaan URL-hashiin: `#haku=ukraina` → jaettava linkki toimii

**Hyväksymiskriteerit:**
- Hakuaika < 50ms (client-side, muistissa)
- Mobiilissa hakukenttä vie koko navigaatiopalkin leveydestä (ei pienoiskenttä)
- Hash-parametri (`#haku=...`) luetaan sivulatauksen yhteydessä

---

## UP-16 · Kirjautuminen ja anonyymiys – design guideline

> UP-16 "Rekisteröityminen sähköpostilla" on **poistettu** ehdotuksista. Suunnittelupäätös: kirjautuminen tapahtuu aina Google-tilillä. Ilman kirjautumista voi käyttää täysimääräisesti — kirjautuminen lisää vain persistoinnin.

### Periaate: kirjautuminen on valinnaista, ei portti

Palvelun käyttökynnys pidetään nollassa. Kirjautuminen ei avaa uusia sisältöjä — se ainoastaan tallentaa asetukset istuntojen välillä.

```
Uutisvirtaan pääsee aina kirjautumatta
  ├─ Anonyymi → täysi lukunäkymä, tagivalinnat vain tässä istunnossa
  └─ Kirjautunut Google-tilillä → samat toiminnot + tagivalinnat muistetaan
```

### Miksi vain Google-kirjautuminen

- **Ei salasanahallintaa** — Firebase Auth Google Sign-In on projektin ainoa auth-mekanismi; sähköposti+salasana toisi salasanavaatimukset, vahvistusmeilit ja unohtunut-salasana-flown ilman selkeää hyötyä
- **Ei rekisteröitymisvaihetta** — käyttäjä joko kirjautuu Google-tilillä tai käyttää anonyymisti; välitilaa ei ole
- **Yhdenmukaisuus** — kaikki "kirjautuminen"-näkymän koodi käsittelee yhtä auth-provideeria

### UI-käytännöt

| Tilanne | Toiminto |
|---|---|
| Anonyymi avaa etusivun | Ei pakotusta kirjautua; diskreetti "Kirjaudu tallentaaksesi valinnat" -linkki headerissa |
| Anonyymi klikkaa "Tallenna" -tyyppistä toimintoa | Laukaisee kirjautumismodalin selityksellä: "Kirjaudu Google-tilillä, niin valinnat muistetaan" |
| Kirjautunut käyttäjä | Avatar headerissa; ei kirjautumiskehotteita missään |
| Kirjautuminen epäonnistuu (popup suljettu) | Virheilmoitus: "Kirjautuminen peruutettiin" — ei uudelleenohjausta |
| Uloskirjautuminen | Asetukset säilyvät localStorage:ssa → palautuvat, jos sama käyttäjä kirjautuu uudelleen samalla laitteella |

### Miksi ei sähköposti+salasana

Sähköpostirekisteröinti lisää kompleksisuutta ilman mitattavaa hyötyä nykyisessä skaalassa:
- vaatii vahvistusmeilin flown
- vaatii "unohtunut salasana" -toiminnon
- luo kaksi auth-codepathia (Google + email) kaikkeen jatkokehitykseen
- palvelu toimii anonyymisti → kynnys kirjautumiseen ei ole ongelma ratkaistava rekisteröintiä helpottamalla

Jos tulevaisuudessa halutaan laajentaa autentikointia (esim. GitHub-kirjautuminen tai magic link), tehdään siitä erillinen arkkitehtuuripäätös.

---

## Toteutusjärjestys (päivitetty)

| Prioriteetti | Käyttötapaus | Tekninen riippuvuus | Firebase? |
|---|---|---|---|
| 1 | UP-10 Tagipohjainen suodatus | JS-muisti + localStorage | Ei |
| 2 | UP-15 Hakutoiminto | Client-side, muistissa oleva lista | Ei |
| 3 | UP-11 Asetuspaneeli | localStorage | Ei |
| 4 | UP-12 Uusien artikkelien merkki | localStorage + syötteen vertailu | Ei |
| 5 | UP-14 Kontekstuaalinen vertailu | Client-side Jaccard | Ei |
| 6 | UP-13 Profiilipaneeli | Firebase Auth `currentUser` | Auth (jo käytössä) |

---

*Viite: [D-CENT Patterns](https://d-cent.github.io/patterns/) · [user-paths.md](user-paths.md) · [ARCHITECTURE.md](ARCHITECTURE.md)*
