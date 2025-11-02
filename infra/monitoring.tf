# Enable Cloud Monitoring API
resource "google_project_service" "monitoring_api" {
  service = "monitoring.googleapis.com"
  project = local.project_id
}

# Notification channel - configure email/slack after deployment
# Example: use gcloud CLI to add notification channels
# gcloud alpha monitoring channels create --display-name="Email" --type=email --channel-labels=email_address=you@example.com

# Alert policy for webhook function errors
resource "google_monitoring_alert_policy" "webhook_error_rate" {
  display_name = "Webhook Function Error Rate"
  combiner     = "OR"
  project      = local.project_id

  conditions {
    display_name = "Error rate > 5%"
    condition_threshold {
      filter          = "resource.type = \"cloud_run_revision\" AND resource.labels.service_name = \"${google_cloudfunctions2_function.webhook.name}\" AND metric.type = \"run.googleapis.com/request_count\" AND metric.labels.response_code_class != \"2xx\""
      duration        = "300s"
      comparison      = "COMPARISON_GT"
      threshold_value = 0.05
      aggregations {
        alignment_period   = "60s"
        per_series_aligner = "ALIGN_RATE"
      }
    }
  }

  alert_strategy {
    auto_close = "1800s"
  }

  depends_on = [google_project_service.monitoring_api]
}

# Alert policy for cron function failures
resource "google_monitoring_alert_policy" "cron_failures" {
  display_name = "Cron Function Failures"
  combiner     = "OR"
  project      = local.project_id

  conditions {
    display_name = "Cron function returned 5xx error"
    condition_threshold {
      filter          = "resource.type = \"cloud_run_revision\" AND resource.labels.service_name = \"${google_cloudfunctions2_function.cron.name}\" AND metric.type = \"run.googleapis.com/request_count\" AND metric.labels.response_code_class = \"5xx\""
      duration        = "60s"
      comparison      = "COMPARISON_GT"
      threshold_value = 0
      aggregations {
        alignment_period   = "60s"
        per_series_aligner = "ALIGN_DELTA"
      }
    }
  }

  alert_strategy {
    auto_close = "3600s"
  }

  depends_on = [google_project_service.monitoring_api]
}

# Alert policy for high Cloud SQL connections
resource "google_monitoring_alert_policy" "database_connections" {
  display_name = "High Database Connection Count"
  combiner     = "OR"
  project      = local.project_id

  conditions {
    display_name = "Connection count > 80% of max"
    condition_threshold {
      filter          = "resource.type = \"cloudsql_database\" AND resource.labels.database_id = \"${local.project_id}:${google_sql_database_instance.instance.name}\" AND metric.type = \"cloudsql.googleapis.com/database/postgresql/num_backends\""
      duration        = "300s"
      comparison      = "COMPARISON_GT"
      threshold_value = 20 # db-f1-micro supports ~25 connections
      aggregations {
        alignment_period   = "60s"
        per_series_aligner = "ALIGN_MAX"
      }
    }
  }

  alert_strategy {
    auto_close = "1800s"
  }

  depends_on = [google_project_service.monitoring_api]
}

output "monitoring_note" {
  value = "Monitoring alerts created. Add notification channels using: gcloud alpha monitoring channels create --display-name='Email' --type=email --channel-labels=email_address=YOUR_EMAIL"
}
