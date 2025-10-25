variable "telegram_bot_token" {
  description = "Telegram Bot API token"
  type        = string
  sensitive   = true
}

variable "pg_host" {
  description = "PostgreSQL database host"
  type        = string
}

variable "pg_database" {
  description = "PostgreSQL database name"
  type        = string
  default     = "database"
}

variable "pg_user" {
  description = "PostgreSQL database user"
  type        = string
  default     = "postgres"
}

variable "pg_password" {
  description = "PostgreSQL database password"
  type        = string
  sensitive   = true
}

variable "meteofrance_token" {
  description = "MeteoFrance API token"
  type        = string
  sensitive   = true
}
