resource "google_storage_bucket" "bras" {
  name     = "${local.project_id}-bras"
  location                    = local.region
  force_destroy               = true
  uniform_bucket_level_access = false
}

resource "google_storage_bucket_access_control" "bras" {
  bucket = google_storage_bucket.bras.name
  role   = "READER"
  entity = "allUsers"
}

# Upload landing page to GCS
resource "google_storage_bucket_object" "landing_page" {
  name         = "landing/index.html"
  bucket       = google_storage_bucket.bras.name
  source       = "${path.module}/../landing/index.html"
  content_type = "text/html"

  # Detect content changes
  detect_md5hash = filemd5("${path.module}/../landing/index.html")

  # Enable caching
  cache_control = "public, max-age=3600"
}

# Purge Cloudflare cache when landing page changes
resource "terraform_data" "purge_landing_cache" {
  triggers_replace = google_storage_bucket_object.landing_page.md5hash

  provisioner "local-exec" {
    command = <<-EOT
      curl -s -X POST "https://api.cloudflare.com/client/v4/zones/${data.cloudflare_zone.main.id}/purge_cache" \
        -H "Authorization: Bearer ${var.cloudflare_api_token}" \
        -H "Content-Type: application/json" \
        --data '{"purge_everything":true}'
    EOT
  }
}

# Make landing page publicly readable
resource "google_storage_object_access_control" "landing_page_public" {
  object = google_storage_bucket_object.landing_page.name
  bucket = google_storage_bucket.bras.name
  role   = "READER"
  entity = "allUsers"
}
