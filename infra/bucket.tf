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

  # Enable caching
  cache_control = "public, max-age=3600"
}

# Make landing page publicly readable
resource "google_storage_object_access_control" "landing_page_public" {
  object = google_storage_bucket_object.landing_page.name
  bucket = google_storage_bucket.bras.name
  role   = "READER"
  entity = "allUsers"
}
