# Jira–GitHub Integration

Tämä dokumentti kuvaa **uutisseuranta**-projektin Jira–GitHub-integraation designin, tietomallin ja Atlassian Automation -säännöt. Lähde: suunnittelukeskustelu 2026-07-03.

---

## Toteutusstatus

| Vaihe | Kuvaus | Status | Toteutettu |
|---|---|---|---|
| 1 | Luo custom-kentät Jira-projektiin (`source_repo`, `github_issue_number`, `github_url`) | ✅ Valmis | 2026-07-03 |
| 2 | Asenna GitHub for Atlassian -app ja liitä repot | ✅ Valmis | 2026-07-03 |
| 3 | Tallenna GitHub PAT Atlassian Automation -säännön HTTP-headeriin | ⏳ Odottaa | — |
| 4 | Luo GitHub-webhookit kaikille kolmelle repolle | ⏳ Odottaa | — |
| 5 | Rakenna Säännöt 1–8 (GitHub → Jira) | ⏳ Odottaa | — |
| 6 | Rakenna Säännöt 9–15 (Jira → GitHub) | ⏳ Odottaa | — |
| 7 | Testaa sääntö 1 manuaalisesti, tarkista idempotenttius | ⏳ Odottaa | — |
| 8 | Backfill-ajo kaikille olemassa oleville avoimille issueille | ⏳ Odottaa | — |
| — | `.github/labels.yml` + `sync-labels` GitHub Action kaikille kolmelle repolle | ✅ Valmis | 2026-07-03 |
| — | GitHub Secrets: `JIRA_EMAIL` + `JIRA_API_TOKEN` tallennettu repoon `uutisseuranta.github.io` | ✅ Valmis | 2026-07-03 |
| — | `.github/workflows/create-jira-fields.yml` — luo 3 custom-kenttää Jira REST API:lla | ✅ Valmis | 2026-07-03 |

---

### Vaihe 1: Custom-kenttien luonti Jiraan (✅ Valmis)

Kentät luotiin GitHub Actions -workflowlla joka kutsui Jira REST API:ta.

**Konfiguraatio:**
- Cloud ID: `38191fa4-e340-4d5e-8f7d-33c8f6829dbd`
- Project key: `US`
- API endpoint: `https://api.atlassian.com/ex/jira/{cloudId}/rest/api/3/field`

**Luodut kentät ja niiden Jira field ID:t:**

| Kenttä | Field ID | Tyyppi |
|---|---|---|
| `source_repo` | `customfield_10071` | Text (Short text) |
| `github_issue_number` | `customfield_10072` | Number |
| `github_url` | `customfield_10073` | URL |

> **Miten field ID:t selvitettiin:** GitHub Actions -lokeista täytyy hakea **raw log** (ei tavallinen lokinäkymä). Workflown ajon sivulla klikkaa oikeasta yläkulmasta **⚙️ → Download log archive** tai avaa lokin yläpalkista **Raw logs** -linkki. Raw logissa jokainen `curl`-vastaus näkyy JSON-muodossa ja siitä löytyy `"id":"customfield_XXXXX"` -kenttä jokaiselle luodulle kentälle.

#### GitHub Secrets — tallennus repoon

Secrets ovat **salasanoja joita GitHub Actions käyttää** — niihin on kaksi kenttää:

| Kenttä GitHubissa | Selitys | Esimerkki |
|---|---|---|
| **Name** | Muuttujan nimi, johon workflow viittaa koodissa | `JIRA_EMAIL` |
| **Secret** | Oikea arvo — itse salasana tai tunnus | `jaakko.korhonen@gmail.com` |

> **Muistisääntö:** Name-kenttään tulee se nimi jolla kutsut muuttujaa (`${{ secrets.JIRA_EMAIL }}`), ei arvo itse. Secret-kenttään tulee oikea, salainen arvo.

**Tallennettavat secretit repoon `uutisseuranta.github.io`:**

| Name (muuttujan nimi) | Secret (arvo) | Mistä haetaan |
|---|---|---|
| `JIRA_EMAIL` | Atlassian-tilin sähköpostiosoite | Oma sähköposti jolla kirjaudut Jiraan |
| `JIRA_API_TOKEN` | Atlassian API token | https://id.atlassian.com/manage-profile/security/api-tokens |

**Ajo:**
1. Tallenna molemmat secretit: [Settings → Secrets → Actions → New secret](https://github.com/uutisseuranta/uutisseuranta.github.io/settings/secrets/actions/new)
2. Siirry: [Actions → Create Jira Custom Fields → Run workflow](https://github.com/uutisseuranta/uutisseuranta.github.io/actions/workflows/create-jira-fields.yml)
3. Avaa ajon lokit — **käytä Raw log** -näkymää (ajon sivulla oikeassa yläkulmassa ⚙️ → Download log archive, tai kunkin stepin oikealla puolella oleva ⚙️ → View raw logs). Normaalinäkymässä JSON-vastaukset eivät näy kokonaan.
4. Etsi JSON-riveiltä `"id":"customfield_XXXXX"` — sieltä löytyvät luotujen kenttien ID:t.

**Huom:** Jira Cloud Automationissa ei ole Secrets-manageria (vain Data Center). GitHub PAT tallennetaan Automation-sääntöjen HTTP-toimintojen Authorization-headeriin suoraan (selväkielinen, hyväksytty riski pienessä tiimissä).

---

### Vaihe 2: GitHub for Atlassian -app (✅ Valmis)

**App on asennettu ja yhdistetty Jira-instanssiin `uutisseuranta.atlassian.net`.**

Varmistettu admin-konsolista:
- Sijainti: [https://admin.atlassian.com/s/38191fa4-e340-4d5e-8f7d-33c8f6829dbd/user-connected-apps/tab/installed](https://admin.atlassian.com/s/38191fa4-e340-4d5e-8f7d-33c8f6829dbd/user-connected-apps/tab/installed)
- Status: **Connected** `uutisseuranta.atlassian.net`
- Luvat: READ, WRITE, DELETE Jiraan
- Ulkoinen domain: `github.atlassian.com` (pakollinen appin toiminnalle)
- Marketplace-sivu: [https://marketplace.atlassian.com/apps/1219592/github-for-atlassian](https://marketplace.atlassian.com/apps/1219592/github-for-atlassian)

> **Huom MCP-serverien rajoituksesta:** GitHub for Atlassian -appin asennus ja repojen liittäminen vaatii OAuth-pohjaisen selainvirtauksen. Sitä ei voi tehdä REST API:lla tai MCP-serverien kautta — tehdään kerran käsin käyttöliittymässä.

#### Repojen liittäminen Jiraan (tehtävä käsin)

Tämä yhdistää kehityspaneelin (branchit, commitit, PR:t) Jira-ticketteihin.

1. Jirassa: **Apps → Manage apps → GitHub for Jira → Configure**
   - Tai suoraan: [https://uutisseuranta.atlassian.net/jira/settings/apps/github](https://uutisseuranta.atlassian.net/jira/settings/apps/github)
2. Klikkaa **Connect GitHub organization**
3. Kirjaudu GitHubiin ja valitse organisaatio `uutisseuranta`
4. Valitse **Only select repositories** ja lisää kaikki kolme repoa:
   - `uutisseuranta/uutisseuranta.github.io`
   - `uutisseuranta/patterns`
   - `uutisseuranta/bq-activitystreams`
5. Klikkaa **Save** ja hyväksy luvat

**Uusien repojen lisääminen myöhemmin:**
1. Jirassa: **Apps → Manage apps → GitHub for Jira → Configure**
2. Etsi organisaatio `uutisseuranta` → klikkaa **…** → **Configure**
3. GitHub avautuu: **Repository access → Select repositories** → lisää repo → **Save**

**Kehityspaneelin linkitys issueihin:**

Kun repot on liitetty, branchit, commitit ja PR:t linkittyvät Jira-ticketteihin automaattisesti kun branch- tai commit-nimessä on Jira-avain:
```
git checkout -b US-42-feat-like-button
git commit -m "US-42 add like button to article view"
```

---

### GitHub-labelit (kaikki kolme repoa)

Labelit luodaan automaattisesti GitHub Actionilla kun `.github/labels.yml` muuttuu, tai manuaalisesti `workflow_dispatch`-triggerillä.

**Luodut labelit:**

| Label | Väri | Kuvaus |
|---|---|---|
| `priority:highest` | `#b71c1c` | Jira: Highest |
| `priority:high` | `#e53935` | Jira: High |
| `priority:medium` | `#fb8c00` | Jira: Medium |
| `priority:low` | `#81c784` | Jira: Low |
| `priority:lowest` | `#b0bec5` | Jira: Lowest |
| `sprint:1` … `sprint:5` | `#5c6bc0` | Jira Sprint N |
| `status:to-do` | `#eceff1` | Jira: To Do |
| `status:in-progress` | `#f9a825` | Jira: In Progress |
| `status:in-review` | `#0288d1` | Jira: In Review |
| `status:done` | `#388e3c` | Jira: Done |

**Aktivointi (kertaluonteinen jokaiselle repolle):**
1. Siirry Actions-välilehdelle halutussa repossa
2. Valitse **Sync Labels** -workflow
3. Klikkaa **Run workflow**

---

## Arkkitehtuurilinja

**Malli: Jira ensisijaisena, GitHub masterina.**

- **GitHub** on sisällön master: otsikko, body, labelit, milestone, PR:t, source-identiteetti.
- **Jira** on työnhallinnan master: status, prioriteetti, assignee, sprint, workflow.
- Kaikki kolme repositoriota (`uutisseuranta.github.io`, `patterns`, `bq-activitystreams`) ovat lähteitä.
- Sub-issueita ei käytetä. Ristikkäisviittaukset toteutetaan Jira issue link -tyypeillä.
- Natiivi **GitHub for Atlassian** -app hoitaa kehityspaneelin (branchit, commitit, PR:t) — sitä ei korvata.
- Issue-synkronointi rakennetaan **Atlassian Automation** -sääntöinä (15 sääntöä).
- **Jira Cloud Automationissa ei ole Secrets-manageria** — GitHub PAT tallennetaan suoraan HTTP-toiminnon headeriin.

---

## Tietomalli

### Jira custom -kentät (luotu projektiin)

| Kenttä | Field ID | Tyyppi | Kuvaus |
|---|---|---|---|
| `source_repo` | `customfield_10071` | Text | `uutisseuranta.github.io` / `patterns` / `bq-activitystreams` |
| `github_issue_number` | `customfield_10072` | Number | GitHub issue number (esim. `42`) |
| `github_url` | `customfield_10073` | URL | Suora linkki GitHub-issueen |

### Kenttäkohtainen synkronointi

| # | Kenttä | GitHub-vastine | Jira-vastine | Jira Field ID | Auktoriteetti | GitHub → Jira | Jira → GitHub | Konfliktiresoluutio |
|---|---|---|---|---|---|---|---|---|
| 1 | Otsikko | `title` | `summary` | (natiivi) | GitHub | ✅ | ✅ | Uudempi `updated_at` voittaa |
| 2 | Kuvaus | `body` (Markdown) | `description` (plain text) | (natiivi) | GitHub | ✅ | ✅ | GitHub voittaa; Markdown säilyy plain textinä Jirassa |
| 3 | Tila | `state` (open/closed) | `status` (workflow) | (natiivi) | Jira | ✅ open→To Do, closed→Done | ✅ Done→close, muut→open+label | Jira-status on master |
| 4 | Assignee | `assignees[]` | `assignee` | (natiivi) | Jira | ✅ | ✅ | Jira voittaa |
| 5 | Labelit | `labels[]` | `labels[]` | (natiivi) | GitHub | ✅ luo uudet Jiraan | ✅ unioni molempiin | Ei ylikirjoiteta; lisätään puuttuvat |
| 6 | Prioriteetti | label `priority:*` | `priority` | (natiivi) | Jira | ✅ label→Jira priority | ✅ Jira priority→GitHub label | Jira voittaa |
| 7 | Milestone | `milestone.title` + `due_on` | `fixVersions` | (natiivi) | GitHub | ✅ | ✅ luo tarvittaessa | Nimet identtiset; GitHub on master |
| 8 | Sprint / Iteration | label `sprint:N` | `sprint` (Scrum) | (natiivi) | Jira | ⛔ ei lähdettä | ✅ Jira sprint→GitHub label | Jira on ainoa auktoriteetti |
| 9 | Pull Request | PR-numero, branch, status | `development`-kenttä | (natiivi) | GitHub | ✅ natiivi GitHub for Atlassian | ⛔ | Natiivi kattaa |
| 10 | Kommentit | `comments[]` | `comments[]` | (natiivi) | Molemmat | ✅ `[GitHub] @user:` -etuliite | ✅ `[Jira] user:` -etuliite | Ei koskaan ylikirjoiteta; aina uusi kommentti |
| 11 | Sulkemisen syy | `state_reason` | `resolution` | (natiivi) | Jira | ✅ | ✅ Fixed/Won't Do/Duplicate | Jira voittaa |
| 12 | Source repo | repo-nimi | `source_repo` | `customfield_10071` | GitHub (vain luku) | ✅ kirjoitetaan luonnissa | ⛔ | Ei muutu koskaan |
| 13 | Source issue # | `number` | `github_issue_number` | `customfield_10072` | GitHub (vain luku) | ✅ kirjoitetaan luonnissa | ⛔ | Ei muutu koskaan |
| 14 | Source URL | `html_url` | `github_url` | `customfield_10073` | GitHub (vain luku) | ✅ kirjoitetaan luonnissa | ⛔ | Ei muutu koskaan |
| 15 | Luontiaika | `created_at` | `created` | (natiivi) | GitHub | ✅ asetetaan kerran | ⛔ | Ei muutu |
| 16 | Päivitysaika | `updated_at` | `updated` | (natiivi) | Molemmat | ✅ käytetään konfliktin ratkaisuun | ✅ | Uudempi voittaa |

### Issuetype-mapaus

| GitHub-label | Jira issuetype |
|---|---|
| `feat`, `enhancement` | Story |
| `bug` | Bug |
| `chore`, `docs`, `refactor`, `test` | Task |
| `arch`, `sec` | Task (tai Epic jos laajuus vaatii) |
| ei labelia | Task (oletus) |

---

## Atlassian Automation -säännöt

### Edellytykset

- GitHub for Atlassian -app asennettuna ja repot liitettynä (Vaihe 2). ✅
- GitHub PAT tallennettu suoraan Automation-sääntöjen HTTP-toiminnon Authorization-headeriin (Jira Cloud ei tue Secrets-manageria).
- Kolme custom-kenttää luotuna Jira-projektiin: `customfield_10071`, `customfield_10072`, `customfield_10073`. ✅
- GitHub-repositorioihin luotu webhook Atlassian Automation incoming webhook -URL:iin, events: `Issues`, `Issue comments`.

### Silmukan esto (kaikki säännöt)

Kommenttisäännöissä tarkistetaan etuliite: ei prosessoida kommenttia joka alkaa `[GitHub]` tai `[Jira]`. Teksti/otsikko-päivityssäännöissä käytetään **5 sekunnin ikkunaa**: jos Jira `updated`-aika ja webhook-aikaleima ovat alle 5 s erossa, ohitetaan päivitys.

---

### GitHub → Jira -säännöt (8 sääntöä)

#### Sääntö 1 — Uusi GitHub-issue → luo Jira-ticket

```
Triggeri:   Incoming webhook — issues.opened
Ehto:       JQL-haku: cf[10072] = {{webhookData.issue.number}}
            AND cf[10071] = "{{webhookData.repository.name}}"
            → jos löytyy: ohita (idempotentti)
            → jos ei löydy: jatka
Toiminto:   Create issue
  summary:          {{webhookData.issue.title}}
  description:      {{webhookData.issue.body}}
  issuetype:        [mapaus label-kentästä, ks. taulukko]
  labels:           {{webhookData.issue.labels[*].name}}
  assignee:         {{webhookData.issue.assignee.login}}
  fixVersions:      {{webhookData.issue.milestone.title}} (luo jos puuttuu)
  customfield_10071: {{webhookData.repository.name}}
  customfield_10072: {{webhookData.issue.number}}
  customfield_10073: {{webhookData.issue.html_url}}
```

#### Sääntö 2 — Otsikko tai body muuttuu → päivitä Jira

```
Triggeri:   Incoming webhook — issues.edited
Ehto:       webhookData.changes.title TAI webhookData.changes.body on mukana
            + JQL-haku löytää olemassa olevan ticketin
Toiminto:   Edit issue
  summary:        {{webhookData.issue.title}}
  description:    {{webhookData.issue.body}}
Silmukan esto: tarkista 5 s -ikkuna
```

#### Sääntö 3 — GitHub-issue suljetaan → siirrä Jira Done

```
Triggeri:   Incoming webhook — issues.closed
Ehto:       JQL-haku löytää ticketin
Toiminto 1: Transition issue → Done
Toiminto 2: Edit issue
  resolution: completed → "Fixed"
              not_planned → "Won't Do"
              duplicate → "Duplicate"
```

#### Sääntö 4 — GitHub-issue avataan uudelleen → siirrä Jira To Do

```
Triggeri:   Incoming webhook — issues.reopened
Ehto:       JQL-haku löytää ticketin
Toiminto:   Transition issue → To Do
```

#### Sääntö 5 — Labelit muuttuvat → synkronoi Jira

```
Triggeri:   Incoming webhook — issues.labeled + issues.unlabeled
Ehto:       JQL-haku löytää ticketin
Toiminto 1: Edit issue — labels: {{webhookData.issue.labels[*].name}}
Toiminto 2: Jos label alkaa "priority:"
  → Edit issue — priority: high/medium/low/lowest mapauksen mukaan
```

#### Sääntö 6 — Assignee muuttuu → päivitä Jira

```
Triggeri:   Incoming webhook — issues.assigned + issues.unassigned
Ehto:       JQL-haku löytää ticketin
Toiminto:   Edit issue — assignee: {{webhookData.issue.assignee.login}}
            (unassigned: tyhjennä assignee)
```

#### Sääntö 7 — Milestone muuttuu → päivitä fixVersion

```
Triggeri:   Incoming webhook — issues.milestoned + issues.demilestoned
Ehto:       JQL-haku löytää ticketin
Toiminto:   Edit issue — fixVersions: {{webhookData.issue.milestone.title}}
            Jos versiota ei ole: HTTP POST /rest/api/3/version
            {"name": "{{webhookData.issue.milestone.title}}",
             "releaseDate": "{{webhookData.issue.milestone.due_on}}",
             "projectId": "{{project.id}}"}
```

#### Sääntö 8 — Uusi GitHub-kommentti → lisää Jira-kommentti

```
Triggeri:   Incoming webhook — issue_comment.created
Ehto:       JQL-haku löytää ticketin
            + kommentti EI ala "[Jira]" (silmukan esto)
Toiminto:   Add comment
  body: "[GitHub] @{{webhookData.comment.user.login}}: {{webhookData.comment.body}}"
```

---

### Jira → GitHub -säännöt (7 sääntöä)

Kaikkien HTTP-toimintojen URL-pohja: `https://api.github.com/repos/uutisseuranta/{{issue.customfield_10071}}/issues/{{issue.customfield_10072}}`

Autentikointi: `Authorization: Bearer <GitHub PAT>` (tallennettu suoraan säännön headeriin)

#### Sääntö 9 — Jira-status muuttuu → päivitä GitHub

```
Triggeri:   Issue transitioned
Ehto:       customfield_10072-kenttä ei ole tyhjä
Toiminto:   HTTP PATCH [URL]
  Jos uusi status = Done:
    body: {"state": "closed", "state_reason": "completed"}
  Muuten:
    body: {"state": "open"}
  + HTTP POST [URL]/labels
    body: {"labels": ["status:{{newStatus.name.toLowerCase}}"]}
  (poista ensin vanhat status:* -labelit)
```

#### Sääntö 10 — Jira-assignee muuttuu → päivitä GitHub

```
Triggeri:   Issue assigned / unassigned
Ehto:       customfield_10072-kenttä ei ole tyhjä
Toiminto:   HTTP PATCH [URL]
  body: {"assignees": ["{{issue.assignee.name}}"]}
  (unassigned: {"assignees": []})
```

#### Sääntö 11 — Jira-prioriteetti muuttuu → päivitä GitHub-label

```
Triggeri:   Field value changed — priority
Ehto:       customfield_10072-kenttä ei ole tyhjä
Toiminto 1: HTTP DELETE [URL] poista vanhat priority:* -labelit
Toiminto 2: HTTP POST [URL]/labels
  body: {"labels": ["priority:{{issue.priority.name.toLowerCase}}"]}
```

#### Sääntö 12 — Jira-sprint alkaa tai issue siirtyy sprinttiin → aseta GitHub-label

```
Triggeri:   Sprint started + Issue moved to sprint
Ehto:       customfield_10072-kenttä ei ole tyhjä
Toiminto 1: HTTP DELETE [URL] poista vanhat sprint:* -labelit
Toiminto 2: HTTP POST [URL]/labels
  body: {"labels": ["sprint:{{sprint.name}}"]}
```

#### Sääntö 13 — Jira-summary muuttuu → päivitä GitHub-otsikko

```
Triggeri:   Field value changed — summary
Ehto:       customfield_10072-kenttä ei ole tyhjä
            + 5 s silmukan esto
Toiminto:   HTTP PATCH [URL]
  body: {"title": "{{issue.summary}}"}
```

#### Sääntö 14 — Uusi Jira-kommentti → lisää GitHub-kommentti

```
Triggeri:   Comment added
Ehto:       customfield_10072-kenttä ei ole tyhjä
            + kommentti EI ala "[GitHub]" (silmukan esto)
Toiminto:   HTTP POST [URL]/comments
  body: {"body": "[Jira] {{comment.author.displayName}}: {{comment.body}}"}
```

#### Sääntö 15 — fixVersion muuttuu → päivitä GitHub-milestone

```
Triggeri:   Field value changed — fixVersions
Ehto:       customfield_10072-kenttä ei ole tyhjä
Toiminto 1: HTTP GET https://api.github.com/repos/uutisseuranta/{{issue.customfield_10071}}/milestones
            → hae milestone-numero nimellä {{issue.fixVersions[0].name}}
Toiminto 2: Jos löytyy:
              HTTP PATCH [URL] body: {"milestone": {{milestoneNumber}}}
            Jos ei löydy:
              HTTP POST .../milestones body: {"title": "{{issue.fixVersions[0].name}}"}
              → käytä palautettu numero
```

---

## Toteutusjärjestys

1. **Vaihe 1** — Luo custom-kentät Jira-projektiin ✅
2. **Vaihe 2** — Asenna GitHub for Atlassian ja liitä repot ✅
3. **Vaihe 3** — Lisää GitHub PAT Automation-sääntöjen HTTP-toimintojen Authorization-headeriin
4. **Vaihe 4** — Luo GitHub-webhookit kaikille kolmelle repolle (events: Issues, Issue comments)
5. **Vaihe 5** — Rakenna Säännöt 1–8 (GitHub → Jira)
6. **Vaihe 6** — Rakenna Säännöt 9–15 (Jira → GitHub)
7. **Vaihe 7** — Testaa sääntö 1 manuaalisesti yhdellä testiissuella, tarkista idempotenttius
8. **Vaihe 8** — Aja kertaluonteinen backfill-ajo kaikille olemassa oleville avoimille issueille

---

## Rajoitukset ja hyväksytyt kompromissit

| Rajoitus | Päätös |
|---|---|
| Markdown → ADF-konversio | Hyväksytty: body tallennetaan Jiraan plain textinä ilman muotoilua |
| Sub-issues | Kielletty; ristikkäisviittaukset Jira issue link -tyypeillä |
| Sprint → GitHub natiivikäsite | Hyväksytty: sprint näkyy GitHubissa vain labelina `sprint:N` |
| Jira Cloud: ei Secrets-manageria Automationissa | Hyväksytty: GitHub PAT kovakoodattu HTTP-headeriin (pieni suljettu tiimi) |
| Konfliktiresoluutio monimutkaisissa tapauksissa | Yksinkertainen sääntö: uudempi `updated_at` voittaa + 5 s silmukkaikkuna |
| Jira-käyttäjä ≠ GitHub-käyttäjä | Ensimmäisessä vaiheessa käyttäjätunnusten pitää vastata toisiaan; myöhemmin voidaan rakentaa user-mapping-taulukko |
| GitHub for Atlassian -asennus ja repojen liittäminen | Ei voi automatisoida MCP-serverillä tai REST API:lla — vaatii kertaluonteisen OAuth-virtauksen selaimessa |
