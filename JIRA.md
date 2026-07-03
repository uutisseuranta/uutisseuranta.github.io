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

## Jira Automation — Sääntö 1: GitHub issue opened → Luo Jira-tiketti

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

> ⚠️ **Tärkeää:** Valitse "No work items from the webhook" — ei "Issues provided in webhook body".
> "Issues provided" odottaa Jira-issuen keyä payloadissa, mutta tässä luodaan
> uusi issue GitHub-datasta.

### Create Work Item -toiminto

| Kenttä | Arvo | Huomio |
|--------|------|--------|
| Project | `US` (kiinteä) | **Ei** "Copy from trigger" |
| Work item type | `Task` (kiinteä) | **Ei** "Copy from trigger" |
| Summary | `{{webhookData.issue.title}}` | GitHub-issuen otsikko |
| Description | `{{webhookData.issue.body}}` | GitHub-issuen kuvaus |
| customfield_10071 | `{{webhookData.repository.name}}` | Repon nimi |
| customfield_10072 | `{{webhookData.issue.number}}` | GitHub issue numero |
| customfield_10073 | `{{webhookData.issue.html_url}}` | GitHub issue URL |

> ⚠️ **"The project or issue type wasn't set" -virhe** syntyy jos Project tai
> Work item type on asetettu "Copy from trigger" -tilaan. Vaihda molemmat
> kiinteiksi arvoiksi dropdown-valikosta.

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
          echo '${{ toJson(github.event) }}' | \\
          curl -X POST \\
            "$JIRA_WEBHOOK_URL" \\
            -H "Content-Type: application/json" \\
            -H "X-Automation-Webhook-Token: $JIRA_WEBHOOK_TOKEN" \\
            --data-binary @-
```

---

## Debuggaus

### Curl-testi manuaalisesti

```bash
# Testaa että Jira vastaanottaa webhookin (pitää palauttaa HTTP 200)
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
| `The project or issue type wasn't set` | Project/issuetype "Copy from trigger" | Aseta kiinteät arvot dropdownista |

### Audit log

Jira Automation audit log:
`Project settings → Automation → Audit log`

Klikkaa yksittäinen suoritus auki nähdäksesi tarkan virheen triggerin ja
jokaisen toiminnon tasolla.

---

## Seuraavat säännöt (TODO)

- [ ] Sääntö 2: GitHub issue closed → Sulje Jira-tiketti
- [ ] Sääntö 3: GitHub issue reopened → Avaa Jira-tiketti uudelleen
- [ ] Sääntö 4: GitHub issue labeled → Lisää label Jira-tikettiin
- [ ] Sääntö 5: GitHub issue comment → Lisää kommentti Jira-tikettiin
- [ ] Sääntö 6: Jira status muutos → Päivitä GitHub issue
- [ ] Sääntö 7: Jira kommentti → Lisää GitHub issue comment
- [ ] Sääntö 8: Jira tiketti suljettu → Sulje GitHub issue
