data "archive_file" "webhooks" {
  type        = "zip"
  source_dir  = "${path.module}/../webhooks/dist"
  output_path = "${path.module}/../dist/functions.zip"
}

resource "google_storage_bucket" "webhooks" {
  name     = "${local.project_id}-webhooks"
  location = local.region
}

resource "google_storage_bucket_object" "webhooks" {
  name   = "${data.archive_file.webhooks.output_md5}.zip"
  bucket = google_storage_bucket.webhooks.name
  source = data.archive_file.webhooks.output_path
}


resource "google_cloudfunctions2_function" "webhooks" {


  depends_on = [google_project_service.cloud_run_api]
  location = local.region
  project  = local.project_id

  build_config {
    entry_point = "HTTPFunction"
    runtime     = "nodejs14"
    source {
      storage_source {
        bucket = google_storage_bucket.webhooks.name
        object = google_storage_bucket_object.webhooks.name
      }
    }
  }

  service_config {
    available_memory = "128Mi"
    timeout_seconds  = 60
  }


  name = "webhooks"
  # service_account_email = google_service_account.function-sa.email
}


resource "google_cloud_run_v2_service_iam_binding" "webhooks" {
  name     = google_cloudfunctions2_function.webhooks.name
  location = local.region
  role     = "roles/run.invoker"
  members = ["allUsers"]
}

output "webhook_function_url" {
  value = google_cloudfunctions2_function.webhooks.service_config[0].uri
}