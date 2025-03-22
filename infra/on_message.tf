# locals {
#   on_message_dir = abspath("../on_message")
# }
#
# data "archive_file" "on_message" {
#   type        = "zip"
#   source_dir  = local.on_message_dir
#   output_path = "/tmp/on_message.zip"
# }
#
# resource "google_storage_bucket" "on_message" {
#   name     = "${local.project_id}-on_message"
#   location = local.region
# }
#
# resource "google_storage_bucket_object" "on_message_zip" {
#   name   = "${data.archive_file.on_message.output_md5}.zip"
#   bucket = google_storage_bucket.on_message.name
#   source = data.archive_file.on_message.output_path
# }
#
# resource "google_cloudfunctions2_function" "on_message" {
#
#
#   depends_on = [google_project_service.cloud_run_api]
#   location = local.region
#
#
#   build_config {
#     entry_point = "OnMessage"
#     runtime = "go116"
#     source {
#       storage_source {
#         bucket = google_storage_bucket.on_message.name
#         object = "${data.archive_file.on_message.output_md5}.zip"
#       }
#     }
#   }
#
#   service_config {
#     available_memory = "256M"
#     timeout_seconds  = 60
#   }
#
#
#   name    = "on-message"
#   project = local.project_id
#   # service_account_email = google_service_account.function-sa.email
# }
#
#
# resource "google_cloud_run_v2_service_iam_binding" "on_message" {
#   project = local.project_id
#   name    = google_cloudfunctions2_function.on_message.name
#   location = local.region
#   role    = "roles/run.invoker"
#   members = ["allUsers"]
# }
#
# output "function_uri" {
#   value = google_cloudfunctions2_function.on_message.service_config[0].uri
# }