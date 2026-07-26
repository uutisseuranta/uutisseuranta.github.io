# Uutisseuranta – Frontend

Uutisseuranta on moderni ja saavutettava suomalainen uutiskoostepalvelu, joka yhdistää eri lähteiden julkaisut yhteen selkeään uutisvirtaan. Tämä repositorio sisältää palvelun staattisen verkkokäyttöliittymän, joka on toteutettu standardeilla vanilla HTML, CSS ja JavaScript -tekniikoilla ilman monimutkaisia build-vaiheita. Käyttöliittymän visuaalinen ilme ja komponenttirakenne noudattavat uutisseurannan kuviointikirjaston periaatteita.

## Dokumentaatio

- [TECHNICAL_DESIGN.md](./TECHNICAL_DESIGN.md) — Arkkitehtuuriratkaisut, komponenttimalli ja release-prosessi.
- [STANDARDS.md](./STANDARDS.md) — WCAG-saavutettavuusvaatimukset, GDPR-linjaukset ja datan AS2-muotoilu.
- [DESIGN_GUIDELINES.md](./DESIGN_GUIDELINES.md) — Visuaalisen ilmeen ja käyttöliittymän suunnittelulinjat.
- [USER_PATHS.md](./USER_PATHS.md) — Käyttäjäpolut ja käyttötapaukset (UP-1 – UP-15).
- [LICENSES.md](./LICENSES.md) — Kolmannen osapuolen riippuvuudet ja lisenssit.

## Testaus

Projektissa on käytössä automaattinen testaus regression estämiseksi:

### 1. Paikallinen integraatiotesti
Tiedosto `integration-test.sh` käynnistää paikallisen API-mock-palvelimen, kääntää käyttöliittymän Vitellä ja tarkistaa, että käännetty bundle viittaa oikeisiin API-päätepisteisiin.
*   Ajo: `./integration-test.sh`

### 2. Automaattinen Headless Chrome -testi (Puppeteer)
Tiedosto `live-browser-test.js` suorittaa E2E-testit oikealla selaimella heti julkaisun jälkeen (post-deploy stage). Se tarkistaa:
*   **Uutisvirran latautumisen:** Varmistaa, että artikkelit renderöityvät ja ettei konsoliin tai verkkoliikenteeseen tule CORS- tai CSP-virheitä.
*   **Teemanvaihdon:** Klikkaa teemanvaihtajaa ja tarkistaa, että `data-theme` -attribuutti muuttuu.
*   **Kirjautumisen:** Klikkaa Kirjaudu-painiketta ja varmistaa, että kirjautumismodaali avautuu oikein.

**Ajo paikallisesti tuotantoa vasten:**
```bash
npm install puppeteer
node live-browser-test.js
```
 Voit myös asettaa testattavan URL-osoitteen ympäristömuuttujalla:
```bash
EFFECTIVE_URL="http://localhost:5173" node live-browser-test.js
```