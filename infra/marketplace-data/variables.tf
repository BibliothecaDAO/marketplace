variable "aws_region" {
  description = "Fixed marketplace data-plane AWS region."
  type        = string
  default     = "us-east-1"

  validation {
    condition     = var.aws_region == "us-east-1"
    error_message = "The initial marketplace data plane is fixed to us-east-1."
  }
}

variable "environment" {
  type    = string
  default = "production"
}

variable "domain_name" {
  description = "Public API hostname, for example marketplace-api.example.com."
  type        = string
}

variable "route53_zone_id" {
  description = "Existing public Route53 hosted zone containing domain_name."
  type        = string
}

variable "github_repository" {
  description = "GitHub owner/repository allowed to assume deployment roles."
  type        = string
  default     = "biblio/marketplace"
}

variable "terraform_state_bucket" {
  description = "Pre-existing S3 bucket used by the protected production backend."
  type        = string
}

variable "terraform_lock_table" {
  description = "Pre-existing DynamoDB table used for production state locking."
  type        = string
}

variable "cors_origins" {
  type    = list(string)
  default = []
}

variable "launch_enabled" {
  description = "Creates API tasks and Torii writers only after all release evidence passes."
  type        = bool
  default     = false
}

variable "api_image_ref" {
  description = "Immutable ECR API image reference."
  type        = string
  default     = null
  nullable    = true

  validation {
    condition     = var.api_image_ref == null || can(regex("@sha256:[0-9a-f]{64}$", var.api_image_ref))
    error_message = "api_image_ref must be pinned by sha256 digest."
  }
}

variable "torii_image_ref" {
  description = "Immutable, scanned hardened Torii image reference."
  type        = string
  default     = null
  nullable    = true

  validation {
    condition     = var.torii_image_ref == null || can(regex("@sha256:[0-9a-f]{64}$", var.torii_image_ref))
    error_message = "torii_image_ref must be pinned by sha256 digest."
  }
}

variable "torii_green_image_ref" {
  description = "Candidate Torii digest used only during a blue/green upgrade."
  type        = string
  default     = null
  nullable    = true

  validation {
    condition     = var.torii_green_image_ref == null || can(regex("@sha256:[0-9a-f]{64}$", var.torii_green_image_ref))
    error_message = "torii_green_image_ref must be pinned by sha256 digest."
  }
}

variable "torii_green_enabled" {
  description = "Temporarily provisions the isolated green writer and database for reconciliation."
  type        = bool
  default     = false
}

variable "torii_active_color" {
  description = "Private API backend selected after blue/green reconciliation."
  type        = string
  default     = "blue"

  validation {
    condition     = contains(["blue", "green"], var.torii_active_color)
    error_message = "torii_active_color must be blue or green."
  }
}

variable "litestream_image_ref" {
  description = "Immutable Litestream image reference."
  type        = string
  default     = null
  nullable    = true

  validation {
    condition     = var.litestream_image_ref == null || can(regex("@sha256:[0-9a-f]{64}$", var.litestream_image_ref))
    error_message = "litestream_image_ref must be pinned by sha256 digest."
  }
}

variable "adot_image_ref" {
  description = "Immutable AWS Distro for OpenTelemetry image reference."
  type        = string
  default     = null
  nullable    = true

  validation {
    condition     = var.adot_image_ref == null || can(regex("@sha256:[0-9a-f]{64}$", var.adot_image_ref))
    error_message = "adot_image_ref must be pinned by sha256 digest."
  }
}

variable "rpc_primary_provider" {
  description = "Winner of the checked-in 50/30/20 provider qualification."
  type        = string
  default     = "quicknode"

  validation {
    condition     = contains(["quicknode", "alchemy"], var.rpc_primary_provider)
    error_message = "rpc_primary_provider must be quicknode or alchemy."
  }
}

variable "release_evidence" {
  description = "Measured release evidence. Null deliberately prevents workload launch."
  type = object({
    measured_at                      = string
    evidence_s3_uri                  = string
    both_rpc_providers_qualified     = bool
    rpc_failover_passed              = bool
    deterministic_replays_match      = bool
    order_and_book_reconciled        = bool
    collections_verified             = bool
    historical_provenance_reconciled = bool
    seven_day_soak_complete          = bool
    sepolia_lifecycle_passed         = bool
    chaos_and_load_tests_passed      = bool
    deterministic_playwright_passed  = bool
    zero_cartridge_read_requests     = bool
    arcade_import_boundary_passed    = bool
    contract_identity_unchanged      = bool
    checkout_fail_closed_passed      = bool
    p95_index_lag_blocks             = number
    api_availability_percent         = number
    api_cached_p95_ms                = number
    mainnet_cpu_percent              = number
    mainnet_memory_percent           = number
    mainnet_disk_percent             = number
    sepolia_cpu_percent              = number
    sepolia_memory_percent           = number
    sepolia_disk_percent             = number
    restore_rpo_minutes              = number
    restore_rto_minutes              = number
  })
  default  = null
  nullable = true
}

variable "mainnet_instance_type" {
  type    = string
  default = "m7i.large"
}

variable "mainnet_ebs_size_gib" {
  type    = number
  default = 200
}

variable "mainnet_ebs_iops" {
  type    = number
  default = 3000
}

variable "sepolia_instance_type" {
  type    = string
  default = "t3.large"
}

variable "sepolia_ebs_size_gib" {
  type    = number
  default = 100
}

variable "sepolia_ebs_iops" {
  type    = number
  default = 3000
}

variable "api_cpu" {
  type    = number
  default = 1024
}

variable "api_memory" {
  type    = number
  default = 2048
}
