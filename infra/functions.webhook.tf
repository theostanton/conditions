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
    available_memory   = "256Mi" # Monitor actual usage - may be able to reduce to 128Mi
    timeout_seconds    = 60
    max_instance_count = 10 # Limit concurrent instances to prevent abuse/unexpected costs
    environment_variables = {
      TELEGRAM_BOT_TOKEN = var.telegram_bot_token
      PGHOST             = "/cloudsql/${google_sql_database_instance.instance.connection_name}"
      PGDATABASE         = var.db_database
      PGUSER             = var.db_user
      PGPASSWORD         = var.db_password
      METEOFRANCE_TOKEN  = var.meteofrance_token
      GOOGLE_PROJECT_ID  = local.project_id
    }
  }


  name = "bot"
}


resource "google_cloud_run_v2_service_iam_binding" "webhook" {
  name     = google_cloudfunctions2_function.webhook.service_config[0].service
  location = local.region
  role     = "roles/run.invoker"
  members  = ["allUsers"]
  project  = local.project_id
}

resource "null_resource" "webhook_cloud_sql" {
  depends_on = [google_cloudfunctions2_function.webhook]

  triggers = {
    function_id = google_cloudfunctions2_function.webhook.id
  }

  provisioner "local-exec" {
    command = "gcloud run services update ${google_cloudfunctions2_function.webhook.name} --add-cloudsql-instances ${google_sql_database_instance.instance.connection_name} --region ${local.region} --project ${local.project_id}"
  }
}

resource "null_resource" "webhook_set" {
  depends_on = [null_resource.webhook_cloud_sql]

  triggers = {
    webhook_uri = google_cloudfunctions2_function.webhook.service_config[0].uri
  }

  provisioner "local-exec" {
    command = "curl -X POST 'https://api.telegram.org/bot${var.telegram_bot_token}/setWebhook' -d 'url=${google_cloudfunctions2_function.webhook.service_config[0].uri}'"
  }
}

output "webhook_url" {
  value = google_cloudfunctions2_function.webhook.service_config[0].uri
}
