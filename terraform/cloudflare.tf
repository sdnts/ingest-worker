variable "cf_token" {
  sensitive = true
}

variable "cloudflare" {
  type = object({
    account_id = string
    zone_id    = string
  })
  default = {
    account_id = "80fc72b66f7c5acd95b33a5460f58c88"
    zone_id    = "a9b43f5d4d70ebab535036f44366d922"
  }
}

////////////////////////////////

provider "cloudflare" {
  api_token = var.cf_token
}

data "cloudflare_ip_ranges" "ips" {}
data "cloudflare_access_identity_provider" "github" {
  name    = "GitHub"
  zone_id = var.cloudflare.zone_id
}

////////////////////////////////

resource "cloudflare_record" "records" {
  for_each = toset(["influxdb-o", "loki-o", "telegraf-o", "grafana-o"])
  zone_id  = var.cloudflare.zone_id
  name     = each.key
  type     = "A"
  value    = hcloud_server.olly.ipv4_address
  ttl      = 1
  proxied  = true
}

// --- InfluxDB ---
resource "cloudflare_access_application" "influxdb" {
  zone_id                   = var.cloudflare.zone_id
  name                      = "[Olly] InfluxDB"
  domain                    = "influxdb-o.sdnts.dev"
  type                      = "self_hosted"
  allowed_idps              = [data.cloudflare_access_identity_provider.github.id]
  auto_redirect_to_identity = true
  session_duration          = "24h"
  logo_url                  = "https://www.influxdata.com/wp-content/uploads/cubo.svg"
}
resource "cloudflare_access_policy" "influxdb" {
  zone_id        = var.cloudflare.zone_id
  application_id = cloudflare_access_application.influxdb.id
  precedence     = 1
  name           = "GitHub"
  decision       = "allow"
  include {
    email        = [var.email]
    login_method = ["GitHub"]
  }
}

// Grafana
resource "cloudflare_access_application" "grafana" {
  zone_id                   = var.cloudflare.zone_id
  name                      = "[Olly] Grafana"
  domain                    = "grafana-o.sdnts.dev"
  type                      = "self_hosted"
  allowed_idps              = [data.cloudflare_access_identity_provider.github.id]
  auto_redirect_to_identity = true
  session_duration          = "24h"
  logo_url                  = "https://grafana.com/static/assets/img/fav32.png"
}
resource "cloudflare_access_policy" "grafana" {
  zone_id        = var.cloudflare.zone_id
  application_id = cloudflare_access_application.grafana.id
  precedence     = 1
  name           = "GitHub"
  decision       = "allow"
  include {
    email        = ["siddhant@fastmail.com"]
    login_method = ["GitHub"]
  }
}

// Telegraf
resource "cloudflare_access_application" "telegraf" {
  zone_id          = var.cloudflare.zone_id
  name             = "[Olly] Telegraf"
  domain           = "telegraf-o.sdnts.dev"
  type             = "self_hosted"
  session_duration = "24h"
  logo_url         = "https://portal.influxdata.com/assets/favicon-36b5b4080e5acaf2f320acc4e69292fed4f66815359e6a93d4a56e3dc1536c24.png"
}
resource "cloudflare_access_policy" "telegraf" {
  zone_id        = var.cloudflare.zone_id
  application_id = cloudflare_access_application.telegraf.id
  precedence     = 1
  name           = "Service Token"
  decision       = "non_identity"
  include {
    service_token = ["02fbe0e2-4085-4152-9ecc-99116d0f4d38"] # ingest-worker
  }
}

////////////////////////////////

output "domains" {
  value = [
    for r in cloudflare_record.records : r.hostname
  ]
}
