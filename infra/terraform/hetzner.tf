variable "hcloud_token" {
  sensitive = true
}

////////////////////////////////

provider "hcloud" {
  token = var.hcloud_token
}

data "hcloud_ssh_key" "ssh_key" {
  name = "Callisto"
}

////////////////////////////////

resource "hcloud_server" "olly" {
  name        = "olly"
  server_type = "cpx11"
  image       = "debian-11"
  location    = "fsn1"
  ssh_keys    = [data.hcloud_ssh_key.ssh_key.id]
  backups     = true
  labels      = { "project" = "olly" }

  public_net {
    ipv4_enabled = true
    ipv6_enabled = true
  }

  user_data = templatefile(
    "${path.module}/cloud-init.yml",
    { ssh_public_key : data.hcloud_ssh_key.ssh_key.public_key }
  )
}

resource "hcloud_firewall" "firewall" {
  name   = "olly"
  labels = { "project" = "olly" }

  apply_to {
    label_selector = "project=olly"
  }

  rule {
    direction = "in"
    protocol  = "icmp"
    source_ips = [
      "0.0.0.0/0",
      "::/0"
    ]
  }

  rule {
    direction = "in"
    protocol  = "tcp"
    port      = "22"
    source_ips = [
      "0.0.0.0/0",
      "::/0"
    ]
  }

  rule {
    direction  = "in"
    protocol   = "tcp"
    port       = "443"
    source_ips = data.cloudflare_ip_ranges.ips.cidr_blocks
  }
}

////////////////////////////////

output "ip" {
  value = hcloud_server.olly.ipv4_address
}
