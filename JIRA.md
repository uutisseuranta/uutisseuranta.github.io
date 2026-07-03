# GitHub ↔ Jira Integration — Täysi toteutussuunnitelma

> Päivitetty Atlassian Cloud Automation -dokumentaation pohjalta (2026-07-03)  
> Viralliset ohjeet: https://support.atlassian.com/cloud-automation/resources/

---

## Arkkitehtuurilinja

**Malli: Jira ensisijaisena, GitHub masterina.**

- **GitHub** on sisällön master: otsikko, body, labelit, milestone, PR:t, source-identiteetti.
- **Jira** on työnhallinnan master: status, prioriteetti, assignee, sprint, workflow.
- Kaikki kolme repositoriota (`uutisseuranta.github.io`, `patterns`, `bq-activitystreams`) ovat lähteitä.
- Sub-issueita ei käytetä. Ristikkäisviittaukset toteutetaan Jira issue link -tyypeillä.
- Natiivi **GitHub for Atlassian** -app (`com.github.integration.production`) hoitaa kehityspaneelin (branchit, commitit, PR:t, buildit, deploymentit) — sitä ei korvata.
- Issue-synkronointi rakennetaan **Atlassian Automation** -flowleden avulla (15 sääntöä).

### Tekniset arkkitehtuurivalinnat

GitHub org-webhook ei tue custom HTTP-headereita, mutta Jira Automation
vaatii tokenin `X-Automation-Webhook-Token` -headerissa. Siksi käytetään
**GitHub Actions -workflowta** välittäjänä:

```
GitHub Issue event
      ↓
GitHub Actions (jira-webhook-relay.yml)
      ↓  POST + X-Automation-Webhook-Token header
Jira Automation Incoming Webhook trigger
      ↓
Create / Transition work item / Comment on work item (Jira)
```

Workflow on tallennettu: `.github/workflows/jira-webhook-relay.yml`

---

## Terminologia (viralliset Atlassian-nimet)

| Käytetty nimi | Atlassianin virallinen nimi | Selitys |
|---|---|---|
| Rule / sääntö | **Flow** | Automatio-kokonaisuus (trigger + conditions + actions) |
| Issue | **Work item** | Jiran tiketti |
| Project | **Space** | Jiran projekti |
| Transition | **Transition work item** | Toiminto joka siirtää work itemin tilasta toiseen |
| Issue fields condition | **Issue fields condition** | Ehto joka tarkistaa work itemin kenttien arvot |
| Lookup issues | **Lookup work items** | Toiminto joka hakee work itemeja JQL-kyselyllä → `{{lookupIssues}}` |
| Send web request | **Send web request** | HTTP POST ulkoiseen järjestelmään |

---

## Tietomalli

### Jira custom -kentät (luotava projektiin)

| customfield ID | Display name | Tyyppi | Kuvaus |
|---|---|---|---|
| customfield_10071 | `source_repo` | Text | `uutisseuranta.github.io` / `patterns` / `bq-activitystreams` |
| customfield_10072 | `github_issue_number` | Number | GitHub issue number (esim. `42`) |
| customfield_10073 | `github_url` | URL | Suora linkki GitHub-issueen |

> **Haku JQL:llä:** `cf[10072]` = customfield_10072

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

## Flowien rakenne

Jira Automation -flow koostuu kolmesta osasta järjestyksessä:

```
TRIGGER  →  [CONDITIONS]  →  ACTIONS
```

1. **Trigger** — Käynnistää flowin. Kuuntelee tapahtumia Jirassa tai ulkoisista lähteistä.
2. **Condition** (valinnainen) — Suodatin. Jos ehto ei täyty, flow pysähtyy. Voidaan laittaa mihin kohtaan flowia tahansa.
3. **Action** — Tekee jotain (muuttaa kenttiä, lähettää viestin, siirtää tilan jne.).

### Silmukan esto (kaikki säännöt)

Kommenttisäännöissä tarkistetaan etuliite: ei prosessoida kommenttia joka alkaa `[GitHub]` tai `[Jira]`. Teksti/otsikko-päivityssäännöissä käytetään **5 sekunnin ikkunaa**: jos Jira `updated`-aika ja webhook-aikaleima ovat alle 5 s erossa, ohitetaan päivitys (Automation smart value: `{{issue.updated.epochMillis}} + 5000 > {{now.epochMillis}}`).

---

## GitHub → Jira -flowledet (Säännöt 1–8)

### Sääntö 1: GitHub issue opened → Luo Jira work item ✅

**Tila:** VALMIS — testattu, work item US-7 luotu onnistuneesti 3.7.2026

#### Trigger

| Asetus | Arvo |
|--------|------|
| Tyyppi | **Incoming webhook** |
| Work item criteria | **No work items from the webhook** |

#### Action: Create work item

| Kenttä | Arvo |
|--------|------|
| Space | `Uutisseuranta (US)` |
| Work item type | `Story` |
| Summary | `{{webhookData.issue.title}}` |
| Description | `{{webhookData.issue.body}}` |

#### Advanced fields (JSON)

```json
{
  "fields": {
    "customfield_10071": "{{webhookData.repository.name}}",
    "customfield_10072": {{webhookData.issue.number}},
    "customfield_10073": "{{webhookData.issue.html_url}}"
  }
}
```

> **Idempotenttius:** Ennen luontia tarkista JQL: `project = US AND cf[10072] = {{webhookData.issue.number}} AND cf[10071] = "{{webhookData.repository.name}}"`  
> Jos löytyy → ohita. Jos ei löydy → luo.

---

### Sääntö 2: GitHub issue edited → Päivitä Jira work item

**Tila:** JSON v2 valmis, testaamatta

```
Trigger: Incoming webhook
  → webhookData.action == "edited"

Ehto: webhookData.changes.title TAI webhookData.changes.body on mukana

Action: Lookup work items
  → JQL: project = US AND cf[10072] = {{webhookData.issue.number}}

Condition: {{lookupIssues.size}} greater than 0

Action: Edit work item
  → Summary:     {{webhookData.issue.title}}
  → Description: {{webhookData.issue.body}}

Silmukan esto: tarkista 5 s -ikkuna
```

---

### Sääntö 3: GitHub issue closed → Transition work item → Done

**Tila:** JSON v2 valmis, testaamatta

```
Trigger: Incoming webhook
  → webhookData.action == "closed"

Action: Lookup work items
  → JQL: project = US AND cf[10072] = {{webhookData.issue.number}}

Condition: {{smart values}} condition
  → {{lookupIssues.size}} greater than 0

Action: Transition work item
  → Work item: {{lookupIssues.first.key}}
  → To status: Done

Action: Edit work item
  → resolution:
      completed   → "Fixed"
      not_planned → "Won't Do"
      duplicate   → "Duplicate"
```

> **Huom:** Transition-nimi `Done` täytyy täsmätä täsmälleen Jiran workflow-konfiguraatioon.  
> Tarkista: **Project Settings → Workflows → [workflow] → Edit**

---

### Sääntö 4: GitHub issue reopened → Transition work item → To Do

**Tila:** JSON v2 valmis, testaamatta

```
Trigger: Incoming webhook
  → webhookData.action == "reopened"

Action: Lookup work items
  → JQL: project = US AND cf[10072] = {{webhookData.issue.number}}

Action: Transition work item
  → To status: To Do
```

---

### Sääntö 5: GitHub issue labeled/unlabeled → Edit work item labels

**Tila:** JSON v2 valmis, testattava

```
Trigger: Incoming webhook
  → webhookData.action == "labeled" TAI "unlabeled"

Action: Lookup work items
  → JQL: project = US AND cf[10072] = {{webhookData.issue.number}}

Action: Edit work item
  → Field: Labels
  → Operation: Add
  → Value: {{webhookData.label.name}}

Jos label alkaa "priority:":
  → Edit work item — priority: high/medium/low/lowest mapauksen mukaan
```

---

### Sääntö 6: GitHub issue assigned/unassigned → Päivitä assignee

**Tila:** Suunniteltu, ei toteutettu

```
Trigger: Incoming webhook
  → webhookData.action == "assigned" TAI "unassigned"

Action: Lookup work items
  → JQL: project = US AND cf[10072] = {{webhookData.issue.number}}

Action: Edit work item
  → assignee: {{webhookData.issue.assignee.login}}
  (unassigned: tyhjennä assignee)
```

---

### Sääntö 7: GitHub issue milestoned/demilestoned → Päivitä fixVersion

**Tila:** Suunniteltu, ei toteutettu

```
Trigger: Incoming webhook
  → webhookData.action == "milestoned" TAI "demilestoned"

Action: Lookup work items
  → JQL: project = US AND cf[10072] = {{webhookData.issue.number}}

Action: Edit work item
  → fixVersions: {{webhookData.issue.milestone.title}}
  Jos versiota ei ole: HTTP POST /rest/api/3/version
  {"name": "{{webhookData.issue.milestone.title}}",
   "releaseDate": "{{webhookData.issue.milestone.due_on}}",
   "projectId": "{{project.id}}"}
```

---

### Sääntö 8: GitHub issue comment → Comment on work item

**Tila:** JSON v2 valmis, testaamatta

```
Trigger: Incoming webhook
  → webhookData.action == "created"  (comment event)

Action: Lookup work items
  → JQL: project = US AND cf[10072] = {{webhookData.issue.number}}

Ehto: kommentti EI ala "[Jira]" (silmukan esto)

Action: Comment on work item
  → Comment: "[GitHub] @{{webhookData.comment.user.login}}: {{webhookData.comment.body}}"
```

---

## Jira → GitHub -flowledet (Säännöt 9–15)

Kaikkien HTTP-toimintojen URL-pohja:  
`https://api.github.com/repos/uutisseuranta/{{issue.source_repo}}/issues/{{issue.github_issue_number}}`

Autentikointi: `Authorization: Bearer {{secrets.GITHUB_TOKEN}}`

### Sääntö 9: Jira status muuttuu → Päivitä GitHub issue state

**Tila:** Suunniteltu (TODO)

```
Trigger: Issue transitioned
Ehto:    github_issue_number-kenttä ei ole tyhjä

Toiminto: HTTP PATCH [URL]
  Jos uusi status = Done:
    body: {"state": "closed", "state_reason": "completed"}
  Muuten:
    body: {"state": "open"}

  + HTTP POST [URL]/labels
    body: {"labels": ["status:{{newStatus.name.toLowerCase}}"]}
  (poista ensin vanhat status:* -labelit: HTTP DELETE /labels/status:*)
```

---

### Sääntö 10: Jira assignee muuttuu → Päivitä GitHub assignee

**Tila:** Suunniteltu (TODO)

```
Trigger: Issue assigned / unassigned
Ehto:    github_issue_number-kenttä ei ole tyhjä

Toiminto: HTTP PATCH [URL]
  body: {"assignees": ["{{issue.assignee.name}}"]}
  (unassigned: {"assignees": []})
```

---

### Sääntö 11: Jira prioriteetti muuttuu → Päivitä GitHub label

**Tila:** Suunniteltu (TODO)

```
Trigger: Field value changed — priority
Ehto:    github_issue_number-kenttä ei ole tyhjä

Toiminto 1: HTTP DELETE [URL poista vanhat priority:* -labelit]
Toiminto 2: HTTP POST [URL]/labels
  body: {"labels": ["priority:{{issue.priority.name.toLowerCase}}"]}
```

---

### Sääntö 12: Jira sprint alkaa tai issue siirtyy sprinttiin → GitHub label

**Tila:** Suunniteltu (TODO)

```
Trigger: Sprint started + Issue moved to sprint
Ehto:    github_issue_number-kenttä ei ole tyhjä

Toiminto 1: HTTP DELETE [URL poista vanhat sprint:* -labelit]
Toiminto 2: HTTP POST [URL]/labels
  body: {"labels": ["sprint:{{sprint.name}}"]}
```

---

### Sääntö 13: Jira summary muuttuu → Päivitä GitHub otsikko

**Tila:** Suunniteltu (TODO)

```
Trigger: Field value changed — summary
Ehto:    github_issue_number-kenttä ei ole tyhjä
         + 5 s silmukan esto

Toiminto: HTTP PATCH [URL]
  body: {"title": "{{issue.summary}}"}
```

---

### Sääntö 14: Uusi Jira kommentti → Lisää GitHub issue comment

**Tila:** Suunniteltu (TODO)

```
Trigger: Comment added
Ehto:    github_issue_number-kenttä ei ole tyhjä
         + kommentti EI ala "[GitHub]" (silmukan esto)

Toiminto: HTTP POST [URL]/comments
  body: {"body": "[Jira] {{comment.author.displayName}}: {{comment.body}}"}
```

---

### Sääntö 15: fixVersion muuttuu → Päivitä GitHub milestone

**Tila:** Suunniteltu (TODO)

```
Trigger: Field value changed — fixVersions
Ehto:    github_issue_number-kenttä ei ole tyhjä

Toiminto 1: HTTP GET https://api.github.com/repos/uutisseuranta/{{source_repo}}/milestones
            → hae milestone-numero nimellä {{issue.fixVersions[0].name}}
Toiminto 2: Jos löytyy:
              HTTP PATCH [URL] body: {"milestone": {{milestoneNumber}}}
            Jos ei löydy:
              HTTP POST .../milestones body: {"title": "{{issue.fixVersions[0].name}}"}
              → käytä palautettu numero
```

---

## Conditions (Ehdot)

Virallinen dokumentaatio: https://support.atlassian.com/cloud-automation/docs/jira-automation-conditions/

### Issue fields condition
Tarkistaa work itemin kentän arvon ilman smart valueja tai JQL:ää. Käytä tätä ensisijaisesti.

```
Condition: Issue fields condition
  → Field: Status
  → Condition: equals
  → Value: Done
```

### {{smart values}} condition
Vertaa kahta smart value -arvoa. Tukee myös regexejä.

```
Condition: {{smart values}} condition
  → First value:  {{lookupIssues.size}}
  → Condition:    greater than
  → Second value: 0
```

### If/else block
Haaroittaa flowin eri poluille. Tukee kahta sisäkkäistä tasoa.

```
IF:   {{webhookData.action}} equals "closed"
        → Transition work item → Done
ELSE IF: {{webhookData.action}} equals "reopened"
        → Transition work item → To Do
```

> **Huom:** Vanhentunut `jira.condition.webhook.compare` ei enää toimi importissa.  
> Käytä sen sijaan `jira.condition.if` (If/else block).

---

## Smart Values -syntaksi

Virallinen dokumentaatio: https://support.atlassian.com/cloud-automation/docs/what-are-smart-values/

Smart valuesit käyttävät **mustache-syntaksia** ja **dot notation** -merkintää:

```
{{object.property.subProperty}}
```

### Tärkeimmät smart valuesit tässä projektissa

| Smart value | Palauttaa |
|---|---|
| `{{webhookData.action}}` | GitHub-eventin tyyppi (`opened`, `closed`, `labeled`...) |
| `{{webhookData.issue.number}}` | GitHub issue -numero |
| `{{webhookData.issue.title}}` | GitHub issue -otsikko |
| `{{webhookData.issue.body}}` | GitHub issue -kuvaus |
| `{{webhookData.issue.html_url}}` | GitHub issue -URL |
| `{{webhookData.issue.state}}` | Issue state (`open`/`closed`) |
| `{{webhookData.issue.labels[*].name}}` | Kaikkien labelien nimet listana |
| `{{webhookData.issue.assignee.login}}` | Assigneen GitHub-tunnus |
| `{{webhookData.issue.milestone.title}}` | Milestonen nimi |
| `{{webhookData.issue.milestone.due_on}}` | Milestonen eräpäivä |
| `{{webhookData.label.name}}` | Lisätyn/poistetun labelin nimi |
| `{{webhookData.comment.body}}` | Kommentin sisältö |
| `{{webhookData.comment.user.login}}` | Kommentoijan GitHub-tunnus |
| `{{webhookData.repository.name}}` | Repositorion nimi |
| `{{lookupIssues}}` | Lookup work items -actionin tulokset |
| `{{lookupIssues.first.key}}` | Ensimmäisen löydetyn work itemin avain (esim. `US-7`) |
| `{{lookupIssues.size}}` | Löydettyjen work itemien lukumäärä |
| `{{issue.key}}` | Nykyisen work itemin avain |
| `{{issue.status.name}}` | Nykyisen tilan nimi |
| `{{issue.updated.epochMillis}}` | Viimeinen päivitysaika millisekunteina (silmukan esto) |
| `{{now}}` | Nykyinen aika |

### Oletusarvo (jos kenttä on tyhjä)

```
{{issue.assignee.displayName | "Ei vastuuhenkilöä"}}
```

### Listoja läpi käyminen

```
{{#lookupIssues}}
  * {{key}}: {{summary}}
{{/}}
```

---

## Webhook-data-rakenne (`{{webhookData}}`)

GitHub lähettää seuraavan rakenteen (issues event):

```json
{
  "action": "opened",
  "issue": {
    "number": 42,
    "title": "Fix login bug",
    "body": "Description...",
    "html_url": "https://github.com/...",
    "state": "open",
    "state_reason": null,
    "labels": [{"name": "bug"}],
    "assignees": [{"login": "username"}],
    "milestone": {"title": "v1.0", "due_on": "2026-08-01T00:00:00Z"},
    "user": {"login": "username"}
  },
  "comment": {
    "body": "Comment text",
    "user": {"login": "commenter"}
  },
  "label": {
    "name": "bug"
  },
  "repository": {
    "name": "uutisseuranta.github.io"
  }
}
```

---

## GitHub Actions Workflow

Tiedosto: `.github/workflows/jira-webhook-relay.yml`

```yaml
name: Jira Webhook Relay

on:
  issues:
    types: [opened, edited, closed, reopened, labeled, unlabeled,
            assigned, unassigned, milestoned, demilestoned]
  issue_comment:
    types: [created]

jobs:
  relay:
    runs-on: ubuntu-latest
    steps:
      - name: Send to Jira Automation
        env:
          JIRA_WEBHOOK_TOKEN: ${{ secrets.JIRA_WEBHOOK_TOKEN }}
          JIRA_WEBHOOK_URL: ${{ secrets.JIRA_WEBHOOK_URL }}
        run: |
          echo '${{ toJson(github.event) }}' | \
          curl -X POST \
            "$JIRA_WEBHOOK_URL" \
            -H "Content-Type: application/json" \
            -H "X-Automation-Webhook-Token: $JIRA_WEBHOOK_TOKEN" \
            --data-binary @-
```

> **Huom:** Tokenin ja URL:n tulee olla GitHub Secrets -muuttujina, ei plain textinä.

---

## JSON Import -huomiot

Jira hyväksyy vain JSONin, joka vastaa **Export rules** -rakennetta.

### Havaittu virhe

```text
IllegalStateException: Component for type ComponentTypeKey{component=CONDITION, type='jira.condition.webhook.compare'} no longer exists.
```

**Johtopäätös:** `jira.condition.webhook.compare` ei ole enää tuettu importattava komponenttityyppi.  
**Korjaus:** Käytä ehtona `jira.condition.if` (If/else block) — ei webhook-specific compare-conditioneja.

---

## Toteutusjärjestys

1. **Vaihe 1** — Luo custom-kentät Jira-projektiin (`source_repo`, `github_issue_number`, `github_url`)
2. **Vaihe 2** — Asenna GitHub for Atlassian -app ja liitä repot (kehityspaneeli) ✅ VALMIS
3. **Vaihe 3** — Tallenna GitHub PAT ja Jira webhook-token GitHub Secrets -muuttujiin ✅ VALMIS
4. **Vaihe 4** — Luo org-webhook / GitHub Actions relay kaikille kolmelle repolle ✅ VALMIS
5. **Vaihe 5** — Rakenna Säännöt 1–8 (GitHub → Jira); sääntö 1 ✅ VALMIS
6. **Vaihe 6** — Rakenna Säännöt 9–15 (Jira → GitHub)
7. **Vaihe 7** — Testaa sääntö 1 manuaalisesti yhdellä testiissuella, tarkista idempotenttius
8. **Vaihe 8** — Aja kertaluonteinen backfill-ajo kaikille olemassa oleville avoimille issueille (GitHub API + Automation tai erillinen skripti)

---

## Debuggaus

### Curl-testi manuaalisesti

```bash
curl -X POST \
  "${JIRA_WEBHOOK_URL}" \
  -H "Content-Type: application/json" \
  -H "X-Automation-Webhook-Token: ${JIRA_WEBHOOK_TOKEN}" \
  -d '{}' -v 2>&1 | grep "< HTTP"
```

### Yleisimmät virheet

| Virhe | Syy | Korjaus |
|-------|-----|--------|
| `Missing token` (400) | Token query-parametrina eikä headerissa | Käytä `X-Automation-Webhook-Token` headeria |
| `No work items from the webhook` | Trigger-asetus väärä | Vaihda "No work items from the webhook" |
| `The project or issue type wasn't set` | Space/work item type "Copy from trigger" | Aseta kiinteät arvot dropdownista |
| `Fields ignored: customfield_...` | Kenttä ei ole projektissa | Lisää kenttä Project settings → Fields |
| `Component ... no longer exists` | JSON sisältää vanhan/poistetun component typen | Käytä `jira.condition.if` |
| Transition not found | Transition-nimi väärä | Tarkista Project Settings → Workflows |
| `{{lookupIssues}}` tyhjä | JQL ei löydä work itemejä | Tarkista `cf[10072]` ja kentän arvo |

---

## Rajoitukset ja hyväksytyt kompromissit

| Rajoitus | Päätös |
|---|---|
| Markdown → ADF-konversio | Hyväksytty: body tallennetaan Jiraan plain textinä ilman muotoilua |
| Sub-issues | Kielletty; ristikkäisviittaukset Jira issue link -tyypeillä |
| Sprint → GitHub natiivikäsite | Hyväksytty: sprint näkyy GitHubissa vain labelina `sprint:N` |
| Konfliktiresoluutio monimutkaisissa tapauksissa | Yksinkertainen sääntö: uudempi `updated_at` voittaa + 5 s silmukkaikkuna |
| Jira-käyttäjä ≠ GitHub-käyttäjä | Ensimmäisessä vaiheessa käyttäjätunnusten pitää vastata toisiaan; myöhemmin voidaan rakentaa user-mapping-taulukko |

---

## Linkit

- [Automation triggers](https://support.atlassian.com/cloud-automation/docs/jira-automation-triggers/)
- [Automation actions](https://support.atlassian.com/cloud-automation/docs/jira-automation-actions/)
- [Automation conditions](https://support.atlassian.com/cloud-automation/docs/jira-automation-conditions/)
- [Smart values](https://support.atlassian.com/cloud-automation/docs/what-are-smart-values/)
- [Automation branches](https://support.atlassian.com/cloud-automation/docs/jira-automation-branches/)
- [Template library](https://www.atlassian.com/software/jira/automation-template-library)
