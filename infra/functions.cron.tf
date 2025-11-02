resource "google_project_service" "cloud_scheduler_api" {
  service = "cloudscheduler.googleapis.com"
  project = local.project_id
}

resource "google_cloudfunctions2_function" "cron" {

  depends_on = [google_project_service.cloud_run_api, google_project_service.cloud_scheduler_api]
  location   = local.region
  project    = local.project_id

  build_config {
    entry_point = "cronEndpoint"
    runtime     = "nodejs20"
    source {
      storage_source {
        bucket = google_storage_bucket.functions.name
        object = google_storage_bucket_object.functions.name
      }
    }
  }

  service_config {
    available_memory   = "256Mi" # Monitor actual usage - may be able to reduce
    timeout_seconds    = 240     # Monitor actual duration - may be able to reduce
    max_instance_count = 1       # Only one cron execution should run at a time
    environment_variables = {
      TELEGRAM_BOT_TOKEN = var.telegram_bot_token
      PGHOST             = "/cloudsql/${google_sql_database_instance.instance.connection_name}"
      PGDATABASE         = var.db_database
      PGUSER             = local.db_user
      PGPASSWORD         = var.db_password
      METEOFRANCE_TOKEN  = var.meteofrance_token
      GOOGLE_PROJECT_ID  = local.project_id
    }
  }

  name = "cron"
}

resource "null_resource" "cron_cloud_sql" {
  depends_on = [google_cloudfunctions2_function.cron]

  triggers = {
    function_id = google_cloudfunctions2_function.cron.id
  }

  provisioner "local-exec" {
    command = "gcloud run services update ${google_cloudfunctions2_function.cron.name} --add-cloudsql-instances ${google_sql_database_instance.instance.connection_name} --region ${local.region} --project ${local.project_id}"
  }
}

# IAM binding to allow Cloud Scheduler to invoke the function
resource "google_cloud_run_v2_service_iam_binding" "cron_invoker" {
  name     = google_cloudfunctions2_function.cron.service_config[0].service
  location = local.region
  role     = "roles/run.invoker"
  members  = ["serviceAccount:${google_service_account.scheduler_sa.email}"]
  project  = local.project_id
}

# Service account for Cloud Scheduler
resource "google_service_account" "scheduler_sa" {
  account_id   = "scheduler-sa"
  description  = "Service account for Cloud Scheduler to invoke cron functions"
  display_name = "Cloud Scheduler SA"
  project      = local.project_id
}

# Cloud Scheduler job to trigger the cron function
resource "google_cloud_scheduler_job" "cron_trigger" {
  depends_on  = [google_project_service.cloud_scheduler_api]
  name        = "cron-job-trigger"
  schedule    = "0 * * * *" # Hourly
  time_zone   = "UTC"
  region      = local.region
  project     = local.project_id

  http_target {
    http_method = "POST"
    uri         = google_cloudfunctions2_function.cron.service_config[0].uri
    oidc_token {
      service_account_email = google_service_account.scheduler_sa.email
    }
  }

  retry_config {
    retry_count = 1
  }
}

output "cron_function_url" {
  value = google_cloudfunctions2_function.cron.service_config[0].uri
}

output "cron_schedule" {
  value = google_cloud_scheduler_job.cron_trigger.schedule
}
