# Biblio Marketplace Scope

Status: Accepted architecture, staged production rollout

## 1. Goal

Operate a production Starknet marketplace for multiple collections with an
owned read plane while retaining the deployed Arcade World and Marketplace
contracts, existing orders, approvals, calldata, and wallet transaction flow.

The application uses only shadcn primitives and Tailwind tokens for UI. The
owned data plane consists of a pinned Torii indexer per chain and a stable,
versioned Fastify API. `@cartridge/arcade` is permitted only behind the narrow
contract write adapter.

## 2. Product requirements

- Multi-collection browsing and switching without stale state leakage.
- API-wide token search, trait filtering, numeric ranges, currency selection,
  and all supported sort modes.
- Collection, token, metadata, ownership, order, activity, portfolio, SEO,
  Book, cart-validation, and diagnostics reads from the owned API.
- Multi-currency listings and offers with STRK as the default; floors and price
  comparisons are always scoped to one selected currency.
- Cart-based buying with a maximum of 25 rows, one currency per checkout,
  batch freshness validation, and one atomic transaction.
- Explicit loading, empty, error, and success states at every query boundary.
- No browser access to Torii SQL, Torii administration, Cartridge-hosted Torii,
  or Cartridge-hosted assets.

Contract upgrades, migrations, relisting, renewed approvals, fee/royalty rule
changes, wallet-provider replacement, a Starknet full node, and general UI
redesign are out of scope.

## 3. Architecture

- **Frontend:** Next.js App Router and React, with business logic in
  `src/lib` and `src/features`.
- **Public read contract:** TypeBox schemas in
  `packages/marketplace-api-contract`; the same schemas generate OpenAPI.
- **Read API:** Fastify service in `services/marketplace-api`, exposing only
  owned, parameterized `/v1` query templates.
- **Indexer:** one hardened Torii/SQLite writer per configured chain, using
  accepted L2 state and historical Order/Book storage.
- **Registry:** `config/marketplace/chains.json` is the checked-in source of
  truth and generates Torii and frontend configuration.
- **Writes:** the deployed Arcade contracts remain authoritative. Wallet
  transactions and direct RPC preflight remain unchanged.
- **Client state:** Zustand persists cart state; TanStack Query owns remote
  read state.
- **Infrastructure:** AWS CloudFront/WAF/ALB, two ECS API tasks, private EC2/EBS
  Torii writers, WAL-aware S3 replication, snapshots, metrics, and traces.

## 4. Domain invariants

1. Marketplace order identity is `(orderId, collection, tokenId)` everywhere.
2. Felt input may be padded or unpadded; API output is canonical 64-digit
   lowercase hexadecimal.
3. IDs, amounts, quantities, balances, and timestamps cross the API as decimal
   strings.
4. Accepted L2 state is canonical and reported in every successful envelope.
5. Trait names combine with AND; values within one trait combine with OR.
6. Numeric ranges are inclusive; missing numeric values fail the range and sort
   last.
7. Raw atomic prices are never compared across currencies.
8. Checkout fails closed when the API is unhealthy, contract identity differs,
   Book is paused, lag exceeds two blocks, or an order changed.
9. Offers remain supported. The retained buy-order executor fee-receiver risk
   must remain visible beside offer creation.

## 5. Routes

- `/`: collection discovery
- `/collections/[address]`: collection filters, grid, orders, and activity
- `/collections/[address]/[tokenId]`: token metadata, listings, activity, and
  write actions
- `/portfolio`: arbitrary-wallet holdings
- `/profile/[address]`: wallet profile
- `/ops`: API/indexer diagnostics

The public read API surface is defined by
`packages/marketplace-api-contract/src/index.ts` and versioned under `/v1`.
Metadata image URLs resolve through the owned, registry-allowlisted asset
routes `/v1/chains/:chain/assets/:collection/image?v=:contentVersion` and
`/v1/chains/:chain/assets/:collection/:tokenId/image?v=:contentVersion`.
Those routes proxy only Torii's private sanitized image cache; they never fetch
an arbitrary URL supplied by a browser.

## 6. Configuration contract

Required or supported frontend variables:

```env
NEXT_PUBLIC_MARKETPLACE_CHAIN_ID=SN_MAIN
NEXT_PUBLIC_MARKETPLACE_API_BASE_URL=http://localhost:3001
MARKETPLACE_READ_ROLLOUT=off
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

`MARKETPLACE_READ_ROLLOUT` must be exactly
`off|browse|portfolio|orders|checkout`; each value includes preceding stages.
Invalid values fail startup.

During staged rollout only,
`NEXT_PUBLIC_MARKETPLACE_COLLECTIONS=address|name|legacyProjectId` may override
the generated collection list. The third field is ignored. Cartridge project
and runtime values are not product data-routing inputs.

RPC URLs and credentials live in Secrets Manager and never in the registry.
The API additionally requires `MARKETPLACE_PUBLIC_BASE_URL`; it must be an
HTTPS origin in deployed environments and is used to generate owned asset
URLs. HTTP is accepted only for loopback development origins.

## 7. Delivery and rollout

1. Validate the registry, contract freeze, start blocks, and class hashes.
2. Qualify two managed RPC providers with deterministic bounded replays.
3. Build and security-test the pinned Torii image and generated configuration.
4. Provision backups, restore automation, monitoring, and blue/green operation.
5. Deploy the shared API contract and Fastify read service.
6. Populate metadata and content-hashed asset delivery.
7. Move browse, portfolio/SEO, orders, and checkout in that order.
8. Run shadow reconciliation, load/chaos tests, soak periods, and restore drills.

The unavailable Cartridge endpoint is not a rollback target. Owned deployment
versions are retained for rollback; browse may enter a visibly degraded cached
mode, while checkout always fails closed.

## 8. Testing and release gates

Behavior changes follow RED -> GREEN -> REFACTOR. Required layers include:

- registry golden tests;
- Torii hardening Rust tests;
- API schema, pagination, filtering, sorting, currency, query-safety, timeout,
  cache, and fixture-database integration tests;
- frontend MSW tests using the owned API contract;
- deterministic Playwright browse, portfolio, cart, checkout, and diagnostics;
- live Sepolia lifecycle, two-provider replay/failover, restore, chaos, and load
  evidence;
- Terraform validation, static analysis, container scanning, and SBOMs.

Production cutover is blocked until replay hashes match, both RPC providers
qualify, p95 lag is at most two blocks during a seven-day soak, cached API p95
is under 500 ms, availability reaches 99.9%, and a restore demonstrates RPO
under five minutes and RTO under 60 minutes.

## 9. Completion definition

The migration is complete only when every read surface uses the owned API,
browser traffic contains no Cartridge Torii/static requests, checkout safety
gates are active, replay/restore/failover evidence passes, and writes still
target the retained World and Marketplace deployments.

The detailed implementation contract is
[`MARKETPLACE-INDEXER-REPLACEMENT-SCOPE.md`](./MARKETPLACE-INDEXER-REPLACEMENT-SCOPE.md),
with the retained-contract decision recorded in
[`adr/0001-retain-arcade-contracts.md`](./adr/0001-retain-arcade-contracts.md).
