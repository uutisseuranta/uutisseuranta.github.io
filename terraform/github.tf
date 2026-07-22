# terraform/github.tf
# GitHub-repositorion hallinta: branch protection ja labelit.
#
# Korvaa:
#   .github/labels.yml           → kaikki github_issue_label -resurssit
#   .github/workflows/sync-labels.yml → ei enää tarvita kun labelit
#                                       hallitaan Terraformista
#
# Issue-viittaukset:
#   #28  Security Hardening – branch protection
#   #26  README ja nimeämiskonventio – labelit

# ── Branch protection ──────────────────────────────────────────────────────────
resource "github_branch_protection" "main" {
  repository_id = "uutisseuranta.github.io"
  pattern       = "main"

  required_status_checks {
    strict   = true
    contexts = var.required_ci_checks
  }

  required_pull_request_reviews {
    dismiss_stale_reviews           = true
    required_approving_review_count = 1
  }

  enforce_admins = false
}

# ── Jira-synklabelit (säilytetään .github/labels.yml:stä) ─────────────────────
# Priority-labelit (Jira-sync)
resource "github_issue_label" "priority_highest" {
  repository  = "uutisseuranta.github.io"
  name        = "priority:highest"
  color       = "b71c1c"
  description = "Jira: Highest priority"
}

resource "github_issue_label" "priority_high_jira" {
  repository  = "uutisseuranta.github.io"
  name        = "priority:high"
  color       = "e53935"
  description = "Jira: High priority"
}

resource "github_issue_label" "priority_medium" {
  repository  = "uutisseuranta.github.io"
  name        = "priority:medium"
  color       = "fb8c00"
  description = "Jira: Medium priority"
}

resource "github_issue_label" "priority_low" {
  repository  = "uutisseuranta.github.io"
  name        = "priority:low"
  color       = "81c784"
  description = "Jira: Low priority"
}

resource "github_issue_label" "priority_lowest" {
  repository  = "uutisseuranta.github.io"
  name        = "priority:lowest"
  color       = "b0bec5"
  description = "Jira: Lowest priority"
}

# Sprint-labelit (Jira-sync)
resource "github_issue_label" "sprint_1" {
  repository  = "uutisseuranta.github.io"
  name        = "sprint:1"
  color       = "5c6bc0"
  description = "Jira Sprint 1"
}

resource "github_issue_label" "sprint_2" {
  repository  = "uutisseuranta.github.io"
  name        = "sprint:2"
  color       = "5c6bc0"
  description = "Jira Sprint 2"
}

resource "github_issue_label" "sprint_3" {
  repository  = "uutisseuranta.github.io"
  name        = "sprint:3"
  color       = "5c6bc0"
  description = "Jira Sprint 3"
}

resource "github_issue_label" "sprint_4" {
  repository  = "uutisseuranta.github.io"
  name        = "sprint:4"
  color       = "5c6bc0"
  description = "Jira Sprint 4"
}

resource "github_issue_label" "sprint_5" {
  repository  = "uutisseuranta.github.io"
  name        = "sprint:5"
  color       = "5c6bc0"
  description = "Jira Sprint 5"
}

# Status-labelit (Jira-sync)
resource "github_issue_label" "status_todo" {
  repository  = "uutisseuranta.github.io"
  name        = "status:to-do"
  color       = "eceff1"
  description = "Jira: To Do"
}

resource "github_issue_label" "status_in_progress" {
  repository  = "uutisseuranta.github.io"
  name        = "status:in-progress"
  color       = "f9a825"
  description = "Jira: In Progress"
}

resource "github_issue_label" "status_in_review" {
  repository  = "uutisseuranta.github.io"
  name        = "status:in-review"
  color       = "0288d1"
  description = "Jira: In Review"
}

resource "github_issue_label" "status_done" {
  repository  = "uutisseuranta.github.io"
  name        = "status:done"
  color       = "388e3c"
  description = "Jira: Done"
}

# ── Milestone-labelit (release-suunnittelu) ────────────────────────────────────
resource "github_issue_label" "milestone_v09" {
  repository  = "uutisseuranta.github.io"
  name        = "milestone:v0.9"
  color       = "0075ca"
  description = "Feature complete – kaikki ydinominaisuudet toteutettu"
}

resource "github_issue_label" "milestone_v10" {
  repository  = "uutisseuranta.github.io"
  name        = "milestone:v1.0"
  color       = "006b75"
  description = "Production hardened – tietoturva, suorituskyky, GDPR"
}

# ── Prioriteettilabelit (kriittisyys ilman Jira-sidosta) ───────────────────────
resource "github_issue_label" "priority_critical" {
  repository  = "uutisseuranta.github.io"
  name        = "priority:critical"
  color       = "d93f0b"
  description = "Blokkaava – pakollinen ennen seuraavaa releasea"
}

# ── Aluetyyppilabelit ──────────────────────────────────────────────────────────
resource "github_issue_label" "area_security" {
  repository  = "uutisseuranta.github.io"
  name        = "area:security"
  color       = "b60205"
  description = "Tietoturva, GDPR, autentikointi – ks. #49, #50, #52"
}

resource "github_issue_label" "area_frontend" {
  repository  = "uutisseuranta.github.io"
  name        = "area:frontend"
  color       = "1d76db"
  description = "HTML, CSS, JS, komponentit"
}

resource "github_issue_label" "area_data" {
  repository  = "uutisseuranta.github.io"
  name        = "area:data"
  color       = "5319e7"
  description = "AS2-integraatio, API-kutsut, datavirta – ks. #12"
}

resource "github_issue_label" "area_ux" {
  repository  = "uutisseuranta.github.io"
  name        = "area:ux"
  color       = "c2e0c6"
  description = "Käyttäjäpolut, saavutettavuus, USER_PATHS.md"
}

resource "github_issue_label" "area_infra" {
  repository  = "uutisseuranta.github.io"
  name        = "area:infra"
  color       = "e4e669"
  description = "GitHub Pages, Firebase, CI/CD, Terraform"
}

# ── Tyyppi-labelit ─────────────────────────────────────────────────────────────
resource "github_issue_label" "type_bug" {
  repository  = "uutisseuranta.github.io"
  name        = "type:bug"
  color       = "ee0701"
  description = "Virhe – ks. #53 (themes broken)"
}

resource "github_issue_label" "type_feat" {
  repository  = "uutisseuranta.github.io"
  name        = "type:feat"
  color       = "84b6eb"
  description = "Uusi ominaisuus"
}

resource "github_issue_label" "type_chore" {
  repository  = "uutisseuranta.github.io"
  name        = "type:chore"
  color       = "cccccc"
  description = "Tekninen velka, refaktorointi – ks. #17, #18, #27"
}

resource "github_issue_label" "type_decision" {
  repository  = "uutisseuranta.github.io"
  name        = "type:decision"
  color       = "f5a623"
  description = "Arkkitehtuuripäätös – ks. #23 (persistointi)"
}

resource "github_issue_label" "type_blocked" {
  repository  = "uutisseuranta.github.io"
  name        = "type:blocked"
  color       = "e11d48"
  description = "Odottaa toisen issuen ratkaisua"
}
