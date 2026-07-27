# Ehdotetut uudet testaus- ja laadunvarmistusissuet

Tämä dokumentti sisältää ehdotetut GitHub/Jira-issuet uutisseurannan testausinfrastruktuurin kehittämiseksi.

---

## Issue 1: qa: Playwright-selainten cachen käyttöönotto CI-putkessa

**Kuvaus:**
Tällä hetkellä PR-validointi ja post-deploy -testit lataavat Chromium-binäärin uudelleen jokaisella suorituskerralla (`npx playwright install`). Tämä pidentää CI-putken kestoa ja kuluttaa turhaan GitHub Actions -minuutteja.

**Toteutusehdotus:**
Otetaan käyttöön Actions-cache Playwright-selaimille hyödyntämällä `actions/cache`-actionia tai Playwrightin suosittelemaa cache-polkua:
`~/.cache/ms-playwright` Linux-ympäristössä.

**Hyväksymiskriteerit:**
- [ ] PR Validate- ja Post-Deploy -työnkuluissa on määritelty välimuistitus Playwright-selaimille.
- [ ] Jos välimuisti löytyy (cache hit), työnkulku ohittaa selainbinäärien verkosta lataamisen.
- [ ] Työnkulun suoritusaika lyhenee vähintään 30–60 sekuntia.

**Labelit:** `github-actions-front-testing` (Issue #80)

---

## Issue 2: qa: Laajenna Playwright-testikattavuutta (a11y, visuaalinen regressio ja mock-integraatio)

**Kuvaus:**
Käyttöliittymän testauksen tehostamiseksi ja testaussuunnitelman tiivistämiseksi yhdistetään visuaalisen ilmeen, saavutettavuuden ja offline-toiminnallisuuden testaus osaksi samaa Playwright-testikirjastoa.

**Toteutusehdotus:**
1. **Visuaalinen regressio (Visual Comparison):**
   - Lisätään tuki kuvakaappausvertailuille (`expect(page).toHaveScreenshot()`).
   - Otetaan kuvat etusivusta ja uutisvirrasta eri teemoissa ja mobiilikoossa varmistamaan ettei CSS Layer/nesting-muutokset riko UI:ta.
2. **Automaattinen saavutettavuusauditointi (a11y):**
   - Integroidaan `@axe-core/playwright` osaksi PR-validointia tarkastamaan contrast-, aria- ja näppäimistönavigaatiosäännöt WCAG 2.1 AA -tason mukaisesti.
3. **Integraatiotesti mock-uutisdatalla (Offline Integration Test):**
   - Mockataan `/ap/outbox` -verkkopyynnöt Playwrightin `page.route` avulla.
   - Varmistetaan uutisvirran suodatuksen (UP-9), hakutoiminnon (UP-14) ja Error Boundaryn (500/offline-tilat) toimivuus deterministisesti.

**Hyväksymiskriteerit:**
- [ ] Playwright-konfiguraatio tukee visuaalista kuvakaappausvertailua.
- [ ] Luotu testitiedostot saavutettavuudelle, visuaaliselle ilmeelle ja mock-integraatiolle.
- [ ] Testit ajetaan osana PR-validointia ja ne menevät läpi ilman ulkoisia rajapintariippuvuuksia.

**Labelit:** `mvp`, `hardened`, `github-actions-front-testing` (Issue #81)
