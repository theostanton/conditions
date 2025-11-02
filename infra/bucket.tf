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
