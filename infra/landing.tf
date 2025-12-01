# ========================================
# Landing Page Infrastructure
# ========================================
#
# This file contains all resources for the landing page at conditionsreport.com
# including DNS, Worker, and redirect configuration for conditionsreports.com (plural)

# ========================================
# conditionsreport.com (primary domain)
# ========================================

# Get zone data for conditionsreport.com
data "cloudflare_zone" "main" {
  name = "conditionsreport.com"
}

# DNS Record - Root domain
resource "cloudflare_record" "root" {
  zone_id = data.cloudflare_zone.main.id
  name    = "@"
  content = "192.0.2.1" # Placeholder IP (Worker handles routing)
  type    = "A"
  proxied = true
  comment = "Landing page via Cloudflare Worker"
}

# DNS Record - www subdomain
resource "cloudflare_record" "www" {
  zone_id = data.cloudflare_zone.main.id
  name    = "www"
  content = "conditionsreport.com"
  type    = "CNAME"
  proxied = true
  comment = "Redirect www to root"
}

# Cloudflare Worker script for landing page
resource "cloudflare_worker_script" "landing_page" {
  account_id = var.cloudflare_account_id
  name       = "conditionsreport-landing"
  content    = file("${path.module}/../landing/landing-page.js")
}

# Route Worker to primary domain
resource "cloudflare_worker_route" "landing_page" {
  zone_id     = data.cloudflare_zone.main.id
  pattern     = "conditionsreport.com/*"
  script_name = cloudflare_worker_script.landing_page.name
}

# ========================================
# conditionsreports.com (plural - redirect to singular)
# ========================================

# Get zone data for conditionsreports.com
data "cloudflare_zone" "plural" {
  name = "conditionsreports.com"
}

# DNS Record - Root domain for plural (redirects to singular)
resource "cloudflare_record" "plural_root" {
  zone_id = data.cloudflare_zone.plural.id
  name    = "@"
  content = "192.0.2.1" # Placeholder IP (Worker handles redirect)
  type    = "A"
  proxied = true
  comment = "Redirect to conditionsreport.com (singular)"
}

# DNS Record - www subdomain for plural
resource "cloudflare_record" "plural_www" {
  zone_id = data.cloudflare_zone.plural.id
  name    = "www"
  content = "conditionsreports.com"
  type    = "CNAME"
  proxied = true
  comment = "Redirect www to root, then to singular domain"
}

# Route Worker to plural domain for redirect
resource "cloudflare_worker_route" "plural_landing_page" {
  zone_id     = data.cloudflare_zone.plural.id
  pattern     = "conditionsreports/cle.com/*"
  script_name = cloudflare_worker_script.landing_page.name
}

# ========================================
# Outputs
# ========================================

output "landing_page_url" {
  value       = "https://conditionsreport.com"
  description = "Landing page URL"
}

output "redirect_url" {
  value       = "https://conditionsreports.com → https://conditionsreport.com"
  description = "Plural domain redirects to singular"
}
