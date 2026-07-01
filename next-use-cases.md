# Uutisseuranta – Seuraavat käyttötapaukset (ehdotukset)

Tämä dokumentti ehdottaa seuraavia käyttötapauksia uutisseuranta.net-palvelulle.
Ehdotukset on johdettu kahdesta lähteestä:

1. **Nykyinen toteutus** – `user-paths.md`:ssä tunnistetut puuttuvat polut (UP-10–14)
2. **D-CENT-suunnittelumallit** – [d-cent.github.io/patterns](https://d-cent.github.io/patterns/) -kirjaston organism-tason vuorovaikutusmallit: `streams`, `notifications-list`, `profile`, `settings`, `discussion`, `argumenting`, `registration`

D-CENT-mallit on suunniteltu osallistaviin kansalaispalveluihin, mutta niiden ydinrakenteet — suodatettu virta, ilmoitukset, profiili, asetukset — sopivat suoraan uutisaggregaattorin kontekstiin.

---

## UP-10 · Henkilökohtainen uutisvirtanäkymä

**D-CENT-malli:** `streams` (suodatettu sisältövirta)

**Lähtötilanne:** Kirjautunut käyttäjä haluaa nähdä vain valitsemiensa aiheiden uutiset, ei kaikkia artikkeleita.

```
Kirjautunut käyttäjä avaa etusivun
  └─ Järjestelmä tunnistaa kirjautumistilan (onAuthStateChanged)
       └─ Lataa käyttäjän tallennetut aihe- ja lähdevalinnat
            └─ Uutisvirtaan suodatetaan vain valitut kategoriat ja lähteet
                 ├─ Tyhjä tila: "Et ole valinnut aiheita – siirry asetuksiin"
                 └─ Virta: kortit järjestetään tuoreimmasta vanhimpaan
```

**Hyväksymiskriteerit:**
- Anonyymi käyttäjä näkee oletusvirran (kaikki kategoriat)
- Kirjautunut käyttäjä näkee personoidun virran
- Virta päivittyy, kun käyttäjä muuttaa aihe- tai lähdevalintojaan asetuksissa

---

## UP-11 · Käyttäjäasetusten hallinta

**D-CENT-malli:** `settings` (käyttäjän preferenssinäkymä)

**Lähtötilanne:** Kirjautunut käyttäjä haluaa hallita seurattavia aiheita, lähteitä ja käyttöliittymäasetuksia pysyvästi.

```
Navigoi asetussivulle (esim. avatarklikkaus → "Asetukset")
  └─ Asetussivu aukeaa, osiot:
       ├─ Aihepiirit – valintaruudukko (Politiikka, Talous, Teknologia …)
       ├─ Lähteet – lista medioista (Yle, HS, Kauppalehti …)
       │    └─ Lähderivin vieressä artikkeli/pv-lukema
       ├─ Näkymä – teemavalinta (vaalea/tumma/järjestelmä)
       └─ Ilmoitukset – päivitysväli (reaaliaikainen / tunnin välein / päivittäin)
  └─ Tallennetaan Firestore-dokumenttiin käyttäjäkohtaisesti
       └─ Vahvistusviesti: "Asetukset tallennettu"
```

**Hyväksymiskriteerit:**
- Asetukset säilyvät istuntojen välillä (persistointi Firestoreen)
- Teemavalinta korvaa nykyisen istuntokohtaisen vaihdon
- Asetukset latautuvat sivulatauksen yhteydessä ennen virran renderöintiä

---

## UP-12 · Ilmoitukset uusista artikkeleista

**D-CENT-malli:** `notifications-list` (tapahtumavirran ilmoitusnäkymä)

**Lähtötilanne:** Käyttäjä haluaa tietää, milloin seuraamiinsa aiheisiin ilmestyy uusia artikkeleita.

```
Käyttäjä on asettanut ilmoitukset asetuksissa
  └─ Navigaatiopalkissa kellokuvake ilmoitusmerkin kanssa
       └─ Klikkaus avaa ilmoituslistan (dropdown tai sivupaneeli)
            ├─ Jokainen ilmoitus: lähde + otsikko + aika
            ├─ "Merkitse luetuksi" yksittäiselle tai kaikille
            └─ "Avaa artikkeli" → ulkoinen linkki
  └─ Push-ilmoitus (selain) jos käyttäjä on antanut luvan
```

**Hyväksymiskriteerit:**
- Ilmoitusmerkki katoaa, kun kaikki on merkitty luetuksi
- Ilmoitushistoria säilyy 7 päivää
- Toimii ilman push-lupaa (in-app-ilmoitukset riittävät MVP:ssä)

---

## UP-13 · Käyttäjäprofiilisivu

**D-CENT-malli:** `profile` (käyttäjän julkinen ja yksityinen profiili)

**Lähtötilanne:** Kirjautunut käyttäjä haluaa nähdä ja muokata omia tietojaan sekä seurantatilastojaan.

```
Klikkaa avatarikuvaa → "Profiili"
  └─ Profiilisivu aukeaa
       ├─ Google-profiilikuva ja nimi (vain luku, hallitaan Google-tilillä)
       ├─ Seurantatilastot:
       │    ├─ Seurattujen aiheiden määrä
       │    ├─ Luettujen artikkelien määrä (tällä viikolla / yhteensä)
       │    └─ Aktiivisin kategoria
       └─ "Poista tili" -toiminto (Firebase Auth deleteUser)
```

**Hyväksymiskriteerit:**
- Profiilisivu on yksityinen (ei julkinen URL)
- Tilastot lasketaan Firestoresta, ei lasketa asiakaspuolella
- Tilin poisto poistaa myös käyttäjän Firestore-dokumentin

---

## UP-14 · Artikkelin kontekstuaalinen vertailu

**D-CENT-malli:** `discussion` + `argumenting` (monilähteinen näkymä samasta aiheesta)

**Lähtötilanne:** Käyttäjä lukee uutista ja haluaa nähdä, miten muut mediat käsittelevät samaa aihetta.

```
Käyttäjä klikkaa uutiskorttia
  └─ Artikkelin sivunäkymä aukeaa (in-app tai modal)
       ├─ Pääartikkeli: otsikko, kappale, lähde, aikaleima
       └─ "Muut mediat tästä aiheesta" -osio
            ├─ 3–5 saman aiheen artikkelia eri lähteistä
            │    └─ Lähde, otsikko, aikaleima, lyhyt katkelma
            ├─ Vertailupalkki: kuinka moni media käsittelee aihetta
            └─ "Avaa alkuperäinen" → ulkoinen linkki
```

**Hyväksymiskriteerit:**
- Aiheentunnistus perustuu avainsanoihin tai otsikon samankaltaisuuteen (cosine similarity / TF-IDF)
- Näytetään vähintään 2 eri lähdettä, muutoin osiota ei näytetä
- Toimii molemmille käyttäjärooleille (anonyymi ja kirjautunut)

---

## UP-15 · Hakutoiminto

**D-CENT-malli:** `streams` (hakusuodatin sisältövirran päälle)

**Lähtötilanne:** Käyttäjä haluaa löytää tiettyä aihetta koskevat artikkelit avainsanalla.

```
Klikkaa hakuikonipainike navigaatiossa (tai /haku-sivu)
  └─ Hakukenttä aktivoituu
       └─ Käyttäjä kirjoittaa hakusanan
            └─ Haku suoritetaan (reaaliaikainen debounce 300ms)
                 ├─ Tulokset: kortit hakusanan mukaan suodatettuna
                 ├─ Hakusana korostetaan artikkeliotsikoissa
                 ├─ Tyhjä tulos: "Ei tuloksia haulle '[x]'"
                 └─ Hakuhistoria tallennetaan istuntoon (sessionStorage)
```

**Hyväksymiskriteerit:**
- Haku kohdistuu otsikkoon, lähteeseen ja kategoriaan
- Hakuaika < 200ms asiakaspuolisessa suodatuksessa
- Mobiilissa hakukenttä laajenee koko navigaatiopalkin leveyteen

---

## UP-16 · Rekisteröityminen sähköpostilla

**D-CENT-malli:** `registration` (käyttäjärekisteröintikaavio)

**Lähtötilanne:** Käyttäjä haluaa rekisteröityä ilman Google-tiliä.

```
Klikkaa "Kirjaudu" → valitsee "Rekisteröidy sähköpostilla"
  └─ Rekisteröintilomake:
       ├─ Sähköpostiosoite
       ├─ Salasana (vahvuusmittari)
       └─ Salasana uudelleen (vahvistus)
  └─ Firebase Auth createUserWithEmailAndPassword
       ├─ [Onnistuu] → vahvistussähköposti lähetetään (sendEmailVerification)
       │    └─ Käyttäjä ohjataan etusivulle, banneri: "Vahvista sähköpostisi"
       └─ [Virhe] → virheilmoitus (sähköposti käytössä / heikko salasana)
```

**Hyväksymiskriteerit:**
- Sähköpostirekisteröinti on vaihtoehto, ei korvike Google-kirjautumiselle
- Vahvistamaton tili näkee perusvirran mutta ei voi tallentaa asetuksia
- Salasanavaatimus: väh. 8 merkkiä, yksi numero tai erikoismerkki

---

## Toteutusjärjestys (suositus)

D-CENT-periaatteen *"Simple"* mukaisesti — yksinkertaisin ensin, lisää vain mitattavan tarpeen perusteella:

| Prioriteetti | Käyttötapaus | Perustelu |
|---|---|---|
| 1 | UP-11 Asetukset | Mahdollistaa UP-10:n ja teeman persistoinnin |
| 2 | UP-10 Henkilökohtainen virta | Arvolupauksen ydinominaisuus |
| 3 | UP-15 Hakutoiminto | Korkea käyttöarvo, asiakaspuolinen toteutus yksinkertainen |
| 4 | UP-14 Kontekstuaalinen vertailu | Erottautumistekijä, vaatii backend-logiikan |
| 5 | UP-12 Ilmoitukset | Sitouttava ominaisuus, vaatii Firestore-integraation |
| 6 | UP-13 Profiilisivu | Tukee yllä olevia, pieni toteutustyö |
| 7 | UP-16 Sähköpostirekisteröinti | Laajentaa käyttäjäkuntaa, Firebase Auth tukee suoraan |

---

*Viite: [D-CENT Patterns](https://d-cent.github.io/patterns/) · [user-paths.md](user-paths.md) · [ARCHITECTURE.md](ARCHITECTURE.md)*
