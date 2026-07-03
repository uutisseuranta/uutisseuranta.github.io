# GitHub ↔ Jira Integration — Täysi toteutussuunnitelma

> Päivitetty 2026-07-03  
> Atlassian Cloud Automation -viitteet: https://support.atlassian.com/cloud-automation/resources/  
> Jira Cloud API -viitteet: https://developer.atlassian.com/cloud/jira/platform/rest/v3/

---

## Arkkitehtuurilinja

**Malli: Jira ensisijaisena, GitHub masterina.**

- **GitHub** on sisällön master: otsikko, body, labelit, milestone, PR:t, source-identiteetti.
- **Jira** on työnhallinnan master: status, prioriteetti, assignee, sprint, workflow.
- Kaikki kolme repositoriota (`uutisseuranta.github.io`, `patterns`, `bq-activitystreams`) ovat lähteitä.
- Sub-issueita ei käytetä. Ristikkäisviittaukset toteutetaan Jira issue link -tyypeillä.
- Natiivi **GitHub for Atlassian** -app (`com.github.integration.production`) hoitaa kehityspaneelin (branchit, commitit, PR:t, buildit, deploymentit) — sitä ei korvata.
- Issue-synkronointi rakennetaan **Atlassian Automation** -flowien avulla (15 sääntöä).

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
Create work item / Transition work item / Comment on work item
```

Workflow on tallennettu: `.github/workflows/jira-webhook-relay.yml`

---

## Terminologia (viralliset Atlassian-nimet, 2026)

> **Huom 2026:** Atlassian uudisti terminologiaa vuoden 2025 lopulla.  
> Vanha "rule" = **Flow**. Vanha "issue" = **Work item**. Vanha "project" = **Space**.

| Vanhentunut nimi | Atlassianin virallinen nimi (2026) | Huomio |
|---|---|---|
| Rule / sääntö | **Flow** | Koko automatio-kokonaisuus (trigger + conditions + actions) |
| Issue | **Work item** | Jiran tiketti |
| Project | **Space** | Jiran projekti |
| Transition | **Transition work item** | Action joka siirtää work itemin tilasta toiseen |
| Issue fields condition | **Issue fields condition** | Ei muuttunut; tarkistaa work itemin kentät |
| Lookup issues | **Lookup work items** | Hakee work itemeja JQL-kyselyllä → `{{lookupIssues}}` |
| Edit issue | **Edit work item** | Muokkaa work itemin kenttiä |
| Create issue | **Create work item** | Luo uuden work itemin |
| Comment on issue | **Comment on work item** | Lisää kommentin |
| Send web request | **Send web request** | HTTP-toiminto ulkoiseen järjestelmään; ei uudelleennimetty |

---

## Tietomalli

### Jira custom -kentät (varmistettu MCP:llä 2026-07-03)

Custom kenttien **display nimet** varmistettu suoraan Jira Cloud -instanssista
(`uutisseuranta.atlassian.net`, projekti `US`):

| customfield ID | Display name (Jirassa) | JQL-syntaksi | Tyyppi | Arvoesimerkki |
|---|---|---|---|---|
| `customfield_10071` | `source_repo` | `cf[10071]` | Text (Single line) | `uutisseuranta.github.io` |
| `customfield_10072` | `github_issue_number` | `cf[10072]` | Number | `45` |
| `customfield_10073` | `github_url` | `cf[10073]` | URL | `https://github.com/uutisseuranta/uutisseuranta.github.io/issues/45` |

> **Idempotenttius-JQL:** `project = US AND cf[10072] = {{webhookData.issue.number}} AND cf[10071] = "{{webhookData.repository.name}}"`  
> **Smart value -syntaksi:** `{{issue.customfield_10071}}` — käytä kenttä-ID:tä, ei display nimeä.

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
| 12 | Source repo | repo-nimi | `customfield_10071` (`source_repo`) | GitHub (vain luku) | ✅ kirjoitetaan luonnissa | ⛔ | Ei muutu koskaan |
| 13 | Source issue # | `number` | `customfield_10072` (`github_issue_number`) | GitHub (vain luku) | ✅ kirjoitetaan luonnissa | ⛔ | Ei muutu koskaan |
| 14 | Source URL | `html_url` | `customfield_10073` (`github_url`) | GitHub (vain luku) | ✅ kirjoitetaan luonnissa | ⛔ | Ei muutu koskaan |
| 15 | Luontiaika | `created_at` | `created` | GitHub | ✅ asetetaan kerran | ⛔ | Ei muutu |
| 16 | Päivitysaika | `updated_at` | `updated` | Molemmat | ✅ käytetään konfliktin ratkaisuun | ✅ | Uudempi voittaa |

### Issuetype-mapaus

| GitHub-label | Jira work item type |
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
2. **Condition** (valinnainen) — Suodatin. Jos ehto ei täyty, flow pysähtyy. Voidaan sijoittaa mihin kohtaan flowia tahansa.
3. **Action** — Tekee jotain (muuttaa kenttiä, lähettää HTTP-pyynnön, siirtää tilan jne.).

### Silmukan esto (kaikki säännöt)

Kommenttisäännöissä tarkistetaan etuliite: ei prosessoida kommenttia joka alkaa `[GitHub]` tai `[Jira]`. Teksti/otsikko-päivityssäännöissä käytetään **5 sekunnin ikkunaa**: jos Jira `updated`-aika ja webhook-aikaleima ovat alle 5 s erossa, ohitetaan päivitys:

```
{{issue.updated.epochMillis}} + 5000 > {{now.epochMillis}}
```

---

## GitHub → Jira -flowledet (Säännöt 1–8)

### Sääntö 1: GitHub issue opened → Luo Jira work item ✅

**Tila:** VALMIS — testattu, work item US-7 luotu onnistuneesti 3.7.2026

#### Trigger

| Asetus | Arvo |
|--------|------|
| Tyyppi | **Incoming webhook** |
| Work item criteria | **No work items from the webhook** |

#### Condition: Idempotenttius (tarkista duplikaatti ennen luontia)

```
Action: Lookup work items
  → JQL: project = US AND cf[10072] = {{webhookData.issue.number}}
         AND cf[10071] = "{{webhookData.repository.name}}"

Condition: {{smart values}} condition
  → First value:  {{lookupIssues.size}}
  → Condition:    equals
  → Second value: 0
  (Jos löytyy → stop; Jos ei löydy → jatka luontiin)
```

#### Action: Create work item

| Kenttä | Arvo |
|--------|------|
| Space | `Uutisseuranta (US)` |
| Work item type | `Story` |
| Summary | `{{webhookData.issue.title}}` |
| Description | `{{webhookData.issue.body}}` |
| `customfield_10071` | `{{webhookData.repository.name}}` |
| `customfield_10072` | `{{webhookData.issue.number}}` |
| `customfield_10073` | `{{webhookData.issue.html_url}}` |

> **Huom:** Create work item -actionin "Advanced fields" -osio ei enää tue raw JSON -syötettä  
> uusimmassa Automation UI:ssa. Käytä jokainen kenttä erikseen listasta valiten,  
> tai käytä **Send web request** → `POST /rest/api/3/issue` -toimintoa.

---

### Sääntö 2: GitHub issue edited → Päivitä Jira work item

**Tila:** JSON v2 valmis, testaamatta

```
Trigger: Incoming webhook
  → webhookData.action == "edited"

Condition: {{smart values}} condition
  → {{webhookData.changes.title}} OR {{webhookData.changes.body}} exists

Action: Lookup work items
  → JQL: project = US AND cf[10072] = {{webhookData.issue.number}}
         AND cf[10071] = "{{webhookData.repository.name}}"

Condition: {{smart values}} condition
  → {{lookupIssues.size}} greater than 0

Action: Edit work item
  → Work item: {{lookupIssues.first.key}}
  → Summary:     {{webhookData.issue.title}}
  → Description: {{webhookData.issue.body}}

Silmukan esto: {{issue.updated.epochMillis}} + 5000 > {{now.epochMillis}}
```

---

### Sääntö 3: GitHub issue closed → Transition work item → Done

**Tila:** JSON v2 valmis, testaamatta

```
Trigger: Incoming webhook
  → webhookData.action == "closed"

Action: Lookup work items
  → JQL: project = US AND cf[10072] = {{webhookData.issue.number}}
         AND cf[10071] = "{{webhookData.repository.name}}"

Condition: {{smart values}} condition
  → {{lookupIssues.size}} greater than 0

Action: Transition work item
  → Work item: {{lookupIssues.first.key}}
  → To status: Done

Action: Edit work item (resolution)
  → Field: Resolution
  → IF {{webhookData.issue.state_reason}} == "completed"  → "Fixed"
  → IF {{webhookData.issue.state_reason}} == "not_planned" → "Won't Do"
  → IF {{webhookData.issue.state_reason}} == "duplicate"   → "Duplicate"
```

> **Huom:** Transition-nimien täytyy täsmätä täsmälleen Jiran workflow-konfiguraatioon.  
> Tarkista: **Project Settings → Workflows → [workflow nimi] → Edit**  
> US-projektin statukset (varmistettu MCP:llä): `To Do` (id: 10000), `In Progress` (id: 10001), `Done` (id: 10002 tai vastaava).

---

### Sääntö 4: GitHub issue reopened → Transition work item → To Do

**Tila:** JSON v2 valmis, testaamatta

```
Trigger: Incoming webhook
  → webhookData.action == "reopened"

Action: Lookup work items
  → JQL: project = US AND cf[10072] = {{webhookData.issue.number}}
         AND cf[10071] = "{{webhookData.repository.name}}"

Condition: {{smart values}} condition
  → {{lookupIssues.size}} greater than 0

Action: Transition work item
  → Work item: {{lookupIssues.first.key}}
  → To status: To Do

> **Huom:** Jos work itemillä on Resolution asetettu, Transition saattaa epäonnistua.
> Lisää ennen transitiota: Edit work item → Resolution → Tyhjennä.
```

---

### Sääntö 5: GitHub issue labeled/unlabeled → Edit work item labels

**Tila:** JSON v2 valmis, testattava

```
Trigger: Incoming webhook
  → webhookData.action == "labeled" TAI "unlabeled"

Action: Lookup work items
  → JQL: project = US AND cf[10072] = {{webhookData.issue.number}}
         AND cf[10071] = "{{webhookData.repository.name}}"

Condition: {{smart values}} condition
  → {{lookupIssues.size}} greater than 0

Action: Edit work item
  → Work item: {{lookupIssues.first.key}}
  → Field: Labels
  → IF action == "labeled":   Operation: Add,    Value: {{webhookData.label.name}}
  → IF action == "unlabeled": Operation: Remove, Value: {{webhookData.label.name}}

IF {{webhookData.label.name}} alkaa "priority:":
  Action: Edit work item
    → Field: Priority
    → priority:high    → High
    → priority:medium  → Medium
    → priority:low     → Low
    → priority:lowest  → Lowest
```

---

### Sääntö 6: GitHub issue assigned/unassigned → Päivitä assignee

**Tila:** Suunniteltu, ei toteutettu

```
Trigger: Incoming webhook
  → webhookData.action == "assigned" TAI "unassigned"

Action: Lookup work items
  → JQL: project = US AND cf[10072] = {{webhookData.issue.number}}
         AND cf[10071] = "{{webhookData.repository.name}}"

Condition: {{smart values}} condition
  → {{lookupIssues.size}} greater than 0

Action: Edit work item
  → Work item: {{lookupIssues.first.key}}
  → Assignee (assigned):   Smart value: Specify user → {{webhookData.issue.assignee.login}}
  → Assignee (unassigned): Unassigned

> Rajoitus: GitHub login ≠ Jira accountId. Katso käyttäjäkartoitus-osio (Rajoitukset).
```

---

### Sääntö 7: GitHub issue milestoned/demilestoned → Päivitä fixVersions

**Tila:** Suunniteltu, ei toteutettu

```
Trigger: Incoming webhook
  → webhookData.action == "milestoned" TAI "demilestoned"

Action: Lookup work items
  → JQL: project = US AND cf[10072] = {{webhookData.issue.number}}
         AND cf[10071] = "{{webhookData.repository.name}}"

Action: Edit work item
  → fixVersions: {{webhookData.issue.milestone.title}}
  Jos versiota ei ole: HTTP POST /rest/api/3/version
    body: {
      "name":        "{{webhookData.issue.milestone.title}}",
      "releaseDate": "{{webhookData.issue.milestone.due_on}}",
      "projectId":   "{{project.id}}"
    }
```

---

### Sääntö 8: GitHub issue comment → Comment on work item

**Tila:** JSON v2 valmis, testaamatta

```
Trigger: Incoming webhook
  → webhookData.action == "created"  (issue_comment event)

Action: Lookup work items
  → JQL: project = US AND cf[10072] = {{webhookData.issue.number}}
         AND cf[10071] = "{{webhookData.repository.name}}"

Condition: {{smart values}} condition
  → {{lookupIssues.size}} greater than 0

Condition: {{smart values}} condition  (silmukan esto)
  → {{webhookData.comment.body}} does not start with "[Jira]"

Action: Comment on work item
  → Work item: {{lookupIssues.first.key}}
  → Comment:   "[GitHub] @{{webhookData.comment.user.login}}: {{webhookData.comment.body}}"
```

---

## Jira → GitHub -flowledet (Säännöt 9–15)

URL-pohja kaikkiin GitHub API -kutsuihin:

```
https://api.github.com/repos/uutisseuranta/{{issue.customfield_10071}}/issues/{{issue.customfield_10072}}
```

> **Huom:** Käytä `{{issue.customfield_10071}}` ja `{{issue.customfield_10072}}` —  
> **ei** display-nimiä (`{{issue.source_repo}}`), koska Jira Automation -smart valuesit
> viittaavat custom kenttiin ID:llä, ei display-nimellä.

Autentikointi kaikissa HTTP-toiminnoissa:
```
Authorization: Bearer {{secrets.GITHUB_TOKEN}}
Content-Type: application/json
```

---

### Sääntö 9: Jira status muuttuu → Päivitä GitHub issue state

**Tila:** Suunniteltu (TODO)

```
Trigger: Work item transitioned

Condition: Issue fields condition
  → Field: customfield_10072 (github_issue_number)
  → Condition: is not empty

Action: Send web request
  → Method: PATCH
  → URL: https://api.github.com/repos/uutisseuranta/{{issue.customfield_10071}}/issues/{{issue.customfield_10072}}
  → Headers: Authorization: Bearer {{secrets.GITHUB_TOKEN}}
  → Body (jos Done):
      {"state": "closed", "state_reason": "completed"}
  → Body (muut):
      {"state": "open"}

Action: Send web request  (lisää status-label)
  → Method: POST
  → URL: .../labels
  → Body: {"labels": ["status:{{issue.status.name | toLower}}"]}
  (Poista ensin vanhat status:* -labelit: DELETE .../labels/status:*)
```

---

### Sääntö 10: Jira assignee muuttuu → Päivitä GitHub assignee

**Tila:** Suunniteltu (TODO)

```
Trigger: Work item assigned

Condition: Issue fields condition
  → customfield_10072 is not empty

Action: Send web request
  → Method: PATCH
  → URL: [URL-pohja]
  → Body (assigned):   {"assignees": ["{{issue.assignee.name}}"]}
  → Body (unassigned): {"assignees": []}
```

---

### Sääntö 11: Jira prioriteetti muuttuu → Päivitä GitHub label

**Tila:** Suunniteltu (TODO)

```
Trigger: Field value changed
  → Field: Priority

Condition: Issue fields condition
  → customfield_10072 is not empty

Action: Send web request  (poista vanhat priority:* -labelit)
  → Method: DELETE
  → URL: .../labels/priority:<arvo>  (per label erikseen)

Action: Send web request  (lisää uusi)
  → Method: POST
  → URL: .../labels
  → Body: {"labels": ["priority:{{issue.priority.name | toLower}}"]}
```

---

### Sääntö 12: Jira sprint alkaa tai issue siirtyy sprinttiin → GitHub label

**Tila:** Suunniteltu (TODO)

```
Trigger: Sprint started TAI Field value changed (sprint)

Condition: Issue fields condition
  → customfield_10072 is not empty

Action: Send web request  (poista vanhat sprint:* -labelit)
Action: Send web request  (lisää sprint-label)
  → Method: POST
  → URL: .../labels
  → Body: {"labels": ["sprint:{{sprint.name}}"]}
```

---

### Sääntö 13: Jira summary muuttuu → Päivitä GitHub otsikko

**Tila:** Suunniteltu (TODO)

```
Trigger: Field value changed
  → Field: Summary

Condition: Issue fields condition
  → customfield_10072 is not empty

Condition: {{smart values}} condition  (silmukan esto)
  → {{issue.updated.epochMillis}} + 5000 > {{now.epochMillis}}
  → Condition: equals false  (eli päivitys on yli 5 s vanha → jatka)

Action: Send web request
  → Method: PATCH
  → URL: [URL-pohja]
  → Body: {"title": "{{issue.summary}}"}
```

---

### Sääntö 14: Uusi Jira kommentti → Lisää GitHub issue comment

**Tila:** Suunniteltu (TODO)

```
Trigger: Comment added

Condition: Issue fields condition
  → customfield_10072 is not empty

Condition: {{smart values}} condition  (silmukan esto)
  → {{comment.body}} does not start with "[GitHub]"

Action: Send web request
  → Method: POST
  → URL: .../comments
  → Body: {"body": "[Jira] {{comment.author.displayName}}: {{comment.body}}"}
```

---

### Sääntö 15: fixVersions muuttuu → Päivitä GitHub milestone

**Tila:** Suunniteltu (TODO)

```
Trigger: Field value changed
  → Field: Fix versions

Condition: Issue fields condition
  → customfield_10072 is not empty

Action: Send web request  (hae milestone-numero)
  → Method: GET
  → URL: https://api.github.com/repos/uutisseuranta/{{issue.customfield_10071}}/milestones

Action: Send web request  (päivitä tai luo)
  → Jos milestone löytyy nimellä {{issue.fixVersions[0].name}}:
      Method: PATCH, body: {"milestone": <numero>}
  → Jos ei löydy:
      Method: POST .../milestones, body: {"title": "{{issue.fixVersions[0].name}}"}
```

---

## Conditions (Ehdot)

Virallinen dokumentaatio: https://support.atlassian.com/cloud-automation/docs/jira-automation-conditions/

### Issue fields condition

Tarkistaa work itemin kentän arvon suoraan ilman smart valueja tai JQL:ää. Käytä tätä ensisijaisesti yksinkertaisissa kentäntarkistuksissa.

```
Condition: Issue fields condition
  → Field:      Status
  → Condition:  equals
  → Value:      Done
```

### {{smart values}} condition

Vertaa kahta smart value -arvoa keskenään. Tukee myös regexejä.

```
Condition: {{smart values}} condition
  → First value:  {{lookupIssues.size}}
  → Condition:    greater than
  → Second value: 0
```

### If/else block

Haaroittaa flowin eri poluille. Tukee kahta sisäkkäistä tasoa.

```
IF:      {{webhookData.action}} equals "closed"
           → Transition work item → Done
ELSE IF: {{webhookData.action}} equals "reopened"
           → Transition work item → To Do
```

> **Tärkeä korjaus:** Vanhentunut `jira.condition.webhook.compare` ei enää toimi JSON-importissa.  
> Korvaa aina `jira.condition.if` (If/else block) -ehdolla.

---

## Smart Values -syntaksi

Virallinen dokumentaatio: https://support.atlassian.com/cloud-automation/docs/what-are-smart-values/

Smart valuesit käyttävät **mustache-syntaksia** ja **dot notation** -merkintää:

```
{{object.property.subProperty}}
```

### Tärkeimmät smart valuesit tässä projektissa

| Smart value | Palauttaa | Huomio |
|---|---|---|
| `{{webhookData.action}}` | GitHub-eventin tyyppi (`opened`, `closed`, `labeled`…) | |
| `{{webhookData.issue.number}}` | GitHub issue -numero | Kokonaisluku, ei lainausmerkkejä JQL:ssä |
| `{{webhookData.issue.title}}` | GitHub issue -otsikko | |
| `{{webhookData.issue.body}}` | GitHub issue -kuvaus | Markdown plain textinä |
| `{{webhookData.issue.html_url}}` | GitHub issue -URL | |
| `{{webhookData.issue.state}}` | Issue state (`open`/`closed`) | |
| `{{webhookData.issue.state_reason}}` | Sulkemisen syy (`completed`, `not_planned`, `duplicate`) | |
| `{{webhookData.issue.labels[*].name}}` | Kaikkien labelien nimet listana | Ei yksittäiseen labeliin |
| `{{webhookData.issue.assignee.login}}` | Assigneen GitHub-tunnus | Ei accountId |
| `{{webhookData.issue.milestone.title}}` | Milestonen nimi | |
| `{{webhookData.issue.milestone.due_on}}` | Milestonen eräpäivä (ISO 8601) | |
| `{{webhookData.label.name}}` | Lisätyn/poistetun labelin nimi | Vain labeled/unlabeled -eventissä |
| `{{webhookData.comment.body}}` | Kommentin sisältö | |
| `{{webhookData.comment.user.login}}` | Kommentoijan GitHub-tunnus | |
| `{{webhookData.repository.name}}` | Repositorion nimi (ilman organia) | `uutisseuranta.github.io` |
| `{{lookupIssues}}` | Lookup work items -actionin tulos (lista) | |
| `{{lookupIssues.first.key}}` | Ensimmäisen tuloksen avain (esim. `US-7`) | |
| `{{lookupIssues.size}}` | Tulosten lukumäärä | |
| `{{issue.key}}` | Nykyisen work itemin avain | |
| `{{issue.summary}}` | Nykyisen work itemin otsikko | |
| `{{issue.status.name}}` | Nykyisen tilan nimi | |
| `{{issue.priority.name}}` | Prioriteetin nimi | |
| `{{issue.assignee.displayName}}` | Assigneen Jira-näyttönimi | |
| `{{issue.assignee.name}}` | Assigneen Jira-käyttäjätunnus | |
| `{{issue.customfield_10071}}` | `source_repo` -kentän arvo | Käytä ID:tä, ei display-nimeä |
| `{{issue.customfield_10072}}` | `github_issue_number` -kentän arvo | |
| `{{issue.customfield_10073}}` | `github_url` -kentän arvo | |
| `{{issue.updated.epochMillis}}` | Viimeinen päivitysaika millisekunteina | Silmukan esto |
| `{{now}}` | Nykyinen aika | |
| `{{now.epochMillis}}` | Nykyinen aika millisekunteina | |

### Oletusarvo (fallback, jos kenttä on tyhjä)

```
{{issue.assignee.displayName | "Ei vastuuhenkilöä"}}
```

### Listoja läpi käyminen (for each)

```
{{#lookupIssues}}
  * {{key}}: {{summary}}
{{/}}
```

### Merkkijonon muunnokset

```
{{issue.priority.name | toLower}}   → "high" → "high"
{{issue.priority.name | toUpper}}   → "HIGH"
{{issue.summary | substring(0,50)}} → ensimmäiset 50 merkkiä
```

---

## Webhook-data-rakenne (`{{webhookData}}`)

GitHub lähettää seuraavan rakenteen (issues event + issue_comment event):

```json
{
  "action": "opened",
  "issue": {
    "number": 42,
    "title": "Fix login bug",
    "body": "Description...",
    "html_url": "https://github.com/uutisseuranta/uutisseuranta.github.io/issues/42",
    "state": "open",
    "state_reason": null,
    "labels": [{"name": "bug"}],
    "assignees": [{"login": "username"}],
    "assignee": {"login": "username"},
    "milestone": {
      "title": "v1.0",
      "due_on": "2026-08-01T00:00:00Z",
      "number": 1
    },
    "user": {"login": "username"}
  },
  "comment": {
    "id": 123456,
    "body": "Comment text",
    "user": {"login": "commenter"}
  },
  "label": {
    "name": "bug"
  },
  "repository": {
    "name": "uutisseuranta.github.io",
    "full_name": "uutisseuranta/uutisseuranta.github.io"
  },
  "sender": {
    "login": "triggering-user"
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
          curl -s -X POST \
            "$JIRA_WEBHOOK_URL" \
            -H "Content-Type: application/json" \
            -H "X-Automation-Webhook-Token: $JIRA_WEBHOOK_TOKEN" \
            --data-binary @- \
            -w "\nHTTP %{http_code}\n"
```

> **Huom:** `JIRA_WEBHOOK_TOKEN` ja `JIRA_WEBHOOK_URL` tulee olla GitHub Secrets -muuttujina,  
> ei plain textinä koodissa. `-w "\nHTTP %{http_code}"` tulostaa HTTP-statuskoodin lokiin.

---

## JSON Import -huomiot

Jira hyväksyy vain JSONin joka vastaa **Export rules** -rakennetta.

### Tunnettu vanhentunut komponentti

```text
IllegalStateException: Component for type ComponentTypeKey{
  component=CONDITION, type='jira.condition.webhook.compare'
} no longer exists.
```

**Syy:** `jira.condition.webhook.compare` on poistunut tuettujen importoitavien  
komponenttityyppien listalta.  
**Korjaus:** Korvaa `jira.condition.if` (If/else block) -ehdolla — ei webhook-specific compare-conditioneja.

---

## Toteutusjärjestys

| Vaihe | Kuvaus | Tila |
|---|---|---|
| 1 | Luo custom-kentät Jira-projektiin (`source_repo`, `github_issue_number`, `github_url`) | ✅ VALMIS |
| 2 | Asenna GitHub for Atlassian -app ja liitä repot (kehityspaneeli) | ✅ VALMIS |
| 3 | Tallenna GitHub PAT ja Jira webhook-token GitHub Secrets -muuttujiin | ✅ VALMIS |
| 4 | Luo GitHub Actions -relay kaikille kolmelle repolle | ✅ VALMIS |
| 5 | Sääntö 1: GitHub → Jira, issue opened | ✅ VALMIS (US-7) |
| 6 | Säännöt 2–8: loput GitHub → Jira -flowledet | 🔄 JSON valmis, testaamatta |
| 7 | Säännöt 9–15: Jira → GitHub -flowledet | 📋 Suunniteltu |
| 8 | Backfill-ajo kaikille avoimille issueille | 📋 Suunniteltu |

---

## Debuggaus

### Curl-testi manuaalisesti

```bash
curl -s -X POST \
  "${JIRA_WEBHOOK_URL}" \
  -H "Content-Type: application/json" \
  -H "X-Automation-Webhook-Token: ${JIRA_WEBHOOK_TOKEN}" \
  -d '{"action":"opened","issue":{"number":999,"title":"Test","body":"Test body","html_url":"https://github.com/uutisseuranta/uutisseuranta.github.io/issues/999"},"repository":{"name":"uutisseuranta.github.io"}}' \
  -w "\nHTTP %{http_code}\n"
```

### Yleisimmät virheet

| Virhe | Syy | Korjaus |
|-------|-----|--------|
| `Missing token` (400) | Token query-parametrina eikä headerissa | Käytä `X-Automation-Webhook-Token` headeria |
| `No work items from the webhook` (trigger-asetus) | Trigger-asetus väärä | Vaihda **No work items from the webhook** |
| `The project or issue type wasn't set` | Space/work item type "Copy from trigger" | Aseta kiinteät arvot dropdownista |
| `Fields ignored: customfield_10071` | Kenttä ei ole projektissa | Lisää kenttä **Project settings → Fields** |
| `Component ... no longer exists` | JSON sisältää vanhan komponenttityypin | Käytä `jira.condition.if` |
| Transition not found | Transition-nimi väärä | Tarkista **Project Settings → Workflows** |
| `{{lookupIssues}}` tyhjä | JQL ei löydä work itemejä | Tarkista `cf[10072]` -arvo ja `cf[10071]` -quoted string |
| `{{issue.customfield_10071}}` tyhjä | Väärä smart value -syntaksi | Käytä `customfield_10071`, ei display-nimeä `source_repo` |
| HTTP 422 GitHub API | Assignee-login ei ole GitHub-käyttäjä | Katso käyttäjäkartoitus-osio |

### Automation-lokit

Audit log löytyy: **Jira Settings → Automation → Audit log**  
Filter: Work item key (esim. `US-7`) tai ajanjakso.

---

## Rajoitukset ja hyväksytyt kompromissit

| Rajoitus | Päätös |
|---|---|
| Markdown → ADF-konversio | Hyväksytty: body tallennetaan Jiraan plain textinä ilman muotoilua |
| Sub-issues | Kielletty; ristikkäisviittaukset Jira issue link -tyypeillä |
| Sprint → GitHub natiivikäsite | Hyväksytty: sprint näkyy GitHubissa vain labelina `sprint:N` |
| Konfliktiresoluutio | Yksinkertainen sääntö: uudempi `updated_at` voittaa + 5 s silmukkaikkuna |
| GitHub-käyttäjä ≠ Jira-käyttäjä | Vaihe 1: tunnusten pitää vastata toisiaan. Vaihe 2: voidaan rakentaa Create lookup table -toiminnolla user-mapping-taulukko |
| Automation-kutsumäärä | Jira Automation Free: 500 kutsua/kk. Jos ylittyy, harkitse GitHub Apps -webhookia suorana. |

---

## Linkit

- [Cloud Automation — resources](https://support.atlassian.com/cloud-automation/resources/)
- [Jira Automation triggers](https://support.atlassian.com/cloud-automation/docs/jira-automation-triggers/)
- [Jira Automation actions](https://support.atlassian.com/cloud-automation/docs/jira-automation-actions/)
- [Jira Automation conditions](https://support.atlassian.com/cloud-automation/docs/jira-automation-conditions/)
- [Smart values — overview](https://support.atlassian.com/cloud-automation/docs/what-are-smart-values/)
- [Smart values — issues](https://support.atlassian.com/cloud-automation/docs/smart-values-issues/)
- [Jira Automation branches](https://support.atlassian.com/cloud-automation/docs/jira-automation-branches/)
- [Automation template library](https://www.atlassian.com/software/jira/automation-template-library)
- [Jira Cloud REST API v3](https://developer.atlassian.com/cloud/jira/platform/rest/v3/)
- [GitHub Issues API](https://docs.github.com/en/rest/issues/issues)
