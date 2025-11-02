variable "telegram_bot_token" {
  description = "Telegram Bot API token"
  type        = string
  sensitive   = true
}

variable "db_database" {
  description = "Database name"
  type        = string
  default     = "database"
}

variable "db_user" {
  description = "Database user"
  type        = string
  default     = "postgres"
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
