# ========================================
# Cloudflare Provider Configuration
# ========================================
#
# Global Cloudflare provider setup
# Specific resources are defined in their respective files:
# - landing.tf: Landing page DNS, Worker, and redirects

terraform {
  required_providers {
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "~> 4.0"
    }
  }
}

provider "cloudflare" {
  api_token = var.cloudflare_api_token
}

# Note: SSL/TLS settings (always_use_https, min TLS 1.2, etc.)
# can be configured manually in Cloudflare dashboard if needed.
# zone_settings_override removed due to API token permissions.
