# STANDARDS.md — Uutisseuranta Frontend Standardit ja Vaatimukset

Tämä dokumentti määrittelee uutisseuranta-projektin käyttöliittymäkerroksen (frontend) noudattamat ulkoiset standardit ja tekniset vaatimukset. Koodaustyyliä ja sisäisiä käytäntöjä varten katso [CODE_CONVENTIONS.md](file:///Users/jaakkokorhonen/uutisseuranta/CODE_CONVENTIONS.md).

---

## 1. Ydinspeksit ja standardit

| Kerros | Standardi / Spesifikaatio | Viite |
|---|---|---|
| Datamalli | **ActivityStreams 2.0** (JSON-LD) | [W3C ActivityStreams 2.0](https://www.w3.org/TR/activitystreams-core/) |
| Merkintä & Tyylit | **HTML5 & CSS3** | [W3C HTML5](https://www.w3.org/TR/html5/) |
| Saavutettavuus | **WCAG 2.1 AA** | [WCAG 2.1 Guidelines](https://www.w3.org/TR/WCAG21/) |
| Aikaleimat | **RFC 3339** (ISO 8601 -profiili) | [RFC 3339](https://tools.ietf.org/html/rfc3339) |
| Tietosuoja | **GDPR** (EU-tietosuoja-asetus) | [GDPR Info](https://gdpr.eu/) |

---

## 2. Soveltaminen ja reunaehdot

### ActivityStreams 2.0 (AS2)
- Käytetään standardin mukaisia objekteja (katso [DECISION_LOG.csv](file:///Users/jaakkokorhonen/uutisseuranta/DECISION_LOG.csv) -> L-003):
  - `Article` uutisartikkeleille
  - `Note` kommenteille
  - `Collection` uutisvirralle (Outbox/Inbox)
- Semanttisen oikeellisuuden varmistamiseksi kaikkiin uutiskortteihin ja kommenttirakenteisiin liitetään vastaavat `data-ap-type`, `data-ap-id` ja `@context`-arvot.

### WCAG 2.1 AA (Saavutettavuus)
- Vaatimustenmukaisuus on organisaation linjaus (katso [DECISION_LOG.csv](file:///Users/jaakkokorhonen/uutisseuranta/DECISION_LOG.csv) -> L-004).
- **Kontrasti:** Tekstin ja taustan välisen kontrastisuhteen on oltava vähintään **4.5:1** (WCAG SC 1.4.3) ja käyttöliittymän graafisten osien vähintään **3:1** (WCAG SC 1.4.11).
- **Näppäimistöohjaus:** Kaikkiin interaktiivisiin elementteihin (kuten teeman vaihto ja profiilin avaaminen) pitää päästä `Tab`-näppäimellä ja niillä pitää olla selkeä `:focus-visible` -korostus (WCAG SC 2.4.7).
- **Elementtien haku kohdistettaessa:** Elementtejä ei saa näyttää ainoastaan hover-tilan avulla ilman, että ne ovat saavutettavissa näppäimistöllä kohdistettaessa (WCAG SC 1.4.13).


