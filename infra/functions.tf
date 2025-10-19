data "archive_file" "functions" {
  type        = "zip"
  source_dir  = "${path.module}/../functions/dist"
  output_path = "${path.module}/../dist/functions.zip"
}

resource "google_storage_bucket" "functions" {
  name     = "${local.project_id}-functions"
  location = local.region
}

resource "google_storage_bucket_object" "functions" {
  name   = "${data.archive_file.functions.output_md5}.zip"
  bucket = google_storage_bucket.functions.name
  source = data.archive_file.functions.output_path
}
