# GitHub → Jira Automation — Toteutussuunnitelma

## Arkkitehtuuriratkaisu

GitHub org-webhook ei tue custom HTTP-headereita, mutta Jira Automation v2.0
vaatii tokenin `X-Automation-Webhook-Token` -headerissa. Siksi käytetään
**GitHub Actions -workflowta** välittäjänä:

```
GitHub Issue event
      ↓
GitHub Actions (jira-webhook-relay.yml)
      ↓  POST + X-Automation-Webhook-Token header
Jira Automation Incoming Webhook
      ↓
Create Work Item (Jira)
```

Workflow on tallennettu: `.github/workflows/jira-webhook-relay.yml`

---

## Sääntö 1: GitHub issue opened → Luo Jira-tiketti ✅

**Tila:** TOIMII — tiketti US-6 luotu onnistuneesti 3.7.2026

### Webhook-endpoint

```
URL:   https://api-private.atlassian.com/automation/webhooks/jira/a/042ceae5-c99b-4174-9d44-46a2d26e9c05/019f288b-703a-7e52-bd20-d9cb4f5cb560
Token: 4aed5c2e19b6532368342c136e1f7211ce709f50 (X-Automation-Webhook-Token headerissa)
```

### Trigger-asetukset

| Asetus | Arvo |
|--------|------|
| Tyyppi | Incoming webhook |
| Work item criteria | **No work items from the webhook** |

> ⚠️ Valitse "No work items from the webhook" — ei "Issues provided in webhook body".
> "Issues provided" odottaa Jira-issuen keyä payloadissa, mutta tässä luodaan
> uusi issue GitHub-datasta.

### Create work item -toiminto

| Kenttä | Arvo | Huomio |
|--------|------|--------|
| Space | `Uutisseuranta (US)` (kiinteä) | **Ei** "Copy from trigger" |
| Issue type | `Story` (kiinteä) | **Ei** "Copy from trigger" |
| Summary | `{{webhookData.issue.title}}` | GitHub-issuen otsikko |
| Description | `{{webhookData.issue.body}}` | GitHub-issuen kuvaus |

### Custom fields (TODO)

Kentät customfield_10071, customfield_10072, customfield_10073 eivät ole
vielä käytössä projektissa — Jira ohittaa ne varoituksella:
`"The set fields may be unavailable for this project/type. Fields ignored"`

Näiden lisäämiseksi:
1. Jira → Project settings → Fields
2. Lisää kentät: `github_repo`, `github_issue_number`, `github_issue_url`
3. Selvitä oikeat customfield-ID:t (voi vaihdella instanssista)
4. Päivitä Advanced fields -JSON säännössä

### Advanced fields (JSON) — kun customfieldit on lisätty

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
| `No issues from the webhook` | Trigger-asetus väärä | Vaihda "No work items from the webhook" |
| `The project or issue type wasn't set` | Space/issuetype "Copy from trigger" | Aseta kiinteät arvot dropdownista |
| `Fields ignored: customfield_...` | Kenttä ei ole projektissa | Lisää kenttä Project settings → Fields |

---

## Seuraavat säännöt (TODO)

- [x] Sääntö 1: GitHub issue opened → Luo Jira-tiketti ✅
- [ ] Sääntö 2: GitHub issue closed → Sulje Jira-tiketti
- [ ] Sääntö 3: GitHub issue reopened → Avaa Jira-tiketti uudelleen
- [ ] Sääntö 4: GitHub issue labeled → Lisää label Jira-tikettiin
- [ ] Sääntö 5: GitHub issue comment → Lisää kommentti Jira-tikettiin
- [ ] Sääntö 6: Jira status muutos → Päivitä GitHub issue
- [ ] Sääntö 7: Jira kommentti → Lisää GitHub issue comment
- [ ] Sääntö 8: Jira tiketti suljettu → Sulje GitHub issue
