# terraform/main.tf
# Juuritason Terraform-konfiguraatio uutisseuranta.github.io -projektille.
#
# Tämä tiedosto kattaa GitHub-repositorion hallinnan:
#   .github/labels.yml          → github_issue_label -resurssit
#   sync-labels-workflow        → labelit hallitaan suoraan Terraformista
#   branch protection           → github_branch_protection
#
# GitHub Pages -konfiguraatio hoidetaan github_repository_pages -resurssilla.
#
# Issue-viittaukset:
#   #28  Security Hardening – branch protection
#   #52  CSP-otsakkeet (headers-konfiguraatio)
#   #53  Themes broken – pages-konfiguraation varmistus

terraform {
  required_version = ">= 1.7.0"
  required_providers {
    github = {
      source  = "integrations/github"
      version = "~> 6.0"
    }
  }

  # backend "gcs" {
  #   bucket = "uutisseuranta-activitystreams-tfstate"
  #   prefix = "terraform/frontend/state"
  # }
}

provider "github" {
  owner = "uutisseuranta"
  # token luetaan GITHUB_TOKEN-ympäristömuuttujasta
}
