data "cloudflare_zone" "main" {
  zone_id = var.cloudflare_zone_id
}

resource "cloudflare_dns_record" "main" {
  zone_id = var.cloudflare_zone_id
  name    = "keypad-flasher.${data.cloudflare_zone.main.name}"
  type    = "CNAME"
  content = azurerm_container_app.main.ingress[0].fqdn
  ttl     = 1
  proxied = false
}

resource "cloudflare_dns_record" "main_validation" {
  zone_id = var.cloudflare_zone_id
  name    = "asuid.keypad-flasher.${data.cloudflare_zone.main.name}"
  type    = "TXT"
  content = azurerm_container_app.main.custom_domain_verification_id
  ttl     = 1
  proxied = false
}
