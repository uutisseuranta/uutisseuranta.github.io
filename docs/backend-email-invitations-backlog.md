# Backend-kehitystehtävät: Sähköpostikutsut ja Maininnat (Backlog)

Tämä dokumentti määrittelee backend-puolelle (`bq-activitystreams`) avattavat kehitystehtävät (GitHub Issues), jotka tarvitaan sähköpostikutsujen ja `@mention`-ilmoitusten tuotantotason käyttöönottoa varten.

---

## Tehtävä 1: Mainintojen tunnistus ja asynkroninen kutsusähköpostijono (SendGrid/Mailgun)

### Kuvaus
Kun käyttäjä lähettää uuden kommentin (`Create Note`), backendin tulee etsiä kommentin sisällöstä `@`-merkillä alkavat maininnat. Mikäli mainittu käyttäjä (esim. `nimi@gmail.com`) ei ole vielä rekisteröitynyt palveluun, järjestelmän tulee lähettää hänelle sähköpostikutsu.

### Vaatimukset
1.  **Maininnan parsinta:** Parsitaan kommentin sisältö ja etsitään kaikki `@gmail.com`-päätteiset osoitteet.
2.  **Käyttäjän olemassaolon tarkistus:** Tarkistetaan tietokannasta, löytyykö sähköpostille rekisteröitynyttä käyttäjää.
3.  **Asynkroninen jono:** Mikäli käyttäjää ei löydy, luodaan sähköpostikutsu-tehtävä (esim. Google Cloud Tasks tai Google Cloud Pub/Sub) tausta-ajolle.
4.  **Gmail API -sähköpostilähetys:** Kutsut lähetetään käyttäjän itsensä puolesta hyödyntäen hänen sisäänkirjautumisessa antamaansa Gmail-luvitusta (`https://www.googleapis.com/auth/gmail.send`). Lähetys tapahtuu Googlen Gmail API:lla (esim. `gmail.users.messages.send`), jolloin sähköposti lähetetään suoraan käyttäjän omasta laatikosta ja se säästää ulkoisen SMTP/lähetyspalvelun kuluja.
5.  **Aktiviteettiloki:** Kutsun lähetyksestä tallennetaan lokitieto kantaan duplikaattien välttämiseksi (enintään 1 kutsu per osoite per uutinen).

---

## Tehtävä 2: ActivityPub Inbox ja In-App Notifikaatiot rekisteröityneille käyttäjille

### Kuvaus
Jos `@`-mainittu käyttäjä on jo rekisteröitynyt uutisseurantaan, hänelle luodaan reaaliaikainen tai in-app notifikaatio sähköpostin sijaan.

### Vaatimukset
1.  **Notification-taulun päivitys:** Tallennetaan maininta-ilmoitus BigQuery/Firestore-tietokantaan käyttäjän UID:n alle: `{ notificationId, type: "Mention", actor: commentatorUid, target: commentId, read: false, created: timestamp }`.
2.  **Sähköpostikoosteet:** Mahdollistetaan käyttäjän profiiliasetuksissa kerran päivässä lähetettävä sähköpostikooste uusista maininnoista.
3.  **Endpoint:** Luodaan GET `/ap/notifications` -rajapinta, jolla frontend kysyy käyttäjän lukemattomat ilmoitukset.

---

## Tehtävä 3: Väärinkäytösten esto ja rajat (Rate Limiting & Spam Prevention)

### Kuvaus
Sähköpostikutsujärjestelmää ei saa voida käyttää roskapostitukseen (spämmäämiseen). Palvelimen on valvottava ja rajoitettava kutsupyyntöjen määrää.

### Vaatimukset
1.  **Käyttäjäkohtainen raja:** Yksittäinen käyttäjä voi käynnistää enintään 5 ulkoista sähköpostikutsua 24 tunnin aikana.
2.  **Uutiskohtainen raja:** Yksittäiseen uutisartikkeliin liittyen voidaan lähettää enintään 3 kutsua samalle sähköpostiosoitteelle.
3.  **Estolista (Opt-Out):** Kutsusähköpostissa on oltava selkeä "Peruuta tilaukset" (Opt-Out) -linkki, joka estää kyseiseen sähköpostiosoitteeseen kohdistuvat kutsut tulevaisuudessa.
