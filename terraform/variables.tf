# terraform/variables.tf

variable "default_branch" {
  description = "Repon oletushaara"
  type        = string
  default     = "main"
}

variable "required_ci_checks" {
  description = "CI-tarkistukset jotka vaaditaan ennen mergeä"
  type        = list(string)
  default     = ["lint", "test"]
}
