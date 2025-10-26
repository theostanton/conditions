resource "google_cloudfunctions2_function" "webhook" {

  depends_on = [google_project_service.cloud_run_api]
  location   = local.region
  project    = local.project_id

  build_config {
    entry_point = "botWebhook"
    runtime     = "nodejs20"
    source {
      storage_source {
        bucket = google_storage_bucket.functions.name
        object = google_storage_bucket_object.functions.name
      }
    }
  }

  service_config {
    available_memory = "256Mi"
    timeout_seconds  = 60
    environment_variables = {
      TELEGRAM_BOT_TOKEN = var.telegram_bot_token
      PGHOST             = "/cloudsql/${google_sql_database_instance.instance.connection_name}"
      PGDATABASE         = var.pg_database
      PGUSER             = var.pg_user
      PGPASSWORD         = var.pg_password
      METEOFRANCE_TOKEN  = var.meteofrance_token
      GOOGLE_PROJECT_ID  = local.project_id
    }
  }


  name = "botWebhook"
  # service_account_email = google_service_account.function-sa.email
}


resource "google_cloud_run_v2_service_iam_binding" "webhook" {
  name     = google_cloudfunctions2_function.webhook.service_config[0].service
  location = local.region
  role     = "roles/run.invoker"
  members  = ["allUsers"]
  project  = local.project_id
}

data "http" "webhook_set" {
  lifecycle {
    replace_triggered_by = [google_cloudfunctions2_function.webhook.service_config[0].uri]
  }
  url    = "https://api.telegram.org/bot${var.telegram_bot_token}/setWebhook"
  method = "POST"
  request_headers = {
    Content-type = "application/x-www-form-urlencoded"
  }
  request_body = "url=${google_cloudfunctions2_function.webhook.service_config[0].uri}"
}

output "webhook_set_result" {
  value = data.http.webhook_set.response_body
}

output "webhook_url" {
  value = google_cloudfunctions2_function.webhook.service_config[0].uri
}
