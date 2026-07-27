# Autentikaatio- ja Transaktiomalli (Authentication & Transaction Architecture)

Tämä dokumentti kuvaa Uutisseuranta-sovelluksen autentikaation, todennustunnusten (Firebase Auth / Google OIDC) sekä julkisten ja suojattujen rajapintojen transaktiomallin.

## 1. Arkkitehtuurin periaatteet

1. **Julkisen datan vapaus (Open Data):** 
   - Uutisvirran haku (`GET /ap/outbox`) ja kommenttiketjujen lukeminen (`GET /ap/replies`) ovat avointa dataa.
   - Hakupyyntöjä ei ikinä estetä (401 Unauthorized), vaikka käyttäjä olisi kirjautumaton tai Bearer-token olisi vanhentunut/virheellinen. Backend käsittelee virheellisen tokenin anonyyminä lukupyyntönä.
2. **Erilliset rajapinnat luku- ja kirjoitustoiminnoille:**
   - **Query API:** Vastaa julkisista luvuista (anonyymi / valinnainen todennus).
   - **Write API:** Vastaa reaktioista, kommenteista ja tageista (vaatii aina validin Firebase ID Tokenin).
3. **Audience-yhteensopivuus:**
   - Selaimesta lähetetyt Firebase ID -tokenit sisältävät audienssina (aud) Firebase-projektin ID:n (`uutisseuranta-net`). Backend hyväksyy tämän audienssin standardien Google OIDC -tokenien rinnalla.

---

## 2. Mermaid-transaktiokaavio

```mermaid
sequenceDiagram
    autonumber
    actor User as Käyttäjä (Selain)
    participant App as Frontend (src/main.js)
    participant FB as Firebase Auth / Google OAuth
    participant QAPI as Backend Query API (Cloud Run)
    participant WAPI as Backend Write API (Cloud Run)
    participant BQ as BigQuery Database

    box rgba(100, 150, 250, 0.1) Julkinen luku (Kirjautumaton käyttäjä)
    User->>App: Avaa uutisseuranta.net
    App->>QAPI: GET /ap/outbox?tag=#politiikka (Ilman Authorization-otsaketta)
    QAPI->>BQ: SQL Query: Hae julkiset uutiset
    BQ-->>QAPI: Uutisartikkelit & reaktiomäärät
    QAPI-->>App: 200 OK (AS2 OrderedCollection)
    App-->>User: Näytä julkinen uutisvirta
    end

    box rgba(150, 250, 150, 0.1) Sisäänkirjautumistransaktio
    User->>App: Klikkaa "Kirjaudu" -> "Jatka Google-tilillä"
    App->>FB: signInWithPopup(auth, provider)
    FB->>User: Avaa Google OAuth -consent ikkuna (*.firebaseapp.com)
    User->>FB: Hyväksy kirjautuminen (uutisseuranta.net@gmail.com)
    FB-->>App: Palauta User & Firebase ID Token
    App->>App: onAuthStateChanged() -> Päivitä UI (Profiili / Ulos -painikkeet)
    end

    box rgba(250, 200, 100, 0.1) Julkinen luku (Kirjautunut käyttäjä)
    User->>App: Selaa uutisvirtaa / vaihda tagia
    App->>QAPI: GET /ap/outbox?tag=#tiede (Authorization: Bearer <Firebase_ID_Token>)
    QAPI->>QAPI: verify_auth_token_optional()
    alt Token on validi & aud = uutisseuranta-net
        QAPI->>QAPI: Tunnista käyttäjä (sub = UID)
    else Token puuttuu / virheellinen
        QAPI->>QAPI: Lokita varoitus & Jatka anonyyminä (sub = None)
    end
    QAPI->>BQ: SQL Query: Hae uutiset
    BQ-->>QAPI: Uutisartikkelit
    QAPI-->>App: 200 OK (AS2 OrderedCollection)
    App-->>User: Näytä uutisvirta
    end

    box rgba(250, 100, 100, 0.1) Suojattu kirjoitustoiminto (Reaktio / Kommentti)
    User->>App: Klikkaa "👍 Samaa mieltä"
    App->>FB: user.getIdToken()
    FB-->>App: Tuore Firebase ID Token
    App->>WAPI: POST /ap/activities (Authorization: Bearer <Firebase_ID_Token>)
    WAPI->>WAPI: verify_auth_token()
    alt Token kelpaa & aud = uutisseuranta-net & email_verified = true
        WAPI->>BQ: INSERT / UPDATE Like activity (BigQuery)
        BQ-->>WAPI: Ok
        WAPI-->>App: 201 Created / 200 OK
        App-->>User: Päivitä reaktiolaskuri UI:ssa
    else Token epäonnistuu / puuttuu
        WAPI-->>App: 401 Unauthorized
        App-->>User: Näytä virheilmoitus: "Kirjautuminen vanhentunut"
    end
    end
```

---

## 3. Rajapintakohtaiset todennussäännöt

| Rajapinta | HTTP-metodi | Autentikaatiovaatimus | Epäonnistuneen tokenin käsittely |
| :--- | :--- | :--- | :--- |
| `GET /ap/outbox` | GET | **Valinnainen (Optional)** | Ohitetaan; palautetaan julkinen uutisvirta (200 OK) |
| `GET /ap/replies` | GET | **Valinnainen (Optional)** | Ohitetaan; palautetaan julkiset kommentit (200 OK) |
| `GET /ap/check-status` | GET | Ei vaadita | Palautetaan artikkelin saatavuustila (200 OK) |
| `POST /ap/activities` | POST | **Pakollinen (Required)** | Estetään pyyntö; palautetaan 401 Unauthorized |

---

## 4. Perplexity AI -arviointi & Googlen Best Practices -yhteensopivuus

Transaktiomallin validointi pyydettiin Perplexity AI -palvelimelta suhteessa Googlen virallisiin Cloud Run- ja Firebase Auth -parhaisiin käytäntöihin.

### Yhteenveto & Arviointi
Arkkitehtuurimalli todettiin **vahvasti Googlen virallisten suositusten mukaiseksi**:
1. **Google Cloud Run -suositus:** Google kuvaa dokumentaatiossaan täsmälleen tämän mallin julkisesti saavutettavissa oleville Cloud Run -palveluille, joissa frontend toimii selaimessa ja suojatut pyynnöt autentikoituvat `Authorization: Bearer <Firebase_ID_Token>` -otsakkeella ([Google Cloud Run End-User Auth Docs](https://docs.cloud.google.com/run/docs/authenticating/end-users)).
2. **Palvelintason luottamussuhde:** Luotettavuus varmistetaan aina taustajärjestelmässä varmentamalla ID-tokenin allekirjoitus (`verify_firebase_token`), audienssi (`uutisseuranta-net`), voimassaolo ja käyttäjän UID (`sub`) ([Firebase Admin Auth Docs](https://firebase.google.com/docs/auth/admin/verify-id-tokens)).
3. **Avointen lukuohjelmien kitkattomuus (Low-Friction Open Data):** Virheellisen tai puuttuvan tokenin ohittaminen anonyyminä lukuna poistaa turhat 401-latausvirheet ja takaa avoimen datan saavutettavuuden.

### Suositukset jatkokehitykseen
- **HTTP-statuskoodit:** Käytetään selkeästi `401 Unauthorized` kun käyttäjä ei ole tunnistautunut, ja `403 Forbidden` kun autentikoidulta käyttäjältä puuttuu tietty käyttöoikeus.
- **Lokituksen tietoturva:** Varmistetaan, ettei Authorization-otsakkeen raaka-tokeneita kirjoiteta sellaisenaan Cloud Logging -lokiin.
