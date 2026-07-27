# terraform/pages.tf
# GitHub Pages -konfiguraatio.
# Varmistaa että sivusto julkaistaan main-haaran juuresta
# ja custom domain uutisseuranta.net on asetettu (CNAME-tiedosto pysyy repossa).
#
# Issue-viittaukset:
#   #53  Themes broken – pages-deployn varmistus

resource "github_repository_pages" "site" {
  repository = "uutisseuranta.github.io"

  source {
    branch = var.default_branch
    path   = "/"
  }

  # HTTPS pakotetaan – tärkeä #52 CSP:n kannalta
  # (mixed content estetään vain jos oma domain käyttää HTTPS:ää)
}
