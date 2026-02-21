resource "google_cloudfunctions2_function" "whatsapp_webhook" {

  depends_on = [google_project_service.cloud_run_api]
  location   = local.region
  project    = local.project_id

  build_config {
    entry_point = "whatsappWebhook"
    runtime     = "nodejs20"
    source {
      storage_source {
        bucket = google_storage_bucket.functions.name
        object = google_storage_bucket_object.functions.name
      }
    }
  }

  service_config {
    available_memory   = "256Mi"
    timeout_seconds    = 60
    min_instance_count = 1
    max_instance_count = 10
    environment_variables = {
      WA_PHONE_NUMBER_ID  = var.wa_phone_number_id
      WA_ACCESS_TOKEN     = var.wa_access_token
      WA_VERIFY_TOKEN     = var.wa_verify_token
      TELEGRAM_BOT_TOKEN  = var.telegram_bot_token # Required: shared code bundle loads grammY Bot at module level
      ANALYTICS_BOT_TOKEN = var.analytics_bot_token
      PGHOST              = "/cloudsql/${google_sql_database_instance.instance.connection_name}"
      PGDATABASE          = var.db_database
      PGUSER              = local.db_user
      PGPASSWORD          = var.db_password
      METEOFRANCE_TOKEN   = var.meteofrance_token
      GOOGLE_PROJECT_ID   = local.project_id
      ADMIN_CHAT_ID       = var.admin_chat_id
    }
  }

  name = "whatsapp"
}

resource "google_cloud_run_v2_service_iam_binding" "whatsapp_webhook" {
  name     = google_cloudfunctions2_function.whatsapp_webhook.service_config[0].service
  location = local.region
  role     = "roles/run.invoker"
  members  = ["allUsers"]
  project  = local.project_id
}

resource "null_resource" "whatsapp_webhook_cloud_sql" {
  depends_on = [google_cloudfunctions2_function.whatsapp_webhook]

  triggers = {
    function_id = google_cloudfunctions2_function.whatsapp_webhook.id
  }

  provisioner "local-exec" {
    command = "gcloud run services update ${google_cloudfunctions2_function.whatsapp_webhook.name} --add-cloudsql-instances ${google_sql_database_instance.instance.connection_name} --region ${local.region} --project ${local.project_id}"
  }
}

output "whatsapp_webhook_url" {
  value = google_cloudfunctions2_function.whatsapp_webhook.service_config[0].uri
}
