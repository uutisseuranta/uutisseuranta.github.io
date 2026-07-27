# Ehdotetut testaus- ja laadunvarmistusissuet (Päivitetty 2026-07-27)

Tämä dokumentti sisältää ehdotetut GitHub/Jira-issuet uutisseurannan testausinfrastruktuurin kehittämiseksi, päätöslokeista havaittujen gappien korjaamiseksi sekä uusien käyttäjäpolkujen (UP-9 – UP-15) toteuttamiseksi.

---

## OLEMASSAOLEVAT TIKETIT

### Issue 1: qa: Playwright-selainten cachen käyttöönotto CI-putkessa (GitHub Issue #80)

**Tila:** Lykätty / Peruttu (Deferred / Won't Fix)

**Käyttökokemus (UX) & Linkitys:**
- Ei suoraa vaikutusta loppukäyttäjään (kehittäjäkokemus / CI-ajoaika).
- Monimutkaisuuden vuoksi sen toteuttamista ei suositella tässä vaiheessa (negative ROI).
- **Toteutussuunnitelma:** Merkitään heti "Lykätty" ja suljetaan. Jos CI-ajat kasvavat myöhemmin yli 2 minuutin, asennetaan SHA-pinnattu `actions/cache@5a3ec84eff668545956fd18022155c47e93e2684` (`v4.2.3`) rajoittuen ainoastaan `chromium`-selaimeen [TESTING.md § 5.2](file:///Users/jaakkokorhonen/uutisseuranta/TESTING.md#L321-L338) ohjeiden mukaisesti.

---

### Issue 2: qa: Laajenna Playwright-testikattavuutta (a11y, visuaalinen regressio ja mock-integraatio) (GitHub Issue #81)

**Tila:** Avoin (Ei toteutettu)

**Käyttökokemus (UX) & Linkitys:**
- Varmistaa, että saavutettavuusasetukset ja kontrastit (WCAG 2.1 AA) pysyvät kunnossa heikkonäköisille ja näppäimistönavigoijille.
- Visuaalinen vertailu estää tyylien rikkoutumisen CSS-muutosten yhteydessä.
- Linkittyy suoraan uutisvirran suodatukseen (UP-9), teemanvaihtoon (UP-3) ja kirjautumiseen (UP-4).
- **Toteutussuunnitelma:**
  1. Asennetaan `@axe-core/playwright` ja `@lhci/cli` devDependency-paketteina.
  2. Luodaan `tests/integration/api-mock.spec.js` hyödyntäen `page.route` sieppaamaan `/ap/outbox`-pyynnöt uutisvirran ja tagien testaamiseksi mock-datalla.
  3. Luodaan `tests/a11y/accessibility.spec.js` automaattista WCAG 2.2 AA auditointia varten.
  4. Luodaan `tests/visual/snapshot.spec.js` ottamaan koko sivun kuvakaappauksia `toHaveScreenshot()` -metodilla eri teemoissa. Asetetaan `maxDiffPixelRatio: 0.02` ja odotetaan `.article-card.first()` näkyvyyttä ennen kuvan ottamista. Testit ajetaan vain manuaalisesti.
  5. Varmistetaan kaanonpäätöksen G-014 mukaisesti, ettei autentikointitesteissä käytetä mockeja vaan ne menevät todellisen logiikan kautta.

---

### Issue 3: CI Failure: Post-Deploy Smoke Test (GitHub Issue #70)

**Tila:** Avoin (Odottaa merge-validointia)

**Käyttökokemus (UX) & Linkitys:**
- Estää virheellisten API-osoitteiden tai rikkinäisten CDN-versioiden pääsyn tuotantoon. Varmistaa, ettei käyttäjä näe "Uutisvirran lataus epäonnistui" -virheilmoituksia.
- Linkittyy backendin Cloud Run -rajapintoihin (query-api, write-api) ja Firebase Authenticationiin.
- **Toteutussuunnitelma:**
  1. Varmistetaan, että `fix/api-urls`-haaran mergen jälkeen `post-deploy-test.yml` ja `live-smoke-test.sh` suoriutuvat vihreänä.
  2. Suljetaan issue heti, kun tuotantoajo onnistuu virheittä.

---

### Issue 4: infra: Terraform-määrittely GitHub-repositorion asetuksille (GitHub Issue #63)

**Tila:** Avoin (Infratiedostot siirretty juureen, odottaa importtia)

**Käyttökokemus (UX) & Linkitys:**
- Varmistaa tiukimmat branch protection -asetukset repositoriossa (admin-bypass estetty), mikä suojaa tuotantokoodia ja varmistaa review-politiikan.
- Linkittyy kaikkiin GitHub-workflow-ajoihin ja PR-katselmointeihin.
- **Toteutussuunnitelma:**
  1. Aja `terraform import` kaikille olemassa oleville resursseille (Labels, Pages, Branch Protection) [terraform-import.md](file:///Users/jaakkokorhonen/uutisseuranta/terraform-import.md) ohjeistuksen mukaisesti.
  2. Aja `terraform plan` varmistaaksesi ettei "create"-muutoksia tapahdu.
  3. Suorita `terraform apply`.
  4. Päivitä `README.md` ilmoittamaan, että asetukset hallitaan Terraformilla.

---

## UX1-MERKITYT AVOIMET TIKETIT (GitHub-haut labelilla `ux1`)

Seuraavat tiketit on analysoitu ja päivitetty kehittäjäkommenttien perusteella:

### Issue 9: feat: näytä Like/Dislike-äänet Agree/Disagree-näyttönimillä ja summaa laskurit (GitHub Issue #20)

**Tila:** Avoin (Odottaa backend-riippuvuuksia)

**Käyttötapaukset (Use Cases):**
- **UC-20.1 (Äänestys):** Kirjautunut käyttäjä klikkaa uutiskortissa "Samaa mieltä" tai "Eri mieltä" -painiketta. Järjestelmä tallentaa `Like` tai `Dislike` reaktion.
- **UC-20.2 (Äänestystilan toggle):** Käyttäjä voi perua äänensä painamalla samaa painiketta uudelleen, tai vaihtaa ääntään painamalla vastakkaista painiketta.
- **UC-20.3 (Laskurien esitys):** Reaktioiden kokonaismäärät näytetään erillisinä (esim. "Samaa mieltä: 12", "Eri mieltä: 3"). Anonyymeille tai käyttäjille, jotka eivät ole vielä äänestäneet kyseistä artikkelia, **ei näytetä laskuria lainkaan** bandwagon-harhan ja sosiaalisen paineen minimoimiseksi.

**Toteutettavuuden arviointi:**
- **Feasibility:** Hyvä. Vaatii kuitenkin backend-toteutuksen `gcs-activitystreams#33` (reaktioiden vastaanotto) ja `patterns#42` (käyttöliittymätyylit) valmistumista.
- **Tietoturva & Idempotenssi:** Äänestyksen toggle-toiminto vaatii palvelinpäässä idempotenssin varmistamisen (esim. BigQuery `MERGE` tai olemassaolontarkistus ennen tallennusta), ettei sama käyttäjä voi antaa useita ääniä.
- **Saavutettavuus:** Napeissa käytetään `aria-pressed="true"` ja `aria-pressed="false"` -tiloja. Molemmat tilat on päivitettävä samanaikaisesti ruudunlukijoita varten. Rollback-virhepalautuksen on palautettava myös edellinen `aria-pressed` -tila.

**Toteutussuunnitelma:**
1. Lisätään reaktionapit uutiskortin ja uutismodalin sommitteluun.
2. Piilotetaan laskuri oletuksena ja näytetään se vasta, kun `localStorage` / backend vahvistaa käyttäjän äänestäneen kyseistä uutista.
3. Lähetetään `Like`/`Dislike` aktiviteetti write-apiin ja toteutetaan optimistinen UI-päivitys unread/read state rollbackilla virhetilanteessa.
4. Kirjataan arkkitehtuuripäätös (erilliset laskurit ilman nettopisteitä, bandwagon-estot) `DECISION_LOG.csv`:hen.

---

### Issue 10: UI: #tägi kommentissa periytyy artikkelille (GitHub Issue #15)

**Tila:** Avoin

**Käyttötapaukset (Use Cases):**
- **UC-15.1 (Tagin syöttäminen):** Kirjautunut käyttäjä kirjoittaa kommentin ja lisää siihen `#kaupunkisuunnittelu` autocomplete-ehdotuksen avulla.
- **UC-15.2 (Tagin periytyminen):** Kun kommentti tallennetaan, tagi liitetään sekä kommenttiin että sen ylätason uutisartikkeliin.

**Toteutettavuuden arviointi:**
- **Feasibility:** Erinomainen. Autocomplete-kirjasto Tribute.js tai `@github/combobox-nav` hoitaa triggerit `#` ja `@` samassa instanssissa.
- **Idempotenssi:** Ennen tagin lisäämistä ylätason artikkeliin on varmistettava, ettei samaa tagia ole jo olemassa (Add-aktiviteetin idempotenssi).

**Toteutussuunnitelma:**
1. Integroidaan Tribute.js tai `@github/combobox-nav` kommentointikenttään.
2. Muutetaan backend-integraatiota siten, että kommentin luonnissa lähetetään myös `Add`-aktiviteetti ylätason artikkelille, jos kommentti sisältää tageja.
3. Varmistetaan että tagit tallennetaan AS2:n mukaisesti tyypillä `Hashtag` ja ne periytyvät avoimen datan kantaan päivittäen artikkelin `updated`-aikaleiman.

---

### Issue 11: UI: @mention kommenttikentässä (GitHub Issue #14)

**Tila:** Avoin (Odottaa uutta backend-tikettiä)

**Käyttötapaukset (Use Cases):**
- **UC-14.1 (Käyttäjän mainitseminen):** Käyttäjä kirjoittaa kommenttikenttään `@matti`.
- **UC-14.2 (Notifikaatio):** Jos mainittu käyttäjä on rekisteröitynyt, hän saa järjestelmän sisäisen ilmoituksen. Jos ei ole rekisteröitynyt, järjestelmä lähettää sähköpostikutsun (Google-sähköpostilla).
- **UC-14.3 (Kutsulinkki):** Sähköposti- tai in-app-ilmoituksen kutsulinkki ohjaa suoraan kommenttiin muodossa: `/artikkeli/{id}?ref=mention#kommentti-{id}`.

**Toteutettavuuden arviointi:**
- **Feasibility:** Keskivaikea. Riippuvuus Tribute.js:stä on haastava, sillä upstream-kirjasto on kuollut. Päätetään käyttää joko forkattua `tributejs`-pakettia tai `@github/combobox-nav` -kirjastoa.
- **GDPR ja Tietoturva:** `mailto:`-mentions tallentaa sähköpostiosoitteita kantaan, mikä vaatii maininnan tietosuojaselosteeseen. Järjestelmän sisäinen ilmoitus vaatii backend-puolelle uuden persistointi- ja notifikaatiobacklogin.

**Toteutussuunnitelma:**
1. Kirjataan Tribute.js-vaihtoehdon korvaava päätös `DECISION_LOG.csv`:hen.
2. Avataan uudet backend-tiketit notifikaatioiden backlogin tallennusta ja sähköpostilähetystä varten.
3. Luodaan kutsulinkkien reititys siten, että query-parametri (`?ref=mention`) on ennen fragmenttiosaa (`#kommentti-id`).

---

### Issue 12: UI: käyttäjä voi lisätä tägin artikkeliin (GitHub Issue #13)

**Tila:** Avoin

**Käyttötapaukset (Use Cases):**
- **UC-13.1 (Tagin suora lisäys):** Kirjautunut käyttäjä klikkaa uutiskortissa "+ Lisää tagi" ja valitsee tai kirjoittaa uuden tagin.
- **UC-13.2 (Automaattinen seuranta):** Käyttäjä merkataan automaattisesti kyseisen tagin seuraajaksi (`prefs_[uid]`).

**Toteutettavuuden arviointi:**
- **Feasibility:** Helppo. Rakenne perustuu standardiin AS2 `Add`-aktiviteettiin.

**Toteutussuunnitelma:**
1. Luodaan painike ja syöttökenttä uutiskorttiin.
2. Lähetetään `Add`-aktiviteetti write-apiin.
3. Päivitetään käyttäjän preferenssit localStoragessa ja kasvatetaan tagin-lisäys-laskuria.

---

### Issue 13: arch: kirjautuminen ja anonyymiyskäytännot — suunnittelulinjaus (UP-15) (GitHub Issue #8)

**Tila:** Avoin

**Käyttötapaukset (Use Cases):**
- **UC-8.1 (Anonyymi selaus):** Käyttäjä voi lukea ja suodattaa uutisia ilman kirjautumista.
- **UC-8.2 (Kirjautumiseste):** Kun anonyymi käyttäjä yrittää tallentaa asetuksia pysyvästi tai äänestää, näytetään kirjautumismodal, joka selittää hyödyt.
- **UC-8.3 (Peruutus/Virhe):** Jos kirjautuminen epäonnistuu tai peruutetaan, käyttäjä jää samalle sivulle ilman sivulatausta.

**Toteutettavuuden arviointi:**
- **Feasibility:** Erinomainen. Firebase Auth tukee suoraan popup/redirect-kirjautumista Google-tilillä.

**Toteutussuunnitelma:**
1. Luodaan saavutettava, suljettava kirjautumismodal.
2. Integroidaan Google Sign-in Firebase Auth.
3. Kirjataan kirjautumis- ja anonyymiyskäytännöt globaalisti `DECISION_LOG.csv`:hen.

---

### Issue 14: feat: "Uutta seuraamissasi aiheissa" — in-app-ilmoitus uusista artikkeleista (UP-11) (GitHub Issue #4)

**Tila:** Avoin (Päällekkäinen Issue 6:n kanssa)

**Toteutussuunnitelma:** Tämä issue on täysin päällekkäinen aiemmin luodun **Issue 6**:n kanssa. Katso [Issue 6:n tiedot ylempänä](#issue-6-feat-uutta-seuraamissasi-aiheissa--in-app-uutuusilmoitukset-up-11) (tila säilyy localStoragella, vertailu syötteen aikaleimoihin, unread count badge navigaatiossa).

---

### Issue 15: feat: lähteiden aktiivisuuswidget — reaaliaikainen integrointi uutissyotteesta (UP-6) (GitHub Issue #1)

**Tila:** Avoin

**Käyttötapaukset (Use Cases):**
- **UC-1.1 (Oletustila):** Käyttäjä näkee etusivulla 8 aktiivisinta lähdettä ja niiden julkaisumäärät tänään visualisoituna suhteellisina palkkeina.
- **UC-1.2 (Suodatettu tila):** Jos käyttäjä käyttää tagisuodatinta tai hakua, widget päivittyy näyttämään vain suodatetun uutisvirran lähteiden aktiivisuuden.
- **UC-1.3 (Personoitu prioriteetti):** Kirjautuneen käyttäjän seuratut tagit muuttavat haun painotuksia ja heijastuvat widgetin jakaumaan.

**Toteutettavuuden arviointi:**
- **Feasibility:** Erinomainen. Voidaan laskea kokonaan client-sidellä uutissyötteen `OrderedCollection`-vastauksesta.

**Toteutussuunnitelma:**
1. Korvataan nykyinen staattinen `features-visual`-widget dynaamisella renderöinnillä.
2. Lasketaan uutissyötteestä uutisten määrät per lähde (`attributedTo.name`).
3. Skaalataan palkit suhteellisesti (eniten julkaissut saa 100% leveyden).
4. Kytketään suodattimien kuuntelu päivittämään widgetin tila reaaliajassa.
