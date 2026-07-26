# Toteutussuunnitelma — uutisseuranta.github.io

Kukin label vastaa yhtä PR:ää. Issuet on ryhmitelty labeleittain toteutusjärjestyksessä.
Merkintä `→` tarkoittaa riippuvuutta: edellinen PR on oltava mergettynä ensin.

---

## Label: `0-sprint` — Välitön korjaus (tehdään ensin, blokkaajat)

Nämä kolme issueta on tehtävä ennen muuta. Jokainen blokkaajia myöhemmille töille.

| Issue | Otsikko | Huomio |
|---|---|---|
| [#53](https://github.com/uutisseuranta/uutisseuranta.github.io/issues/53) | themes broken | Tuotanto-URL rikki — korjataan ensin |
| [#57](https://github.com/uutisseuranta/uutisseuranta.github.io/issues/57) | infra: CI/CD-pipeline — automaattinen deploy | Push `main` → automaattinen deploy Pages:lle |
| [#23](https://github.com/uutisseuranta/uutisseuranta.github.io/issues/23) | arch: persistointiarkkitehtuuri (päätös tehty) | localStorage Vaihtoehto A — kirjataan dokumentteihin |

**PR-scope:** Yksi PR joka korjaa teemat + lisää deploy-workflown + merkitsee #23 tehdyksi dokumentoinnin osalta.

---

## Label: `mvp` — MVP-ominaisuudet (alpha-julkaisu)

Näiden jälkeen palvelu on toimiva alpha. Järjestys on tiukka — riippuvuusketju ylhäältä alas.

| Issue | Otsikko | Riippuu |
|---|---|---|
| [#56](https://github.com/uutisseuranta/uutisseuranta.github.io/issues/56) | arch: kirjaa localStorage-päätös DECISION_LOG + TECHNICAL_DESIGN | → `0-sprint` valmis |
| [#12](https://github.com/uutisseuranta/uutisseuranta.github.io/issues/12) | feat: uutisten dynaaminen tulostaminen etusivulle | → bq-activitystreams `/ap/outbox` toimii |
| [#2](https://github.com/uutisseuranta/uutisseuranta.github.io/issues/2) | feat: tagipohjainen suodatus (UP-9) | → #12 valmis |
| [#7](https://github.com/uutisseuranta/uutisseuranta.github.io/issues/7) | feat: hakutoiminto (UP-14) | → #12 valmis |
| [#8](https://github.com/uutisseuranta/uutisseuranta.github.io/issues/8) | feat: kirjautuminen / anonyymiys (UP-15) | → #12 valmis |
| [#1](https://github.com/uutisseuranta/uutisseuranta.github.io/issues/1) | feat: lähteiden aktiivisuus-widget (reaaliaikainen) | → #12 valmis |
| [#58](https://github.com/uutisseuranta/uutisseuranta.github.io/issues/58) | qa: error boundary ja fallback-tilat | → #12 + #8 valmis |
| [#59](https://github.com/uutisseuranta/uutisseuranta.github.io/issues/59) | qa: alpha smoke test — tarkistuslista | → kaikki yllä valmis |

**PR-jako:**
- PR `mvp/arch-persist` — issue #56 (dokumentointi)
- PR `mvp/news-feed` — issue #12 (uutisvirta, isoin PR)
- PR `mvp/filter-search` — issuet #2 + #7 (tagit + haku, samaan PR:ään koska samat rakenteet)
- PR `mvp/auth` — issue #8 (kirjautuminen)
- PR `mvp/widget` — issue #1 (aktiiivisuus-widget)
- PR `mvp/error-boundary` — issue #58 (virheenkäsittely)
- PR `mvp/smoke-test` — issue #59 (tarkistuslista, vain dokumentaatio)

---

## Label: `gdpr` — GDPR-vaatimukset (lakisääteinen, ennen julkaisua)

Voidaan tehdä rinnakkain `mvp`-labeltyön kanssa. Molemmat issuet menevät samaan PR:ään.

| Issue | Otsikko | Huomio |
|---|---|---|
| [#49](https://github.com/uutisseuranta/uutisseuranta.github.io/issues/49) | Tilinhallinta: poistetun käyttäjän Firestore-data (GDPR) | Client-side delete ennen `deleteUser` |
| [#50](https://github.com/uutisseuranta/uutisseuranta.github.io/issues/50) | Tilinhallinta: re-autentikointiflow tilin poistossa | `reauthenticateWithPopup` kun `auth/requires-recent-login` |

**PR-scope:** PR `gdpr/account-deletion` — molemmat issuet yhdessä PR:ssä, sillä ne koskevat samaa tilinpoistovirtaa.

---

## Label: `hardened` — Tietoturvakovennukset (ennen tuotantoa)

Tehdään `mvp`-labeltyön jälkeen.

| Issue | Otsikko | Huomio |
|---|---|---|
| [#52](https://github.com/uutisseuranta/uutisseuranta.github.io/issues/52) | sec: CSP-otsakepolitiikka | `<meta>`-tagi `index.html`:iin, Mozilla Observatory A |
| [#28](https://github.com/uutisseuranta/uutisseuranta.github.io/issues/28) | sec: Järjestelmän hardenointi (branch protection, WIF, CORS) | Kattaa myös patterns- ja bq-activitystreams-repot |

**PR-jako:**
- PR `hardened/csp` — issue #52 (CSP meta-tagi + testaus)
- PR `hardened/security` — issue #28 (branch protection, WIF, CORS — cross-repo koordinointi)

---

## Label: `production` — Tuotantotason lisäominaisuudet (post-alpha)

Näitä ei tarvita alpha-julkaisuun. Tehdään kun alpha on stabiili.

| Issue | Otsikko | Huomio |
|---|---|---|
| [#51](https://github.com/uutisseuranta/uutisseuranta.github.io/issues/51) | feat: käyttäjäkohtainen personointi (Firestore-preferenssit) | Vaatii #3 + #4 ensin |
| [#24](https://github.com/uutisseuranta/uutisseuranta.github.io/issues/24) | feat: Wayback Machine -arkistolinkki artikkelikorteille | Vaatii bq-activitystreams #26 |
| [#20](https://github.com/uutisseuranta/uutisseuranta.github.io/issues/20) | feat: Like/Dislike Agree/Disagree-näyttönimillä | Vaatii bq-activitystreams #33 |
| [#21](https://github.com/uutisseuranta/uutisseuranta.github.io/issues/21) | feat: profiilisivun Agree/Disagree-grafiikka | → #20 valmis |
| [#19](https://github.com/uutisseuranta/uutisseuranta.github.io/issues/19) | feat: PWA Service Worker (Workbox) | Vaatii #17 (Vite) ensin |

---

## Label: `documentation` — Dokumentaatio ja tekninen velka

Nämä voidaan tehdä missä vaiheessa tahansa, mutta ennen tuotantoa kaikki tulisi olla tehtynä.

| Issue | Otsikko | Huomio |
|---|---|---|
| [#27](https://github.com/uutisseuranta/uutisseuranta.github.io/issues/27) | chore: ARCHITECTURE→TECHNICAL_DESIGN, patterns.md merge, how-to-siirrot | Koordinoi patterns#47 |
| [#26](https://github.com/uutisseuranta/uutisseuranta.github.io/issues/26) | chore: yhtenäistä .md-tiedostorakenne | README kirjoitettava alusta |
| [#47](https://github.com/uutisseuranta/uutisseuranta.github.io/issues/47) | Meta: Jira–GitHub-integraation päätökset | Vain dokumentaatiota |

**PR-jako:**
- PR `docs/md-cleanup` — issuet #27 + #26 yhdessä (molemmat .md-rakenteen siivous)
- PR `docs/jira-meta` — issue #47 (erillinen meta-issue, ei koodimuutoksia)

---

## Yhteenveto: PR-järjestys

```
0-sprint/themes-ci-arch
  → mvp/arch-persist
  → mvp/news-feed
      → mvp/filter-search
      → mvp/auth
      → mvp/widget
      → mvp/error-boundary
          → mvp/smoke-test

gdpr/account-deletion       (rinnakkain mvp-työn kanssa)

hardened/csp                (mvp valmis ensin)
hardened/security           (mvp valmis ensin)

production/*                (alpha stabiili ensin)
docs/*                      (missä vaiheessa tahansa)
```

---

## Puuttuvat issuet — avattava ennen toteutusta

Nämä puuttuvat vielä kokonaan issueina. Avaa ennen vastaavan PR:n aloittamista:

| Aihe | Label | Mihin PR |
|---|---|---|
| Rate limiting `/ap/outbox`-endpointille | `hardened` | `hardened/security` |
| WCAG AA -saavutettavuusauditointi (koko sivu) | `hardened` | erillinen PR |
| Vite-pakkaajan käyttöönotto (#17) | `production` | ennen `production/pwa` |
| Modern CSS (@layer, nesting) (#18) | `production` | yhdistettävissä Vite-PR:ään |

---

## Release — tägijärjestys ja gate-kriteerit

Tägit luodaan kolmessa vaiheessa. Jokainen tägi odottaa edellisen CI-buildin läpimenoa.
Tägiketju: **patterns → bq-activitystreams → uutisseuranta.github.io**.

### v0.1.0 — "Ei rikki"

**Gate:** kaikki `0-sprint`-labeliset issuet kiinni, sivusto latautuu tuotannossa.

```bash
git tag -a v0.1.0 -m "Release v0.1.0: 0-sprint valmis, sivusto ei rikki"
git push origin v0.1.0
```

### v0.5.0 — "MVP alpha"

**Gate:** kaikki `mvp`- ja `gdpr`-labeliset issuet kiinni. Tarkista:

```bash
# Avoimet mvp-issuet — nolla ennen tagausta
gh issue list --label mvp --state open --repo uutisseuranta/uutisseuranta.github.io

# Avoimet gdpr-issuet
gh issue list --label gdpr --state open --repo uutisseuranta/uutisseuranta.github.io
```

```bash
git tag -a v0.5.0 -m "Release v0.5.0: MVP alpha — uutisvirta, filtteröinti, haku, kirjautuminen, GDPR"
git push origin v0.5.0
```

### v1.0.0 — "Production hardened"

**Gate:** kaikki `hardened`- ja `testing`-labeliset issuet kiinni, Mozilla Observatory A.

```bash
gh issue list --label hardened --state open --repo uutisseuranta/uutisseuranta.github.io

git tag -a v1.0.0 -m "Release v1.0.0: tuotantovalmis — CSP, branch protection, WIF, CORS"
git push origin v1.0.0
```

### Terraform-infrastruktuuri labelien hallintaan

Repolabelit ja branch protection hallitaan Terraformilla. Katso
[`terraform/github/frontend/labels.tf`](../terraform/github/frontend/labels.tf)
joka provisioi tässä dokumentissa käytetyt labelit (`0-sprint`, `mvp`, `gdpr`,
`hardened`, `production`, `documentation`, `testing`) sekä `main`-haaran
suojaussäännöt.

```hcl
# Esimerkki: terraform/github/frontend/labels.tf
resource "github_issue_label" "mvp" {
  repository  = "uutisseuranta.github.io"
  name        = "mvp"
  color       = "0075ca"
  description = "MVP-ominaisuudet — vaaditaan alpha-julkaisuun"
}

resource "github_issue_label" "gdpr" {
  repository  = "uutisseuranta.github.io"
  name        = "gdpr"
  color       = "e4e669"
  description = "Lakisääteinen — GDPR-vaatimukset ennen julkaisua"
}

resource "github_branch_protection" "main" {
  repository_id = github_repository.frontend.node_id
  pattern       = "main"

  required_status_checks {
    strict   = true
    contexts = ["ci / lint-and-test"]
  }

  required_pull_request_reviews {
    required_approving_review_count = 1
  }
}
```

Aja muutokset:

```bash
export GITHUB_TOKEN="ghp_..."
cd terraform/github
terraform init && terraform plan && terraform apply
```

### AS2-skeemaversio per release

| Release | AS2-skeemaversio | Muutokset |
|---|---|---|
| `v0.5.0` | schema-v1 | Article, Note, Collection, Hashtag peruskentät |
| `v1.0.0` | schema-v2 | Content negotiation, `_uutisseuranta:*`-laajennukset |
