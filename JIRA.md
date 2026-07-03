# Jira–GitHub Integration

Tämä dokumentti kuvaa **uutisseuranta**-projektin Jira–GitHub-integraation designin, tietomallin ja Atlassian Automation -säännöt. Lähde: suunnittelukeskustelu 2026-07-03.

---

## Arkkitehtuurilinja

**Malli: Jira ensisijaisena, GitHub masterina.**

- **GitHub** on sisällön master: otsikko, body, labelit, milestone, PR:t, source-identiteetti.
- **Jira** on työnhallinnan master: status, prioriteetti, assignee, sprint, workflow.
- Kaikki kolme repositoriota (`uutisseuranta.github.io`, `patterns`, `bq-activitystreams`) ovat lähteitä.
- Sub-issueita ei käytetä. Ristikkäisviittaukset toteutetaan Jira issue link -tyypeillä.
- Natiivi **GitHub for Atlassian** -app (`com.github.integration.production`) hoitaa kehityspaneelin (branchit, commitit, PR:t, buildit, deploymentit) — sitä ei korvata.
- Issue-synkronointi rakennetaan **Atlassian Automation** -sääntöinä (15 sääntöä).

---

## Tietomalli

### Jira custom -kentät (luotava projektiin)

| Kenttä | Tyyppi | Kuvaus |
|---|---|---|
| `source_repo` | Text | `uutisseuranta.github.io` / `patterns` / `bq-activitystreams` |
| `github_issue_number` | Number | GitHub issue number (esim. `42`) |
| `github_url` | URL | Suora linkki GitHub-issueen |

### Kenttäkohtainen synkronointi

| # | Kenttä | GitHub-vastine | Jira-vastine | Auktoriteetti | GitHub → Jira | Jira → GitHub | Konfliktiresoluutio |
|---|---|---|---|---|---|---|---|
| 1 | Otsikko | `title` | `summary` | GitHub | ✅ | ✅ | Uudempi `updated_at` voittaa |
| 2 | Kuvaus | `body` (Markdown) | `description` (plain text) | GitHub | ✅ | ✅ | GitHub voittaa; Markdown säilyy plain textinä Jirassa |
| 3 | Tila | `state` (open/closed) | `status` (workflow) | Jira | ✅ open→To Do, closed→Done | ✅ Done→close, muut→open+label | Jira-status on master |
| 4 | Assignee | `assignees[]` | `assignee` | Jira | ✅ | ✅ | Jira voittaa |
| 5 | Labelit | `labels[]` | `labels[]` | GitHub | ✅ luo uudet Jiraan | ✅ unioni molempiin | Ei ylikirjoiteta; lisätään puuttuvat |
| 6 | Prioriteetti | label `priority:*` | `priority` | Jira | ✅ label→Jira priority | ✅ Jira priority→GitHub label | Jira voittaa |
| 7 | Milestone | `milestone.title` + `due_on` | `fixVersions` | GitHub | ✅ | ✅ luo tarvittaessa | Nimet identtiset; GitHub on master |
| 8 | Sprint / Iteration | label `sprint:N` | `sprint` (Scrum) | Jira | ⛔ ei lähdettä | ✅ Jira sprint→GitHub label | Jira on ainoa auktoriteetti |
| 9 | Pull Request | PR-numero, branch, status | `development`-kenttä | GitHub | ✅ natiivi GitHub for Atlassian | ⛔ | Natiivi kattaa |
| 10 | Kommentit | `comments[]` | `comments[]` | Molemmat | ✅ `[GitHub] @user:` -etuliite | ✅ `[Jira] user:` -etuliite | Ei koskaan ylikirjoiteta; aina uusi kommentti |
| 11 | Sulkemisen syy | `state_reason` | `resolution` | Jira | ✅ | ✅ Fixed/Won't Do/Duplicate | Jira voittaa |
| 12 | Source repo | repo-nimi | `source_repo` (custom) | GitHub (vain luku) | ✅ kirjoitetaan luonnissa | ⛔ | Ei muutu koskaan |
| 13 | Source issue # | `number` | `github_issue_number` (custom) | GitHub (vain luku) | ✅ kirjoitetaan luonnissa | ⛔ | Ei muutu koskaan |
| 14 | Source URL | `html_url` | `github_url` (custom) | GitHub (vain luku) | ✅ kirjoitetaan luonnissa | ⛔ | Ei muutu koskaan |
| 15 | Luontiaika | `created_at` | `created` | GitHub | ✅ asetetaan kerran | ⛔ | Ei muutu |
| 16 | Päivitysaika | `updated_at` | `updated` | Molemmat | ✅ käytetään konfliktin ratkaisuun | ✅ | Uudempi voittaa |

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

- GitHub for Atlassian -app asennettuna ja repot liitettynä.
- GitHub PAT tai GitHub App -token tallennettu Atlassian Automation -salaisuuksiin.
- Kolme custom-kenttää luotuna Jira-projektiin: `source_repo`, `github_issue_number`, `github_url`.
- GitHub-repositorioihin luotu webhook Atlassian Automation incoming webhook -URL:iin, events: `Issues`, `Issue comments`.

### Silmukan esto (kaikki säännöt)

Kommenttisäännöissä tarkistetaan etuliite: ei prosessoida kommenttia joka alkaa `[GitHub]` tai `[Jira]`. Teksti/otsikko-päivityssäännöissä käytetään **5 sekunnin ikkunaa**: jos Jira `updated`-aika ja webhook-aikaleima ovat alle 5 s erossa, ohitetaan päivitys (Automation smart value: `{{issue.updated.epochMillis}} + 5000 > {{now.epochMillis}}`).

---

### GitHub → Jira -säännöt (8 sääntöä)

#### Sääntö 1 — Uusi GitHub-issue → luo Jira-ticket

```
Triggeri:   Incoming webhook — issues.opened
Ehto:       JQL-haku: "github_issue_number" = {{webhookData.issue.number}}
            AND "source_repo" = "{{webhookData.repository.name}}"
            → jos löytyy: ohita (idempotentti)
            → jos ei löydy: jatka
Toiminto:   Create issue
  summary:        {{webhookData.issue.title}}
  description:    {{webhookData.issue.body}}
  issuetype:      [mapaus label-kentästä, ks. taulukko]
  labels:         {{webhookData.issue.labels[*].name}}
  assignee:       {{webhookData.issue.assignee.login}}
  fixVersions:    {{webhookData.issue.milestone.title}} (luo jos puuttuu)
  source_repo:    {{webhookData.repository.name}}
  github_issue_number: {{webhookData.issue.number}}
  github_url:     {{webhookData.issue.html_url}}
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

Kaikkien HTTP-toimintojen URL-pohja: `https://api.github.com/repos/uutisseuranta/{{issue.source_repo}}/issues/{{issue.github_issue_number}}`

Autentikointi: `Authorization: Bearer {{secrets.GITHUB_TOKEN}}`

#### Sääntö 9 — Jira-status muuttuu → päivitä GitHub

```
Triggeri:   Issue transitioned
Ehto:       github_issue_number-kenttä ei ole tyhjä
Toiminto:   HTTP PATCH [URL]
  Jos uusi status = Done:
    body: {"state": "closed", "state_reason": "completed"}
  Muuten:
    body: {"state": "open"}
  + HTTP POST [URL]/labels
    body: {"labels": ["status:{{newStatus.name.toLowerCase}}"]}
  (poista ensin vanhat status:* -labelit: HTTP DELETE /labels/status:*)
```

#### Sääntö 10 — Jira-assignee muuttuu → päivitä GitHub

```
Triggeri:   Issue assigned / unassigned
Ehto:       github_issue_number-kenttä ei ole tyhjä
Toiminto:   HTTP PATCH [URL]
  body: {"assignees": ["{{issue.assignee.name}}"]}
  (unassigned: {"assignees": []})
```

#### Sääntö 11 — Jira-prioriteetti muuttuu → päivitä GitHub-label

```
Triggeri:   Field value changed — priority
Ehto:       github_issue_number-kenttä ei ole tyhjä
Toiminto 1: HTTP DELETE [URL poista vanhat priority:* -labelit]
Toiminto 2: HTTP POST [URL]/labels
  body: {"labels": ["priority:{{issue.priority.name.toLowerCase}}"]}
```

#### Sääntö 12 — Jira-sprint alkaa tai issue siirtyy sprinttiin → aseta GitHub-label

```
Triggeri:   Sprint started + Issue moved to sprint
Ehto:       github_issue_number-kenttä ei ole tyhjä
Toiminto 1: HTTP DELETE [URL poista vanhat sprint:* -labelit]
Toiminto 2: HTTP POST [URL]/labels
  body: {"labels": ["sprint:{{sprint.name}}"]}
```

#### Sääntö 13 — Jira-summary muuttuu → päivitä GitHub-otsikko

```
Triggeri:   Field value changed — summary
Ehto:       github_issue_number-kenttä ei ole tyhjä
            + 5 s silmukan esto
Toiminto:   HTTP PATCH [URL]
  body: {"title": "{{issue.summary}}"}
```

#### Sääntö 14 — Uusi Jira-kommentti → lisää GitHub-kommentti

```
Triggeri:   Comment added
Ehto:       github_issue_number-kenttä ei ole tyhjä
            + kommentti EI ala "[GitHub]" (silmukan esto)
Toiminto:   HTTP POST [URL]/comments
  body: {"body": "[Jira] {{comment.author.displayName}}: {{comment.body}}"}
```

#### Sääntö 15 — fixVersion muuttuu → päivitä GitHub-milestone

```
Triggeri:   Field value changed — fixVersions
Ehto:       github_issue_number-kenttä ei ole tyhjä
Toiminto 1: HTTP GET https://api.github.com/repos/uutisseuranta/{{source_repo}}/milestones
            → hae milestone-numero nimellä {{issue.fixVersions[0].name}}
Toiminto 2: Jos löytyy:
              HTTP PATCH [URL] body: {"milestone": {{milestoneNumber}}}
            Jos ei löydy:
              HTTP POST .../milestones body: {"title": "{{issue.fixVersions[0].name}}"}
              → käytä palautettu numero
```

---

## Toteutusjärjestys

1. **Vaihe 1** — Luo custom-kentät Jira-projektiin (`source_repo`, `github_issue_number`, `github_url`)
2. **Vaihe 2** — Asenna GitHub for Atlassian -app ja liitä repot (kehityspaneeli)
3. **Vaihe 3** — Tallenna GitHub PAT Atlassian Automation -salaisuuksiin
4. **Vaihe 4** — Luo GitHub-webhookit kaikille kolmelle repolle (events: Issues, Issue comments)
5. **Vaihe 5** — Rakenna Säännöt 1–8 (GitHub → Jira)
6. **Vaihe 6** — Rakenna Säännöt 9–15 (Jira → GitHub)
7. **Vaihe 7** — Testaa sääntö 1 manuaalisesti yhdellä testiissuella, tarkista idempotenttius
8. **Vaihe 8** — Aja kertaluonteinen backfill-ajo kaikille olemassa oleville avoimille issueille (GitHub API + Automation tai erillinen skripti)

---

## Rajoitukset ja hyväksytyt kompromissit

| Rajoitus | Päätös |
|---|---|
| Markdown → ADF-konversio | Hyväksytty: body tallennetaan Jiraan plain textinä ilman muotoilua |
| Sub-issues | Kielletty; ristikkäisviittaukset Jira issue link -tyypeillä |
| Sprint → GitHub natiivikäsite | Hyväksytty: sprint näkyy GitHubissa vain labelina `sprint:N` |
| Konfliktiresoluutio monimutkaisissa tapauksissa | Yksinkertainen sääntö: uudempi `updated_at` voittaa + 5 s silmukkaikkuna |
| Jira-käyttäjä ≠ GitHub-käyttäjä | Ensimmäisessä vaiheessa käyttäjätunnusten pitää vastata toisiaan; myöhemmin voidaan rakentaa user-mapping-taulukko |
