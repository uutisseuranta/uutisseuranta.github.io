# GitHub → Jira Automation — Toteutussuunnitelma

> Päivitetty Atlassian Cloud Automation -dokumentaation pohjalta (2026-07-03)  
> Viralliset ohjeet: https://support.atlassian.com/cloud-automation/resources/

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

## Arkkitehtuuriratkaisu

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

## Flowien rakenne

Jira Automation -flow koostuu kolmesta osasta järjestyksessä:

```
TRIGGER  →  [CONDITIONS]  →  ACTIONS
```

1. **Trigger** — Käynnistää flowin. Kuuntelee tapahtumia Jirassa tai ulkoisista lähteistä.
2. **Condition** (valinnainen) — Suodatin. Jos ehto ei täyty, flow pysähtyy. Voidaan laittaa mihin kohtaan flowia tahansa.
3. **Action** — Tekee jotain (muuttaa kenttiä, lähettää viestin, siirtää tilan jne.).

---

## Jira Custom Fields (tässä projektissa)

| customfield ID | Display name | Tyyppi | Arvo |
|---|---|---|---|
| customfield_10071 | `source_repo` | Text | `{{webhookData.repository.name}}` |
| customfield_10072 | `github_issue_number` | Number | `{{webhookData.issue.number}}` |
| customfield_10073 | `github_url` | URL | `{{webhookData.issue.html_url}}` |

> **Haku JQL:llä:** `cf[10072]` = customfield_10072

---

## Sääntö 1: GitHub issue opened → Luo Jira work item ✅

**Tila:** VALMIS — testattu, work item US-7 luotu onnistuneesti 3.7.2026

### Trigger

| Asetus | Arvo |
|--------|------|
| Tyyppi | **Incoming webhook** |
| Work item criteria | **No work items from the webhook** |

### Action: Create work item

| Kenttä | Arvo |
|--------|------|
| Space | `Uutisseuranta (US)` |
| Work item type | `Story` |
| Summary | `{{webhookData.issue.title}}` |
| Description | `{{webhookData.issue.body}}` |

### Advanced fields (JSON)

```json
{
  "fields": {
    "customfield_10071": "{{webhookData.repository.name}}",
    "customfield_10072": {{webhookData.issue.number}},
    "customfield_10073": "{{webhookData.issue.html_url}}"
  }
}
```

---

## Sääntö 2: GitHub issue closed → Transition work item → Done

**Tila:** JSON v2 valmis, testaamatta

### Flow-rakenne

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
```

> **Huom:** Transition-nimi `Done` täytyy täsmätä täsmälleen Jiran workflow-konfiguraatioon.  
> Tarkista: **Project Settings → Workflows → [workflow] → Edit**

---

## Sääntö 3: GitHub issue reopened → Transition work item → To Do

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

## Sääntö 4: GitHub issue labeled → Edit work item labels

**Tila:** JSON v2 valmis, testattava

```
Trigger: Incoming webhook
  → webhookData.action == "labeled"

Action: Lookup work items
  → JQL: project = US AND cf[10072] = {{webhookData.issue.number}}

Action: Edit work item
  → Field: Labels
  → Operation: Add
  → Value: {{webhookData.label.name}}
```

---

## Sääntö 5: GitHub issue comment → Comment on work item

**Tila:** JSON v2 valmis, testaamatta

```
Trigger: Incoming webhook
  → webhookData.action == "created"  (comment event)

Action: Lookup work items
  → JQL: project = US AND cf[10072] = {{webhookData.issue.number}}

Action: Comment on work item
  → Comment: "**GitHub-kommentti** (@{{webhookData.comment.user.login}}):
              {{webhookData.comment.body}}"
```

---

## Sääntö 6: Jira status muutos → Päivitä GitHub issue (TODO)

## Sääntö 7: Jira kommentti → Lisää GitHub issue comment (TODO)

## Sääntö 8: Jira work item suljettu → Sulje GitHub issue (TODO)

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
| `{{webhookData.label.name}}` | Lisätyn labelin nimi |
| `{{webhookData.comment.body}}` | Kommentin sisältö |
| `{{webhookData.comment.user.login}}` | Kommentoijan GitHub-tunnus |
| `{{webhookData.repository.name}}` | Repositorion nimi |
| `{{lookupIssues}}` | Lookup work items -actionin tulokset |
| `{{lookupIssues.first.key}}` | Ensimmäisen löydetyn work itemin avain (esim. `US-7`) |
| `{{lookupIssues.size}}` | Löydettyjen work itemien lukumäärä |
| `{{issue.key}}` | Nykyisen work itemin avain |
| `{{issue.status.name}}` | Nykyisen tilan nimi |
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
    "labels": [{"name": "bug"}],
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
          JIRA_WEBHOOK_TOKEN: 4aed5c2e19b6532368342c136e1f7211ce709f50
          JIRA_WEBHOOK_URL: https://api-private.atlassian.com/automation/webhooks/jira/a/042ceae5-c99b-4174-9d44-46a2d26e9c05/019f288b-703a-7e52-bd20-d9cb4f5cb560
        run: |
          echo '${{ toJson(github.event) }}' | \
          curl -X POST \
            "$JIRA_WEBHOOK_URL" \
            -H "Content-Type: application/json" \
            -H "X-Automation-Webhook-Token: $JIRA_WEBHOOK_TOKEN" \
            --data-binary @-
```

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

## Debuggaus

### Curl-testi manuaalisesti

```bash
curl -X POST \
  "https://api-private.atlassian.com/automation/webhooks/jira/a/042ceae5-c99b-4174-9d44-46a2d26e9c05/019f288b-703a-7e52-bd20-d9cb4f5cb560" \
  -H "Content-Type: application/json" \
  -H "X-Automation-Webhook-Token: 4aed5c2e19b6532368342c136e1f7211ce709f50" \
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

## Linkit

- [Automation triggers](https://support.atlassian.com/cloud-automation/docs/jira-automation-triggers/)
- [Automation actions](https://support.atlassian.com/cloud-automation/docs/jira-automation-actions/)
- [Automation conditions](https://support.atlassian.com/cloud-automation/docs/jira-automation-conditions/)
- [Smart values](https://support.atlassian.com/cloud-automation/docs/what-are-smart-values/)
- [Automation branches](https://support.atlassian.com/cloud-automation/docs/jira-automation-branches/)
- [Template library](https://www.atlassian.com/software/jira/automation-template-library)
