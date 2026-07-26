# Terraform Import – uutisseuranta.github.io

Tämä tiedosto dokumentoi `terraform import` -komennot kaikille resursseille
jotka ovat olemassa GitHub:ssa ennen `terraform apply`:n ensimmäistä ajoa.

Ilman importia Terraform yrittee **luoda** jo olemassa olevan resurssin ja
epäonnistuu `already exists` -virheellä.

## Edellytykset

```bash
cd terraform/
export GITHUB_TOKEN="ghp_..."   # tarvitaan kaikille GitHub-resursseille
terraform init
```

---

## 1. GitHub Pages

GitHub Pages on jo aktiivinen `uutisseuranta.github.io` -repositoriossa.

```bash
terraform import github_repository_pages.site uutisseuranta.github.io
```

---

## 2. Branch Protection (main)

```bash
terraform import github_branch_protection.main "uutisseuranta.github.io:main"
```

---

## 3. Labelit

Format: `terraform import github_issue_label.<resource_name> "<repo>:<label_name>"`

Ajo käsin label kerrallaan on hidasta. Käytä alla olevaa shell-skriptiä
jos labelit on jo olemassa repossa.

### Shell-skripti: tuo kaikki labelit kerralla

```bash
#!/usr/bin/env bash
# Tallenna tämä tiedostoon: terraform/import_labels.sh
# Käyttö: bash import_labels.sh
# Huom: terraform init pitää olla ajettu ensin.

set -e
REPO="uutisseuranta.github.io"

declare -A LABELS
# Jira-sync prioriteettilabelit
LABELS["priority_highest"]="priority:highest"
LABELS["priority_high_jira"]="priority:high"
LABELS["priority_medium"]="priority:medium"
LABELS["priority_low"]="priority:low"
LABELS["priority_lowest"]="priority:lowest"

# Sprint-labelit
LABELS["sprint_1"]="sprint:1"
LABELS["sprint_2"]="sprint:2"
LABELS["sprint_3"]="sprint:3"
LABELS["sprint_4"]="sprint:4"
LABELS["sprint_5"]="sprint:5"

# Status-labelit
LABELS["status_todo"]="status:to-do"
LABELS["status_in_progress"]="status:in-progress"
LABELS["status_in_review"]="status:in-review"
LABELS["status_done"]="status:done"

# Milestone-labelit
LABELS["milestone_v09"]="milestone:v0.9"
LABELS["milestone_v10"]="milestone:v1.0"

# Prioriteetti (ei Jira)
LABELS["priority_critical"]="priority:critical"

# Area-labelit
LABELS["area_security"]="area:security"
LABELS["area_frontend"]="area:frontend"
LABELS["area_data"]="area:data"
LABELS["area_ux"]="area:ux"
LABELS["area_infra"]="area:infra"

# Type-labelit
LABELS["type_bug"]="type:bug"
LABELS["type_feat"]="type:feat"
LABELS["type_chore"]="type:chore"
LABELS["type_decision"]="type:decision"
LABELS["type_blocked"]="type:blocked"

for resource_name in "${!LABELS[@]}"; do
  label_name="${LABELS[$resource_name]}"
  echo "Importing github_issue_label.${resource_name} <- ${label_name}"
  terraform import "github_issue_label.${resource_name}" "${REPO}:${label_name}" || \
    echo "  SKIP: ${label_name} ei löydy reposta (luodaan apply:ssä)"
done

echo ""
echo "Import valmis. Aja seuraavaksi: terraform plan"
```

### Yksittäiset import-komennot (käsin)

Jos jokin yksittäinen label pitää tuoda:

```bash
# Jira-sync
terraform import github_issue_label.priority_highest   "uutisseuranta.github.io:priority:highest"
terraform import github_issue_label.priority_high_jira "uutisseuranta.github.io:priority:high"
terraform import github_issue_label.priority_medium    "uutisseuranta.github.io:priority:medium"
terraform import github_issue_label.priority_low       "uutisseuranta.github.io:priority:low"
terraform import github_issue_label.priority_lowest    "uutisseuranta.github.io:priority:lowest"

terraform import github_issue_label.sprint_1           "uutisseuranta.github.io:sprint:1"
terraform import github_issue_label.sprint_2           "uutisseuranta.github.io:sprint:2"
terraform import github_issue_label.sprint_3           "uutisseuranta.github.io:sprint:3"
terraform import github_issue_label.sprint_4           "uutisseuranta.github.io:sprint:4"
terraform import github_issue_label.sprint_5           "uutisseuranta.github.io:sprint:5"

terraform import github_issue_label.status_todo        "uutisseuranta.github.io:status:to-do"
terraform import github_issue_label.status_in_progress "uutisseuranta.github.io:status:in-progress"
terraform import github_issue_label.status_in_review   "uutisseuranta.github.io:status:in-review"
terraform import github_issue_label.status_done        "uutisseuranta.github.io:status:done"

# Uudet labelit (eivät ole vielä repossa — näitä EI tarvitse importoida)
# terraform import github_issue_label.milestone_v09    "uutisseuranta.github.io:milestone:v0.9"
# terraform import github_issue_label.milestone_v10    "uutisseuranta.github.io:milestone:v1.0"
# terraform import github_issue_label.priority_critical "uutisseuranta.github.io:priority:critical"
# terraform import github_issue_label.area_security    "uutisseuranta.github.io:area:security"
# ... jne — apply luo nämä uusina
```

---

## 4. Täydellinen workflow ennen ensimmäistä apply:tä

```bash
cd terraform/

# 1. Alusta
terraform init

# 2. Tuo Pages ja branch protection
terraform import github_repository_pages.site uutisseuranta.github.io
terraform import github_branch_protection.main "uutisseuranta.github.io:main"

# 3. Tuo olemassa olevat labelit
bash import_labels.sh

# 4. Tarkista mitä Terraform aikoo tehdä
# Plan näyttää vain uudet labelit + mahdolliset värimuutokset
terraform plan

# 5. Aja
terraform apply
```

---

## 5. Virhetilanteet

### `Error: label already exists`
Label on repossa mutta sitä ei ole importoitu. Aja kyseisen labelin import-komento ja yritä uudelleen.

### `Error: Resource already managed by Terraform`
Label on jo Terraform state:ssa. Ei tarvitse tehdä mitään.

### `Error: Not Found (404)`
Label ei ole vielä repossa. Terraform luo sen `apply`:ssä. Poista `|| echo SKIP` ja anna Terraformin luoda se.

### Pages tai branch protection: `403 Forbidden`
GITHUB_TOKEN:lla pitää olla `repo`-scope sekä repositorion admin-oikeudet.
