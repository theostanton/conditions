resource "google_sql_database_instance" "instance" {
  name             = "instance"
  region           = local.region
  database_version = "POSTGRES_14"
  root_password    = "password"
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
  name     = "database"
  instance = google_sql_database_instance.instance.name
}

resource "google_sql_user" "user" {
  name     = "user"
  instance = google_sql_database_instance.instance.name
  password = "password"
}


data "google_sql_tiers" "tiers" {
  project = local.project_id
}

locals {
  all_available_tiers = [for v in data.google_sql_tiers.tiers.tiers : v.tier]
}

output "avaialble_tiers" {
  description = "List of all available tiers for give project."
  value       = local.all_available_tiers
}

output "database" {
  value = google_sql_database.database.self_link
}