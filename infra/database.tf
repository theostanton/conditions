resource "google_sql_database_instance" "instance" {
  name             = "instance"
  region           = local.region
  database_version = "POSTGRES_16"
  root_password    = var.db_password
    settings {
    availability_type = "ZONAL"
    ip_configuration {
      ipv4_enabled = true
      dynamic "authorized_networks" {
        for_each = nonsensitive(var.db_authorized_networks)
        content {
          name  = authorized_networks.key
          value = authorized_networks.value
        }
      }
    }
    tier = "db-f1-micro"

    # Cost optimization opportunities:
    # 1. Consider db-g1-small if more CPU needed (better performance/cost ratio)
    # 2. Current tier runs 24/7 - with 2x daily cron, this is acceptable
    # 3. For lower usage, consider Cloud SQL serverless (not available for Postgres 14)

    backup_configuration {
      enabled                        = true
      start_time                     = "02:00"
      point_in_time_recovery_enabled = true
      transaction_log_retention_days = 7
      backup_retention_settings {
        retained_backups = 7
      }
    }
  }
  deletion_protection = true
}

resource "google_sql_database" "database" {
  name     = var.db_database
  instance = google_sql_database_instance.instance.name
}

output "database" {
  value = google_sql_database.database.self_link
}
