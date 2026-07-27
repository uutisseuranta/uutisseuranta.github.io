# Arkkitehtuuridokumentti: Sähköpostien Autocomplete ja Validointi Google Workspace / Google Chat -integraatiossa

Tämä dokumentti kuvaa sähköpostiosoitteiden autocompleten ja validoinnin suunnitteluratkaisun ja toteutusperiaatteet hyödyntäen Googlen omia rajapintoja ja tietoturvasuosituksia päätöksen **L-016** mukaisesti.

---

## 1. Arkkitehtuurinen kuvaus

Julkisessa uutispalvelussa muiden käyttäjien sähköpostiosoitteiden suora ja avoin haku (esimerkiksi SQL-like haku suoraan frontendistä) on vakava GDPR-tietosuojariski (PII-vuoto). Jotta sähköpostit saadaan haettua ja suodatettua turvallisesti, hyödynnetään Googlen valmista infrastruktuuria Google Chat -ympäristöissä.

Google Chat App Cards ja Google Workspace Add-ons -lisäosat tarjoavat valmiin client-puolen tarkistuksen ja turvallisen autocomplete-rajapinnan.

### Komponentit ja roolit:
*   **Google Chat TextInput Widget:** Googlen virallinen käyttöliittymäkomponentti, joka suorittaa sähköpostisyötteen alustavan syntaksivalidoinnin.
*   **Google People API / Directory API:** Vastaa kontaktien hakemisesta. Kirjautunut käyttäjä näkee vain ne osoitteet, joihin hänellä on valtuudet (omat kontaktit ja yritys/Workspace-hakemisto).
*   **Backend Validointi (Uutisseuranta):** Vastaanottaa ja vahvistaa, että annettu osoite on sallittu domain (esim. vain `@gmail.com`).

---

## 2. Käyttöliittymäkomponentin määrittely (Card JSON)

Google Chat Card API -standardin mukainen `TextInput`-elementin määrittely sähköpostin validointiin ja autocomplete-toimintoon:

```json
{
  "textInput": {
    "name": "email_input_field",
    "label": "Kutsuttavan sähköpostiosoite (Gmail)",
    "type": "SINGLE_LINE",
    "inputType": "EMAIL",
    "placeholder": "esimerkki@gmail.com",
    "autoCompleteAction": {
      "items": [
        {
          "text": "matti.meikalainen@gmail.com"
        },
        {
          "text": "pekka.virtanen@gmail.com"
        }
      ]
    }
  }
}
```

*   `inputType: "EMAIL"`: Pakottaa sähköpostiformaatin ja estää virheellisen lomakkeen lähetyksen natiivilla virheilmoituksella.
*   `autoCompleteAction`: Tarjoaa dynaamiset suodatettavat ehdotukset käyttäjän omien kontaktien pohjalta.

---

## 3. Backend-tarkistus (Python / FastAPI)

Vaikka frontend suorittaa syntaksitarkistuksen, uutisseurannan backend-palvelin (Write API) varmistaa, että vastaanotettu kutsu kohdistuu ainoastaan sallittuun Gmail-domainiin:

```python
import urllib.parse
from fastapi import HTTPException

def validate_gmail_address(email: str):
    """Varmistaa että sähköposti on validi Gmail-osoite."""
    email = email.strip().lower()
    
    # Perustason syntaksitarkistus
    if "@" not in email:
        raise HTTPException(status_code=400, detail="Virheellinen sähköpostiosoite.")
        
    parts = email.split("@")
    if len(parts) != 2:
        raise HTTPException(status_code=400, detail="Virheellinen sähköpostirakenne.")
        
    domain = parts[1]
    
    # Sallitaan ainoastaan gmail.com
    if domain != "gmail.com":
        raise HTTPException(
            status_code=400, 
            detail="Uutisseuranta tukee ainoastaan Google/Gmail-tunnuksia (@gmail.com)."
        )
        
    return email
```

---

## 4. Edut ja hyödyt

1.  **Tietoturva & GDPR:** Yksityisiä sähköpostiosoitteita ei indeksoida tai jaeta meidän omassa palvelussamme. Google kontrolloi pääsyoikeuksia ja sallii käyttäjän nähdä vain omat ystävänsä.
2.  **Yksinkertaisuus:** Ei tarvetta kehittää tai ylläpitää omaa autocomplete- ja validointialgoritmia selaimessa.
3.  **Saavutettavuus (A11y):** Googlen Card API -elementit ovat valmiiksi esteettömiä ja WCAG-standardien mukaisia.
