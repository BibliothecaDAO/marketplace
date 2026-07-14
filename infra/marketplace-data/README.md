# Marketplace data-plane infrastructure

Terraform for the public owned marketplace API and private per-chain Torii
writers in `us-east-1`.

The stack creates two-AZ networking, CloudFront/WAF/ALB, two ECS Fargate API
tasks, one EC2/EBS SQLite writer per chain, private service discovery, ECR,
encrypted/versioned S3 recovery storage, DLM snapshots, Secrets Manager
containers, CloudWatch telemetry, and GitHub OIDC roles. Workloads are absent
until `launch_enabled=true` and every release-evidence precondition passes.

See [`docs/runbooks/marketplace-data-plane.md`](../../docs/runbooks/marketplace-data-plane.md)
for bootstrap, qualification, restore, upgrade, rollout, and incident steps.

## Required inputs

```hcl
domain_name           = "marketplace-api.example.com"
route53_zone_id       = "Z..."
terraform_state_bucket = "preexisting-protected-state-bucket"
terraform_lock_table   = "preexisting-terraform-locks"
cors_origins          = ["https://marketplace.example.com"]
```

Image inputs must be complete ECR references pinned by `@sha256:<64 hex>`.
RPC URLs are values of the four generated Secrets Manager secrets and never
Terraform variables.

## Release evidence example

The protected `MARKETPLACE_RELEASE_TFVARS` secret supplies a reviewed object of
this shape; `false`, missing evidence, or an unmet numeric SLO blocks workload
creation:

```hcl
launch_enabled = true
release_evidence = {
  measured_at                      = "2026-08-01T00:00:00Z"
  evidence_s3_uri                  = "s3://example-evidence/releases/2026-08-01/manifest.json"
  both_rpc_providers_qualified     = true
  rpc_failover_passed              = true
  deterministic_replays_match      = true
  order_and_book_reconciled        = true
  collections_verified             = true
  historical_provenance_reconciled = true
  seven_day_soak_complete           = true
  sepolia_lifecycle_passed          = true
  chaos_and_load_tests_passed       = true
  deterministic_playwright_passed   = true
  zero_cartridge_read_requests      = true
  arcade_import_boundary_passed     = true
  contract_identity_unchanged       = true
  checkout_fail_closed_passed       = true
  p95_index_lag_blocks              = 2
  api_availability_percent          = 99.95
  api_cached_p95_ms                 = 300
  mainnet_cpu_percent               = 55
  mainnet_memory_percent            = 60
  mainnet_disk_percent              = 50
  sepolia_cpu_percent               = 35
  sepolia_memory_percent            = 45
  sepolia_disk_percent              = 30
  restore_rpo_minutes               = 2
  restore_rto_minutes               = 40
}
```

This example is schema documentation, not release evidence.
