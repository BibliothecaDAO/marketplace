# Marketplace data-plane operations runbook

This runbook operates the retained-contract marketplace read plane. It does not
authorize contract upgrades, order mutation, relisting, approval changes, or
wallet-provider changes.

## 1. Sources of truth

- Chain and product registry: `config/marketplace/chains.json`
- Fixed replay checkpoints: `config/marketplace/rpc-checkpoints.json`
- Generated Torii configs: `docker/torii/config/*.toml`
- Generated frontend registry: `src/lib/marketplace/generated-registry.json`
- API contract: `packages/marketplace-api-contract`
- Infrastructure: `infra/marketplace-data`
- Contract/risk decision: `docs/adr/0001-retain-arcade-contracts.md`

Never copy an address from a dashboard or incident message into a deployment.
Change the registry, review the diff, regenerate, qualify, and reconcile.

## 2. Registry change procedure

1. Establish the contract standard, exact first-present block, current class
   hash where applicable, metadata policy, and owning product name from direct
   chain reads.
2. Edit `config/marketplace/chains.json`.
3. Run:

   ```bash
   pnpm --filter @biblio/marketplace-registry test
   pnpm --filter @biblio/marketplace-registry generate
   git diff -- docker/torii/config src/lib/marketplace/generated-registry.json
   ```

4. Reject the change if generated output is nondeterministic, an address or
   symbol is duplicated after normalization, a start block is absent, a felt
   is malformed, or an unsupported token standard is used.
5. Repeat RPC qualification and both empty replays for the changed chain.

Secrets, RPC URLs, account keys, and provider identifiers do not belong in the
registry.

## 3. RPC provider qualification

Run all commands from the repository root. Keep provider URLs in a secret
shell/session and write evidence only under `.context` until it is uploaded to
the encrypted evidence bucket.

For every provider and chain:

```bash
RPC_PROVIDER_NAME=quicknode \
RPC_CHAIN=SN_MAIN \
RPC_URL="$QUICKNODE_MAINNET_URL" \
RPC_QUALIFICATION_REPORT=.context/qualification/quicknode-mainnet.json \
pnpm --filter @biblio/marketplace-ops qualify:rpc
```

Repeat for QuickNode/Sepolia and Alchemy/Mainnet/Sepolia. A passing report
proves RPC v0.9+, expected chain ID, fixed block hash, accepted historical
receipt, class state at every configured start block, checkpoint state, and
historical event access. A wrong-chain response is a hard failure even if every
other request succeeds.

Then run a complete bounded replay from an empty database for each candidate.
The replay URL must be the provider being measured:

```bash
TORII_IMAGE="$PINNED_TORII_DIGEST" \
UPSTREAM_RPC_URL="$QUICKNODE_MAINNET_URL" \
REPLAY_CHAIN=SN_MAIN \
REPLAY_RUN_ID=quicknode-mainnet-a \
scripts/marketplace/run-bounded-replay.sh
```

Run a second fresh replay with a different run ID. Compare reports:

```bash
pnpm --filter @biblio/marketplace-ops verify:replays \
  .context/replays/quicknode-mainnet-a/reconciliation.json \
  .context/replays/quicknode-mainnet-b/reconciliation.json
```

Repeat for both chains and both providers. Never reuse or copy the first SQLite
database into the second replay.

Create a two-entry provider evidence JSON containing archive status, replay
duration, request error/retry rate, p95 latency, replay hash, soak duration, and
unrecoverable gaps. Rank it with:

```bash
RPC_EVIDENCE_PATH=.context/qualification/providers.json \
RPC_RANKING_REPORT=.context/qualification/ranking.json \
pnpm --filter @biblio/marketplace-ops rank:rpc
```

The score is 50% replay duration, 30% request error/retry rate, and 20% p95
latency. Both providers must pass, replay hashes must match, and both must
complete at least 24 hours of head-following with no unrecoverable gap. Do not
promote a single-provider configuration.

## 4. Replay reconciliation

For each report, verify more than the top-level hash:

- `orderHash` and `bookHash` match exactly.
- Every current order state and original/remaining quantity matches.
- Cancel, remove, partial fill, final execution, and unknown status-change
  provenance are present without invented causes.
- Every configured collection has the expected contract standard, deployment
  block, token count, and sampled direct-chain ownership.
- Token, balance, attribute, and activity counts are plausible and identical.
- Direct class hashes at the checkpoint match the registry.

Upload reports and command logs to the versioned encrypted S3 evidence prefix.
The `release_evidence.evidence_s3_uri` must point to the immutable evidence set,
not a mutable dashboard URL.

## 5. Terraform bootstrap and deployment

The production backend bucket and lock table are deliberately outside this
stack. Create them once with versioning, encryption, public-access blocking,
deletion protection, and point-in-time recovery. A one-time privileged
bootstrap apply creates the GitHub OIDC roles; subsequent plans/applies use
those roles.

Required repository/environment variables:

- `AWS_MARKETPLACE_STATE_BUCKET`
- `AWS_MARKETPLACE_LOCK_TABLE`
- `AWS_MARKETPLACE_PLAN_ROLE_ARN`
- `AWS_MARKETPLACE_APPLY_ROLE_ARN`
- `MARKETPLACE_API_DOMAIN`
- `MARKETPLACE_ROUTE53_ZONE_ID`

The API task receives `MARKETPLACE_PUBLIC_BASE_URL=https://<api-domain>` from
Terraform. It is the only origin used when emitting owned collection/token
asset URLs. The public asset routes require a content-version query parameter,
allow only registry collections, and proxy Torii's private sanitized static
cache; never expose Torii `/static` or accept a caller-supplied source URL.

Create all four RPC secret values in Secrets Manager after the launch-disabled
bootstrap. Terraform creates the secret containers but never stores the URL in
state or source.

Local validation:

```bash
terraform -chdir=infra/marketplace-data fmt -check -recursive
terraform -chdir=infra/marketplace-data init -backend=false -input=false
terraform -chdir=infra/marketplace-data validate
tflint --chdir=infra/marketplace-data --init
tflint --chdir=infra/marketplace-data --recursive
checkov -d infra/marketplace-data --framework terraform
```

Normal production changes use a PR plan and the protected
`marketplace-production` GitHub environment. Production applies always check
out `main`, materialize reviewed evidence from the protected
`MARKETPLACE_RELEASE_TFVARS` secret, create a saved plan, and apply that exact
plan. Do not run a workstation production apply during normal operation.

`launch_enabled=false` creates durable shared infrastructure but no API tasks,
Torii instances, or live SQLite volumes. `launch_enabled=true` fails its
Terraform preconditions unless every declared release gate and immutable image
digest is present.

## 6. Backup and restore drill

Litestream continuously replicates each SQLite WAL to:

```text
s3://<backup-bucket>/litestream/<SN_MAIN|SN_SEPOLIA>/<blue|green>/
```

Daily DLM snapshots retain 14 EBS recovery points. The `BackupAgeSeconds` alarm
fires above 300 seconds. Do not accept a dashboard-only backup check; perform a
restore onto a new instance.

Restore drill:

1. Record UTC start time and the most recent replicated generation timestamp.
2. Set `torii_green_enabled=true`, pin `torii_green_image_ref`, and keep
   `torii_active_color=blue`.
3. Apply. Green gets a new encrypted volume and restores the blue Litestream
   stream before starting Torii.
4. Confirm the green private endpoint is not the API active endpoint.
5. Wait for green to reach chain head and run reconciliation against blue and
   direct-chain samples.
6. Record lost time between the restored database and failure point as RPO.
7. Record time from drill start until green is caught up and ready as RTO.
8. Require RPO under 5 minutes and RTO under 60 minutes.
9. Store logs, generation IDs, reconciliation hashes, timestamps, and resource
   use in the evidence prefix.
10. Destroy the green compute only after evidence is uploaded; preserve blue.

Never test restore by overwriting the active volume.

Record one JSON input per chain with `failureAt`, `latestReplicaAt`,
`drillStartedAt`, `readyAt`, `restoredGeneration`, `indexedBlock`, `chainHead`,
and `reconciliationMatched`. Evaluate both chains together; equality at the RPO
or RTO boundary fails because the targets are strictly under five and sixty
minutes:

```bash
RESTORE_DRILL_INPUT_PATH=.context/evidence/restore-inputs.json \
RESTORE_DRILL_REPORT_PATH=.context/evidence/restore_drill_passed.json \
pnpm --filter @biblio/marketplace-ops evaluate:restore
```

## 7. Load, soak, and chaos evidence

Create a JSON array containing exactly 25 current tuple order keys, then run
the cached browse routes and the full cart lookup under concurrent load:

```bash
MARKETPLACE_API_BASE_URL=https://marketplace-api.example.com \
LOAD_CHAIN=SN_MAIN \
LOAD_COLLECTION=0x... \
LOAD_CURRENCY=0x... \
LOAD_ORDER_KEYS_PATH=.context/evidence/load-order-keys.json \
LOAD_DURATION_SECONDS=300 \
LOAD_CONCURRENCY=20 \
LOAD_REPORT_PATH=.context/evidence/load_test_passed.json \
pnpm --filter @biblio/marketplace-ops load:api
```

The command warms every scenario, consumes complete responses, measures
nearest-rank p50/p95/p99, requires at least 99.9% successful requests and p95
under 500 ms, and exits nonzero on failure.

Export the seven-day CloudWatch/API sample stream as a JSON array. Every sample
contains `observedAt`, API availability, cached latency, accepted-block lag,
and CPU/memory/disk percentages for both writers. Missing intervals are a
failure, not silently discarded:

```bash
SOAK_SAMPLES_PATH=.context/evidence/seven-day-samples.json \
SOAK_REPORT_PATH=.context/evidence/seven_day_soak_complete.json \
pnpm --filter @biblio/marketplace-ops evaluate:soak
```

Run each chaos case in an isolated maintenance window and capture its result:

- primary RPC transport failure, timeout, HTTP 429, and HTTP 5xx all select the
  independently qualified fallback;
- a deterministic JSON-RPC error is returned and is not hidden by failover;
- Torii restart, disk pressure, and delayed indexing disable checkout;
- recovery restores ready state without changing contract identity.

Evaluate the eight-case report:

```bash
CHAOS_SCENARIOS_PATH=.context/evidence/chaos-cases.json \
CHAOS_REPORT_PATH=.context/evidence/chaos_tests_passed.json \
pnpm --filter @biblio/marketplace-ops evaluate:chaos
```

The evaluator requires every named case and explicit fail-closed evidence for
Torii restart, disk pressure, and delayed indexing. It does not inject faults
itself; fault activation remains an IAM/SSM-controlled production action.

The signed Sepolia lifecycle is executed with dedicated funded seller and
buyer accounts against the registered test collection. Capture the direct
receipt callers/blocks, owned-API list and tuple lookup observations, cart
action, purchase observation, and sampled final owner. Validate contract
identity and index convergence against the checked-in registry:

```bash
SEPOLIA_LIFECYCLE_INPUT_PATH=.context/evidence/sepolia-lifecycle-input.json \
SEPOLIA_LIFECYCLE_REPORT_PATH=.context/evidence/sepolia_lifecycle_passed.json \
pnpm --filter @biblio/marketplace-ops evaluate:sepolia-lifecycle
```

This evaluator never holds a private key or submits a transaction. Signing is
performed by the normal wallet flow; the report binds the resulting on-chain
callers and receipts to the retained deployments.

## 8. Blue/green Torii upgrade

1. Build from the exact pinned source, apply the checked-in patch, run Rust
   security tests, scan the image, create an SBOM, and record the immutable
   digest.
2. Enable green with that digest while blue remains active.
3. Restore/replay green, then reconcile order, Book, token, balance, trait, and
   activity state at the same block.
4. Sample direct-chain class, ownership, and order validity.
5. Switch only `torii_active_color` after reconciliation passes.
6. Verify API meta identity and lag, then observe.
7. Retain the former blue database and deployment for at least 72 hours.

If reconciliation differs, stop. Do not “repair” green by copying individual
rows from blue.

## 9. Progressive frontend cutover

Set exactly one value:

```text
MARKETPLACE_READ_ROLLOUT=off|browse|portfolio|orders|checkout
```

Invalid values fail build/startup. Each stage includes all preceding stages.
Observe browse, portfolio, and orders for at least 24 hours each. Observe
checkout for at least 72 hours before deleting compatibility parsing. At every
stage verify network logs contain no Cartridge Torii or static-asset request.

The final `checkout` stage additionally requires:

- API health and identity match.
- lag no greater than two accepted blocks;
- Book not paused;
- all 25-or-fewer tuple order keys are still placed and terms unchanged;
- one currency across the cart;
- direct ownership, approval, validity, balance, and allowance checks;
- receipt block observed by the indexer, or the non-failure message
  “Confirmed onchain, still indexing” after 60 seconds.

## 10. Incident response

### API unavailable or identity mismatch

Disable checkout immediately. Confirm `/health`, `/ready`, and the API response
meta contract identities. An identity mismatch is not retryable. Roll back the
API task definition or Torii active color; never edit the expected frontend
address to match an unexpected backend.

### Index lag above two blocks

Disable checkout, inspect provider errors, Torii logs, CPU/memory/disk, and the
accepted chain head. Fail over only on transport, timeout, HTTP 429, or HTTP 5xx
conditions. Do not fail over to conceal a deterministic RPC error. If catch-up
cannot meet the window, restore/replay green and reconcile before switching.

### Metadata fetch alert

Metadata is non-authoritative for settlement. Keep checkout based on order and
direct chain checks. Inspect recorded failure reason and URI class without
fetching it from a workstation browser. Never weaken private/reserved IP,
redirect, size, MIME, timeout, or SVG policy during an incident.

### Disk pressure

Checkout remains disabled if Torii cannot stay current. Stop metadata hydration
first, preserve WAL replication, snapshot the volume, and create a larger green
volume. Do not resize or vacuum the active SQLite writer without a measured,
rehearsed procedure.

### Both RPC providers unavailable

Keep cached browsing only within its declared stale policy and display degraded
mode. Checkout stays closed. A third unqualified endpoint is not an emergency
fallback.

## 11. Rollback

Rollback selects the preceding owned API task definition and/or Torii color and
sets the rollout stage back. The retired Cartridge endpoint is not a target.
CloudFront may serve explicitly marked browse data for at most 15 minutes in
degraded mode; orders, Book, lookup, health, and readiness never serve stale
data for checkout.

Rollback rules:

- Disable checkout before changing backends.
- Keep both deployment identities and reconciliation reports in the incident.
- Verify the selected backend's chain ID, contract addresses, indexed hash, and
  lag before re-enabling any stage.
- Retain the replaced deployment for 72 hours.
- Do not submit, cancel, replay, or otherwise alter an on-chain order as part of
  rollback.

## 12. Hash-verified release bundle

Every release gate is stored as a separate JSON report named after its gate;
reports must include `"passed": true`. In addition to the Terraform booleans,
the bundle requires Torii security tests, Terraform/tflint/Checkov, container
scans/SBOMs, a distinct load report, and a two-chain restore report. The
preparer hashes every report, rejects missing/reused/out-of-directory files,
rechecks soak/load/restore thresholds, and emits the only tfvars accepted for
production:

```bash
RELEASE_EVIDENCE_DIRECTORY=.context/evidence/release-2026-08-01 \
RELEASE_EVIDENCE_MEASURED_AT=2026-08-01T00:00:00Z \
RELEASE_EVIDENCE_S3_URI=s3://marketplace-evidence/releases/2026-08-01/manifest.json \
RELEASE_TFVARS_PATH=.context/evidence/release-2026-08-01/release.auto.tfvars.json \
pnpm --filter @biblio/marketplace-ops prepare:release
```

Upload the whole directory without rewriting files, verify the remote object
digests, then store the generated tfvars in the protected production secret.
Do not hand-author release booleans.

## 13. Production release checklist

- [ ] Registry generation is clean and all start blocks/standards are verified.
- [ ] QuickNode and Alchemy pass both chains, replay, and 24-hour soak.
- [ ] Two empty replays match exactly at each fixed checkpoint.
- [ ] Order, Book, collection, provenance, and ownership reconciliation passes.
- [ ] Seven-day lag/availability/latency soak meets SLOs.
- [ ] Mainnet and Sepolia sustained utilization remain below 70%.
- [ ] Sepolia signed lifecycle test passes against a registered test collection.
- [ ] RPC failover, restart, disk, delayed-index, backup, and restore drills pass.
- [ ] Cached p95 is below 500 ms and measured availability is at least 99.9%.
- [ ] RPO is under 5 minutes and RTO is under 60 minutes.
- [ ] Deterministic Playwright has no data-dependent skip.
- [ ] Browser traffic has no Cartridge Torii/static request.
- [ ] `pnpm ci:arcade-imports` passes.
- [ ] Contract identities are unchanged on both chains.
- [ ] Checkout fail-closed behavior passes.
- [ ] Evidence is uploaded and the protected release tfvars references it.
