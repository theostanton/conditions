resource "google_sql_database_instance" "instance" {
  name             = "instance"
  region           = local.region
  database_version = "POSTGRES_14"
  root_password    = var.db_password
  settings {
    availability_type = "ZONAL"
    ip_configuration {
      ipv4_enabled = true
      authorized_networks {
        name  = "Chamonix"
        value = "79.88.5.26/32"
      }
    }
    tier = "db-f1-micro"

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
