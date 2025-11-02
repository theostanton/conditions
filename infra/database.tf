resource "google_sql_database_instance" "instance" {
  name             = "instance"
  region           = local.region
  database_version = "POSTGRES_14"
  root_password    = var.db_password
  settings {
    availability_type = "ZONAL"
    ip_configuration {
      ipv4_enabled = true
      # No authorized_networks - public IP exists but not accessible externally
      # Cloud Functions connect via Unix socket: /cloudsql/instance-connection-name
      # This is more secure than allowing specific IPs
    }
    tier = "db-f1-micro"

    # Cost optimization opportunities:
    # 1. Enable deletion protection in production: deletion_protection = true
    # 2. Consider db-g1-small if more CPU needed (better performance/cost ratio)
    # 3. Current tier runs 24/7 - with 2x daily cron, this is acceptable
    # 4. For lower usage, consider Cloud SQL serverless (not available for Postgres 14)
    # 5. Backup configuration recommended for production:
    #    backup_configuration {
    #      enabled    = true
    #      start_time = "02:00"
    #      point_in_time_recovery_enabled = true
    #    }
  }
  deletion_protection = false
}

resource "google_sql_database" "database" {
  name     = var.db_database
  instance = google_sql_database_instance.instance.name
}

resource "google_sql_user" "user" {
  name     = var.db_user
  instance = google_sql_database_instance.instance.name
  password = var.db_password
}

output "database" {
  value = google_sql_database.database.self_link
}
