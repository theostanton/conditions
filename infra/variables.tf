locals {
  db_user = "postgres"
}

variable "telegram_bot_token" {
  description = "Conditions Bot API token"
  type        = string
  sensitive   = true
}

variable "analytics_bot_token" {
  description = "Analytics Bot API token"
  type        = string
  sensitive   = true
}

variable "db_database" {
  description = "Database name"
  type        = string
  default     = "database"
}

variable "db_password" {
  description = "Database password"
  type        = string
  sensitive   = true
}

variable "meteofrance_token" {
  description = "MeteoFrance API token"
  type        = string
  sensitive   = true
}

variable "admin_chat_id" {
  description = "Telegram Admin number"
  type        = string
}

variable "db_authorized_networks" {
  description = "Map of authorized networks for database access (key is network name, value is CIDR)"
  type        = map(string)
  sensitive   = true
}
