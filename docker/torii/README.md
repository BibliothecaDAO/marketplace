# Hardened marketplace Torii

This image builds Torii from the exact `v1.8.16` source commit recorded in
`image.lock.json`, verifies and applies every checked-in patch, runs formatting,
`clippy -D warnings`, and all tests for each changed Torii crate, and then builds
the release binary. Production deployment accepts only an ECR image reference
by digest; CI writes that immutable digest into the release artifact after
publishing.

Runtime inputs are `TORII_CHAIN`, `TORII_RPC_URL`, `TORII_DB_DIR`,
`TORII_METADATA_CONCURRENCY`, and optionally `TORII_IPFS_GATEWAY`. RPC URLs are rendered into a
mode-0600 runtime file and never checked in. The SQL and administrative server remain reachable
only from the private API security group.

Generate configs with:

```sh
pnpm --filter @biblio/marketplace-registry generate
```

Build for the production architecture with:

```sh
docker buildx build --platform linux/amd64 --file docker/torii/Dockerfile docker/torii
```

The production Terraform has no default Torii digest, deliberately blocking an apply until a
scanned ECR artifact has been published and qualified.
