# Uutisseuranta – Käyttäjäpolut ja käyttötapaukset

Tämä dokumentti kuvaa uutisseuranta.net-sivuston käyttäjäpolut ja käyttötapaukset. Dokumentti pohjautuu `index.html`-toteutukseen ja `ARCHITECTURE.md`-linjauksiin.

---

## Käyttäjäprofiilit

Sivustolla on kaksi käyttäjäroolia:

| Rooli | Kuvaus | Autentikointi |
|---|---|---|
| **Anonyymi käyttäjä** | Vierailee sivustolla ilman kirjautumista | Ei vaadi |
| **Kirjautunut käyttäjä** | Tunnistautunut Google-tunnuksella | Firebase Auth / Google Sign-In |

---

## Käyttäjäpolut

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

### UP-3 · Aihepiirin valinta (anonyymi tai kirjautunut)

**Lähtötilanne:** Käyttäjä haluaa suodattaa uutiset kiinnostuksensa mukaan.

```
Klikkaa navigaation "Aiheet" tai scrollaa #aiheet-osioon
  └─ Näkee topic-grid: 12 aihesirun ruudukko
       ├─ Politiikka (1,2k artikkelia)
       ├─ Talous (987)
       ├─ Teknologia (843)
       ├─ Urheilu (765)
       ├─ Kulttuuri (654)
       ├─ Terveys (598)
       ├─ Ympäristö (521)
       ├─ Kansainväliset (476)
       ├─ Tiede (412)
       ├─ Helsinki (389)
       ├─ Oulu (234)
       └─ Tampere (218)
  └─ Klikkaa aihesirua
       └─ (Tuleva ominaisuus: suodatettu uutisvirtanäkymä)
```

**Lopputulos:** Käyttäjä näkee kiinnostavien aiheiden artikkelimäärät ja valitsee seurattavat teemat.

---

### UP-4 · Teeman vaihto (anonyymi tai kirjautunut)

**Lähtötilanne:** Käyttäjä haluaa vaihtaa vaalean ja tumman teeman välillä.

```
Klikkaa navigaation aurinko/kuu-ikonipainike (btn-theme)
  └─ JavaScript vaihtaa data-theme-attribuuttia dokumentin juuressa
       ├─ "light" → CSS-muuttujat vaaleat sävyt
       └─ "dark"  → CSS-muuttujat tummat sävyt
```

**Huomio:** Teema-asetus ei tallennu istuntojen välillä — sivulatauksen jälkeen tunnistetaan `prefers-color-scheme` selaimen asetuksesta.

---

### UP-5 · Kirjautuminen Google-tunnuksella

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

### UP-6 · Uloskirjautuminen

**Lähtötilanne:** Kirjautunut käyttäjä haluaa kirjautua ulos.

```
Klikkaa avatarin vieressä olevaa "Ulos"-painiketta (btn-logout)
  └─ signOut(auth) kutsutaan
       └─ onAuthStateChanged laukeaa, user = null
            ├─ Avatarkuva piilotetaan
            └─ "Kirjaudu"-painike palaa näkyviin
```

---

### UP-7 · Lähteiden aktiivisuuden tarkastelu

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

### UP-8 · Avoin lähdekoodi – osallistuminen

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

### UP-9 · Mobiiliselaus

**Lähtötilanne:** Käyttäjä avaa sivuston mobiililaitteella (leveys ≤ 768px).

```
Mobiiliselain lataa sivuston
  └─ Responsiiviset mediakyselyt aktivoituvat
       ├─ Navigaation linkit (.nav__links) piilotetaan
       ├─ feed-grid muuttuu yksisarakkeiseksi
       ├─ features-visual -widget piilotetaan
       └─ hero__heading skaalautuu pienemmäksi (clamp)
```

**Toimivat ominaisuudet mobiilissa:** logo, teeman vaihto, kirjautumispainike, hero-teksti, uutisvirtakortit, aihesirut, CTA-osio, footer.

---

## Käyttötapausten yhteenveto

| Tunnus | Käyttötapaus | Autentikointi | Toteutustila |
|---|---|---|---|
| UP-1 | Ensivierailu ja arvolupauksen ymmärtäminen | Ei vaadi | ✅ Toteutettu |
| UP-2 | Uutisvirran selaaminen | Ei vaadi | ✅ Staattinen demo |
| UP-3 | Aihepiirin valinta | Ei vaadi | 🔲 UI valmis, logiikka puuttuu |
| UP-4 | Teeman vaihto (vaalea/tumma) | Ei vaadi | ✅ Toteutettu |
| UP-5 | Kirjautuminen Google-tunnuksella | Vaatii | ✅ Toteutettu |
| UP-6 | Uloskirjautuminen | Vaatii | ✅ Toteutettu |
| UP-7 | Lähteiden aktiivisuuden tarkastelu | Ei vaadi | 🔲 Staattinen demo |
| UP-8 | Osallistuminen avoimeen lähdekoodiin | Ei vaadi | ✅ Toteutettu (GitHub-linkit) |
| UP-9 | Mobiiliselaus | Ei vaadi | ✅ Toteutettu |

**Legenda:** ✅ = toiminnallinen · 🔲 = placeholder / tuleva ominaisuus

---

## Tunnistetut puuttuvat polut (backlog-ehdotukset)

Seuraavat käyttäjäpolut on tunnistettu sivuston arvolupauksen perusteella, mutta niitä ei ole vielä toteutettu:

- **UP-10 · Henkilökohtainen uutisvirtanäkymä** – kirjautunut käyttäjä näkee vain valitsemiensa aiheiden uutiset
- **UP-11 · Lähdesuodatus** – käyttäjä valitsee seurattavat mediat (Yle, HS, Kauppalehti jne.)
- **UP-12 · Artikkelin kontekstuaalinen yhteenveto** – muiden medioiden käsittely samasta aiheesta (mainittu ominaisuutena)
- **UP-13 · Hakutoiminto** – käyttäjä hakee artikkeleita avainsanalla
- **UP-14 · Käyttäjäasetusten tallennus** – teema, aihevalinnat ja lähdesuodattimet säilyvät istuntojen välillä
