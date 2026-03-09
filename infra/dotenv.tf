resource "local_file" "functions_dotenv" {
  filename = "${path.module}/../functions/.env"
  content  = <<-EOT
GOOGLE_PROJECT_ID=${local.project_id}
TELEGRAM_BOT_TOKEN=${var.telegram_bot_token}
ANALYTICS_BOT_TOKEN=${var.analytics_bot_token}
METEOFRANCE_TOKEN=${var.meteofrance_token}
ADMIN_CHAT_ID=${var.admin_chat_id}
PGHOST=${google_sql_database_instance.instance.public_ip_address}
PGDATABASE=${var.db_database}
PGUSER=${local.db_user}
PGPASSWORD=${var.db_password}
WA_PHONE_NUMBER_ID=${var.wa_phone_number_id}
WA_ACCESS_TOKEN=${var.wa_access_token}
WA_VERIFY_TOKEN=${var.wa_verify_token}
GOOGLE_MAPS_API_KEY=${var.google_maps_api_key}
ANTHROPIC_API_KEY=${var.anthropic_api_key}
EOT
}
