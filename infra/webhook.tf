resource "google_cloudfunctions2_function" "webhook" {

  depends_on = [google_project_service.cloud_run_api]
  location = local.region
  project  = local.project_id

  build_config {
    entry_point = "HTTPFunction"
    runtime     = "nodejs14"
    source {
      storage_source {
        bucket = google_storage_bucket.functions.name
        object = google_storage_bucket_object.functions.name
      }
    }
  }

  service_config {
    available_memory = "128Mi"
    timeout_seconds  = 60
  }


  name = "webhook"
  # service_account_email = google_service_account.function-sa.email
}


resource "google_cloud_run_v2_service_iam_binding" "webhook" {
  name     = google_cloudfunctions2_function.webhook.name
  location = local.region
  role     = "roles/run.invoker"
  members = ["allUsers"]
}

output "webhook_url" {
  value = google_cloudfunctions2_function.webhook.service_config[0].uri
}