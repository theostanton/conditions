terraform {
  required_providers {
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "~> 4.0"
    }
  }

  backend "gcs" {
    # Must match google_storage_bucket.tfstate.name
    bucket = "conditions-450312-tfstate"
    prefix = "terraform/state"
  }
}

locals {
  project_id     = "conditions-450312"
  region         = "europe-west1"
  tfstate_bucket = "${local.project_id}-tfstate"
}

resource "google_storage_bucket" "tfstate" {
  name          = local.tfstate_bucket
  location      = local.region
  project       = local.project_id
  force_destroy = false

  versioning {
    enabled = true
  }
}

provider "google" {
  project = local.project_id
  region  = local.region
}

provider "google-beta" {
  project = local.project_id
  region  = local.region
}

# This is the service account in which the functions.tf will act
resource "google_service_account" "function-sa" {
  account_id   = "function-sa"
  description  = "Controls the workflow for the cloud pipeline"
  display_name = "function-sa"
  project      = local.project_id
}

resource "google_project_service" "cloud_run_api" {
  service = "run.googleapis.com"
  project = local.project_id
}