resource "google_cloudfunctions2_function" "report" {

  depends_on = [google_project_service.cloud_run_api]
  location   = local.region
  project    = local.project_id

  build_config {
    entry_point = "reportPageEndpoint"
    runtime     = "nodejs20"
    source {
      storage_source {
        bucket = google_storage_bucket.functions.name
        object = google_storage_bucket_object.functions.name
      }
    }
  }

  service_config {
    available_memory   = "512Mi"
    timeout_seconds    = 60
    min_instance_count = 1
    max_instance_count = 5
    environment_variables = {
      ANTHROPIC_API_KEY   = var.anthropic_api_key
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

  name = "report"
}

resource "google_cloud_run_v2_service_iam_binding" "report" {
  name     = google_cloudfunctions2_function.report.service_config[0].service
  location = local.region
  role     = "roles/run.invoker"
  members  = ["allUsers"]
  project  = local.project_id
}

resource "null_resource" "report_cloud_sql" {
  depends_on = [google_cloudfunctions2_function.report]

  triggers = {
    function_id = google_cloudfunctions2_function.report.id
  }

  provisioner "local-exec" {
    command = "gcloud run services update ${google_cloudfunctions2_function.report.name} --add-cloudsql-instances ${google_sql_database_instance.instance.connection_name} --region ${local.region} --project ${local.project_id}"
  }
}

output "report_function_url" {
  value = google_cloudfunctions2_function.report.service_config[0].uri
}
