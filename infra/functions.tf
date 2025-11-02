data "archive_file" "functions" {
  type        = "zip"
  source_dir  = "${path.module}/../dist/functions"
  output_path = "${path.module}/../dist/functions.zip"
}

resource "google_storage_bucket" "functions" {
  name          = "${local.project_id}-functions"
  location      = local.region
  force_destroy = true

  # Automatically delete old deployment archives after 30 days
  lifecycle_rule {
    condition {
      age = 30 # days
    }
    action {
      type = "Delete"
    }
  }
}

resource "google_storage_bucket_object" "functions" {
  name   = "${data.archive_file.functions.output_md5}.zip"
  bucket = google_storage_bucket.functions.name
  source = data.archive_file.functions.output_path
}
