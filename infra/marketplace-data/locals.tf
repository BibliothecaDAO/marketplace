locals {
  name = "marketplace-data-${var.environment}"
  tags = {
    Application = "marketplace-data"
    Environment = var.environment
    ManagedBy   = "terraform"
  }

  chains = {
    SN_MAIN = {
      slug          = "mainnet"
      instance_type = var.mainnet_instance_type
      ebs_size      = var.mainnet_ebs_size_gib
      ebs_iops      = var.mainnet_ebs_iops
      az_index      = 0
    }
    SN_SEPOLIA = {
      slug          = "sepolia"
      instance_type = var.sepolia_instance_type
      ebs_size      = var.sepolia_ebs_size_gib
      ebs_iops      = var.sepolia_ebs_iops
      az_index      = 1
    }
  }

  torii_deployments = !var.launch_enabled ? {} : merge(
    {
      for chain, config in local.chains : "${chain}-blue" => merge(config, {
        chain         = chain
        color         = "blue"
        image_ref     = var.torii_image_ref
        restore_color = "blue"
      })
    },
    var.torii_green_enabled ? {
      for chain, config in local.chains : "${chain}-green" => merge(config, {
        chain         = chain
        color         = "green"
        image_ref     = var.torii_green_image_ref
        restore_color = "blue"
      })
    } : {}
  )

  rpc_secret_arns = {
    quicknode = {
      SN_MAIN    = aws_secretsmanager_secret.rpc["quicknode-mainnet"].arn
      SN_SEPOLIA = aws_secretsmanager_secret.rpc["quicknode-sepolia"].arn
    }
    alchemy = {
      SN_MAIN    = aws_secretsmanager_secret.rpc["alchemy-mainnet"].arn
      SN_SEPOLIA = aws_secretsmanager_secret.rpc["alchemy-sepolia"].arn
    }
  }
  rpc_fallback_provider = var.rpc_primary_provider == "quicknode" ? "alchemy" : "quicknode"
}

resource "terraform_data" "release_gate" {
  input = var.release_evidence

  lifecycle {
    precondition {
      condition = !var.launch_enabled ? true : (
        var.api_image_ref != null &&
        var.torii_image_ref != null &&
        var.litestream_image_ref != null &&
        var.adot_image_ref != null &&
        length(var.cors_origins) > 0 &&
        (!var.torii_green_enabled || var.torii_green_image_ref != null) &&
        (var.torii_active_color != "green" || var.torii_green_enabled) &&
        var.release_evidence != null
      )
      error_message = "Launch requires four immutable image digests, at least one CORS origin, and measured release evidence."
    }

    precondition {
      condition = !var.launch_enabled ? true : (
        var.release_evidence == null ? false : (
          var.release_evidence.both_rpc_providers_qualified &&
          var.release_evidence.rpc_failover_passed &&
          var.release_evidence.deterministic_replays_match &&
          var.release_evidence.order_and_book_reconciled &&
          var.release_evidence.collections_verified &&
          var.release_evidence.historical_provenance_reconciled &&
          var.release_evidence.seven_day_soak_complete &&
          var.release_evidence.sepolia_lifecycle_passed &&
          var.release_evidence.chaos_and_load_tests_passed &&
          var.release_evidence.deterministic_playwright_passed &&
          var.release_evidence.zero_cartridge_read_requests &&
          var.release_evidence.arcade_import_boundary_passed &&
          var.release_evidence.contract_identity_unchanged &&
          var.release_evidence.checkout_fail_closed_passed &&
          can(formatdate("YYYY-MM-DD", var.release_evidence.measured_at)) &&
          startswith(var.release_evidence.evidence_s3_uri, "s3://") &&
          var.release_evidence.p95_index_lag_blocks <= 2 &&
          var.release_evidence.api_availability_percent >= 99.9 &&
          var.release_evidence.api_cached_p95_ms < 500 &&
          max(
            var.release_evidence.mainnet_cpu_percent,
            var.release_evidence.mainnet_memory_percent,
            var.release_evidence.mainnet_disk_percent,
            var.release_evidence.sepolia_cpu_percent,
            var.release_evidence.sepolia_memory_percent,
            var.release_evidence.sepolia_disk_percent
          ) < 70 &&
          var.release_evidence.restore_rpo_minutes < 5 &&
          var.release_evidence.restore_rto_minutes < 60
        )
      )
      error_message = "Release evidence does not satisfy replay, soak, SLO, utilization, RPO, or RTO gates."
    }
  }
}
