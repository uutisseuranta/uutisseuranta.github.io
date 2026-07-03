# Jira–GitHub Integration

Tämä dokumentti kuvaa **uutisseuranta**-projektin Jira–GitHub-integraation designin, tietomallin ja Atlassian Automation -säännöt. Lähde: suunnittelukeskustelu 2026-07-03.

---

## Toteutusstatus

| Vaihe | Kuvaus | Status | Toteutettu |
|---|---|---|---|
| 1 | Luo custom-kentät Jira-projektiin (`source_repo`, `github_issue_number`, `github_url`) | ✅ Valmis | 2026-07-03 |
| 2 | Asenna GitHub for Atlassian -app ja liitä repot | ✅ Valmis | 2026-07-03 |
| 3 | Tallenna GitHub PAT Atlassian Automation -säännön HTTP-headeriin | ✅ Valmis | 2026-07-03 |
| 4 | Luo org-tason GitHub-webhook Atlassian Automation incoming webhook -URL:iin | ✅ Valmis | 2026-07-03 |
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

---

### Vaihe 2: GitHub for Atlassian -app (✅ Valmis)

**App on asennettu ja GitHub-organisaatio `uutisseuranta` on yhdistetty — kaikki repot mukana.**

- App-sivu: https://uutisseuranta.atlassian.net/plugins/servlet/ac/com.github.integration.production/spa-index-page — näyttää: **"uutisseuranta is now connected! All repos connected"**
- App key: `com.github.integration.production`

**Kehityspaneelin linkitys issueihin** — branch-nimeämiskonventio:
```
git checkout -b US-42-feat-like-button
git commit -m "US-42 add like button to article view"
```

---

### Vaihe 3: GitHub PAT (✅ Valmis)

- PAT tyyppi: Fine-grained token
- Resource owner: organisaatio `uutisseuranta`
- Repository access: All repositories
- Permissions: Issues (Read and write), Metadata (Read)
- PAT tallennetaan **suoraan** Jira Automation -sääntöjen HTTP-toimintojen `Authorization: Bearer <token>` -headeriin (Jira Cloud ei tue Secrets-manageria Automationissa — hyväksytty riski pienessä tiimissä)

---

### Vaihe 4: GitHub org-webhook (✅ Valmis)

**Atlassian Automation incoming webhook URL:**
```
https://api-private.atlassian.com/automation/webhooks/jira/a/042ceae5-c99b-4174-9d44-46a2d26e9c05/019f2870-7e40-75d0-b576-f1297467d719
```

**Org-webhook konfiguraatio** (GitHub → Jira suunta):
- URL: yllä oleva Atlassian Automation webhook URL
- Content type: `application/json`
- Events: `Issues`, `Issue comments`
- Scope: organisaatio `uutisseuranta` — kattaa kaikki repot automaattisesti

> **Huom autentikoinnista:** GitHub-org-webhook ei tue custom headerien lisäämistä käyttöliittymässä. Jira-sääntö ei tarkista GitHub HMAC-signatuuria ensimmäisessä vaiheessa — URL yksin on riittävä suoja pienessä projektissa. Voidaan lisätä myöhemmin jos tarvitaan.

> **Huom flow actorista:** Atlassian Automation näyttää virheen `ADD_COMMENTS (Spaces 10000)` jos flow actor on "Automation for Jira" -järjestelmäkäyttäjä jolla ei ole projektin oikeuksia. Ratkaisu: vaihda jokaisen säännön flow actor käyttäjäksi **Jaakko Korhonen** (Space settings → Automation → sääntö → kolme pistettä → Actor).

---

### GitHub-labelit (kaikki kolme repoa)

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

---

## Arkkitehtuurilinja

**Malli: Jira ensisijaisena, GitHub masterina.**

- **GitHub** on sisällön master: otsikko, body, labelit, milestone, PR:t, source-identiteetti.
- **Jira** on työnhallinnan master: status, prioriteetti, assignee, sprint, workflow.
- Kaikki kolme repositoriota (`uutisseuranta.github.io`, `patterns`, `bq-activitystreams`) ovat lähteitä.
- Sub-issueita ei käytetä. Ristikkäisviittaukset toteutetaan Jira issue link -tyypeillä.
- Natiivi **GitHub for Atlassian** -app hoitaa kehityspaneelin (branchit, commitit, PR:t).
- Issue-synkronointi rakennetaan **Atlassian Automation** -sääntöinä (15 sääntöä).

---

## Tietomalli

### Jira custom -kentät

| Kenttä | Field ID | Tyyppi | Kuvaus |
|---|---|---|---|
| `source_repo` | `customfield_10071` | Text | `uutisseuranta.github.io` / `patterns` / `bq-activitystreams` |
| `github_issue_number` | `customfield_10072` | Number | GitHub issue number (esim. `42`) |
| `github_url` | `customfield_10073` | URL | Suora linkki GitHub-issueen |

### Kenttäkohtainen synkronointi

| # | Kenttä | GitHub-vastine | Jira-vastine | Jira Field ID | Auktoriteetti | GitHub → Jira | Jira → GitHub | Konfliktiresoluutio |
|---|---|---|---|---|---|---|---|---|
| 1 | Otsikko | `title` | `summary` | (natiivi) | GitHub | ✅ | ✅ | Uudempi `updated_at` voittaa |
| 2 | Kuvaus | `body` (Markdown) | `description` (plain text) | (natiivi) | GitHub | ✅ | ✅ | GitHub voittaa |
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

- GitHub for Atlassian -app asennettuna ja org `uutisseuranta` liitettynä, kaikki repot mukana. ✅
- GitHub PAT tallennettu suoraan Automation-sääntöjen HTTP-toiminnon Authorization-headeriin. ✅
- Kolme custom-kenttää luotuna: `customfield_10071`, `customfield_10072`, `customfield_10073`. ✅
- Org-tason GitHub-webhook luotu, events: `Issues`, `Issue comments`. ✅
- **Flow actor:** vaihdetaan jokaiseen sääntöön käyttäjäksi `Jaakko Korhonen` (ei "Automation for Jira").

### Silmukan esto (kaikki säännöt)

- **Kommentit:** ei prosessoida kommenttia joka alkaa `[GitHub]` tai `[Jira]`
- **Teksti/otsikko:** 5 sekunnin ikkuna — jos Jira `updated`-aika ja webhook-aikaleima ovat alle 5 s erossa, ohitetaan päivitys

---

### GitHub → Jira -säännöt (8 sääntöä)

#### Sääntö 1 — Uusi GitHub-issue → luo Jira-ticket

```
Triggeri:   Incoming webhook — issues.opened
Ehto:       JQL: project = US AND cf[10072] = "{{webhookData.issue.number}}"
                 AND cf[10071] = "{{webhookData.repository.name}}"
            → jos löytyy: ohita (idempotentti)
            → jos ei löydy: jatka
Toiminto:   Create issue
  summary:           {{webhookData.issue.title}}
  description:       {{webhookData.issue.body}}
  issuetype:         mapaus label-kentästä (ks. taulukko), oletus Task
  labels:            {{webhookData.issue.labels[*].name}}
  assignee:          {{webhookData.issue.assignee.login}}
  fixVersions:       {{webhookData.issue.milestone.title}}
  customfield_10071: {{webhookData.repository.name}}
  customfield_10072: {{webhookData.issue.number}}
  customfield_10073: {{webhookData.issue.html_url}}
```

#### Sääntö 2 — Otsikko tai body muuttuu → päivitä Jira

```
Triggeri:   Incoming webhook — issues.edited
Ehto:       webhookData.changes.title TAI webhookData.changes.body on mukana
            + JQL löytää olemassa olevan ticketin
            + 5 s silmukan esto
Toiminto:   Edit issue
  summary:     {{webhookData.issue.title}}
  description: {{webhookData.issue.body}}
```

#### Sääntö 3 — GitHub-issue suljetaan → siirrä Jira Done

```
Triggeri:   Incoming webhook — issues.closed
Ehto:       JQL löytää ticketin
Toiminto 1: Transition issue → Done
Toiminto 2: Edit issue — resolution:
              completed   → "Fixed"
              not_planned → "Won't Do"
              duplicate   → "Duplicate"
```

#### Sääntö 4 — GitHub-issue avataan uudelleen → siirrä Jira To Do

```
Triggeri:   Incoming webhook — issues.reopened
Ehto:       JQL löytää ticketin
Toiminto:   Transition issue → To Do
```

#### Sääntö 5 — Labelit muuttuvat → synkronoi Jira

```
Triggeri:   Incoming webhook — issues.labeled + issues.unlabeled
Ehto:       JQL löytää ticketin
Toiminto 1: Edit issue — labels: {{webhookData.issue.labels[*].name}}
Toiminto 2: Jos label alkaa "priority:" →
            Edit issue — priority: mapauksen mukaan
              priority:highest → Highest
              priority:high    → High
              priority:medium  → Medium
              priority:low     → Low
              priority:lowest  → Lowest
```

#### Sääntö 6 — Assignee muuttuu → päivitä Jira

```
Triggeri:   Incoming webhook — issues.assigned + issues.unassigned
Ehto:       JQL löytää ticketin
Toiminto:   Edit issue — assignee: {{webhookData.issue.assignee.login}}
            (unassigned: tyhjennä assignee)
```

#### Sääntö 7 — Milestone muuttuu → päivitä fixVersion

```
Triggeri:   Incoming webhook — issues.milestoned + issues.demilestoned
Ehto:       JQL löytää ticketin
Toiminto:   Edit issue — fixVersions: {{webhookData.issue.milestone.title}}
            Jos versiota ei ole Jirassa:
              HTTP POST /rest/api/3/version
              {"name": "{{webhookData.issue.milestone.title}}",
               "releaseDate": "{{webhookData.issue.milestone.due_on}}",
               "projectId": "{{project.id}}"}
```

#### Sääntö 8 — Uusi GitHub-kommentti → lisää Jira-kommentti

```
Triggeri:   Incoming webhook — issue_comment.created
Ehto:       JQL löytää ticketin
            + kommentti EI ala "[Jira]" (silmukan esto)
Toiminto:   Add comment
  body: "[GitHub] @{{webhookData.comment.user.login}}: {{webhookData.comment.body}}"
```

---

### Jira → GitHub -säännöt (7 sääntöä)

**URL-pohja kaikille HTTP-toiminnoille:**
```
https://api.github.com/repos/uutisseuranta/{{issue.customfield_10071}}/issues/{{issue.customfield_10072}}
```

**Autentikointi jokaisessa HTTP-toiminnossa:**
```
Authorization: Bearer <GitHub PAT>
Content-Type: application/json
```

#### Sääntö 9 — Jira-status muuttuu → päivitä GitHub

```
Triggeri:   Issue transitioned
Ehto:       customfield_10072 ei ole tyhjä
Toiminto 1: HTTP PATCH [URL-pohja]
            Jos uusi status = Done:
              {"state": "closed", "state_reason": "completed"}
            Muuten:
              {"state": "open"}
Toiminto 2: Poista vanhat status:* -labelit
              HTTP DELETE [URL-pohja]/labels/status:to-do (tai nykyinen)
Toiminto 3: Lisää uusi status-label
              HTTP POST [URL-pohja]/labels
              {"labels": ["status:{{issue.status.name.toLowerCase.replace(' ', '-')}}"]}
```

#### Sääntö 10 — Jira-assignee muuttuu → päivitä GitHub

```
Triggeri:   Issue assigned / unassigned
Ehto:       customfield_10072 ei ole tyhjä
Toiminto:   HTTP PATCH [URL-pohja]
            {"assignees": ["{{issue.assignee.name}}"]}
            (unassigned: {"assignees": []})
```

#### Sääntö 11 — Jira-prioriteetti muuttuu → päivitä GitHub-label

```
Triggeri:   Field value changed — priority
Ehto:       customfield_10072 ei ole tyhjä
Toiminto 1: HTTP DELETE vanhat priority:* -labelit
Toiminto 2: HTTP POST [URL-pohja]/labels
            {"labels": ["priority:{{issue.priority.name.toLowerCase}}"]}
```

#### Sääntö 12 — Issue siirtyy sprinttiin → aseta GitHub-label

```
Triggeri:   Issue moved to sprint
Ehto:       customfield_10072 ei ole tyhjä
Toiminto 1: HTTP DELETE vanhat sprint:* -labelit
Toiminto 2: HTTP POST [URL-pohja]/labels
            {"labels": ["sprint:{{sprint.name}}"]}
```

#### Sääntö 13 — Jira-summary muuttuu → päivitä GitHub-otsikko

```
Triggeri:   Field value changed — summary
Ehto:       customfield_10072 ei ole tyhjä
            + 5 s silmukan esto
Toiminto:   HTTP PATCH [URL-pohja]
            {"title": "{{issue.summary}}"}
```

#### Sääntö 14 — Uusi Jira-kommentti → lisää GitHub-kommentti

```
Triggeri:   Comment added
Ehto:       customfield_10072 ei ole tyhjä
            + kommentti EI ala "[GitHub]" (silmukan esto)
Toiminto:   HTTP POST [URL-pohja]/comments
            {"body": "[Jira] {{comment.author.displayName}}: {{comment.body}}"}
```

#### Sääntö 15 — fixVersion muuttuu → päivitä GitHub-milestone

```
Triggeri:   Field value changed — fixVersions
Ehto:       customfield_10072 ei ole tyhjä
Toiminto 1: HTTP GET https://api.github.com/repos/uutisseuranta/{{issue.customfield_10071}}/milestones
            → etsi milestone nimellä {{issue.fixVersions[0].name}}
Toiminto 2: Jos löytyy:
              HTTP PATCH [URL-pohja] {"milestone": <numero>}
            Jos ei löydy:
              HTTP POST .../milestones {"title": "{{issue.fixVersions[0].name}}"}
              → käytä palautettu numero PATCH-kutsussa
```

---

## Toteutusjärjestys

| # | Vaihe | Status |
|---|---|---|
| 1 | Luo custom-kentät Jira-projektiin | ✅ Valmis |
| 2 | Asenna GitHub for Atlassian, liitä org `uutisseuranta` | ✅ Valmis |
| 3 | Luo GitHub PAT (org-taso, all repos, Issues read+write) | ✅ Valmis |
| 4 | Luo org-tason GitHub-webhook → Atlassian Automation URL | ✅ Valmis |
| 5 | Rakenna Säännöt 1–8 (GitHub → Jira), flow actor = Jaakko Korhonen | ⏳ Seuraava |
| 6 | Rakenna Säännöt 9–15 (Jira → GitHub), lisää PAT headereihin | ⏳ Odottaa |
| 7 | Testaa sääntö 1 manuaalisesti, tarkista idempotenttius | ⏳ Odottaa |
| 8 | Backfill-ajo kaikille olemassa oleville avoimille issueille | ⏳ Odottaa |

---

## Rajoitukset ja hyväksytyt kompromissit

| Rajoitus | Päätös |
|---|---|
| Markdown → ADF-konversio | Hyväksytty: body tallennetaan Jiraan plain textinä |
| Sub-issues | Kielletty; ristikkäisviittaukset Jira issue link -tyypeillä |
| Sprint → GitHub natiivikäsite | Hyväksytty: sprint näkyy GitHubissa vain labelina `sprint:N` |
| Jira Cloud: ei Secrets-manageria Automationissa | Hyväksytty: GitHub PAT headeriin (pieni suljettu tiimi) |
| Konfliktiresoluutio | Uudempi `updated_at` voittaa + 5 s silmukkaikkuna |
| Jira-käyttäjä ≠ GitHub-käyttäjä | Vaiheessa 1: tunnusten pitää vastata toisiaan; myöhemmin user-mapping-taulukko |
| Flow actor -virhe `ADD_COMMENTS` | Vaihda actor "Automation for Jira" → "Jaakko Korhonen" jokaisessa säännössä |
| GitHub-org-webhook: ei custom headereja UI:sta | Jira-sääntö ei tarkista HMAC-signatuuria — URL riittää pienessä projektissa |
