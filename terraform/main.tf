terraform {
  required_version = "1.4.2"

  required_providers {
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "4.1.0"
    }

    hcloud = {
      source  = "hetznercloud/hcloud"
      version = "1.36.2"
    }
  }
}

variable "email" {
  sensitive = true
}
