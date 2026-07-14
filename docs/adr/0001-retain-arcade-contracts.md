# ADR 0001: Retain Arcade contracts while replacing the read plane

- Status: Accepted for this migration
- Date: 2026-07-14
- Owners: Marketplace engineering and operations

## Context

The Cartridge-hosted marketplace indexer is no longer a dependable product
read dependency. The deployed Arcade World and Marketplace contracts still
contain the authoritative Book, order, approval, and settlement state. Moving
that state to a new contract would require relisting and renewed approvals and
is outside this migration.

The exact chain identities, addresses, class hashes, and first indexed blocks
are owned by [`config/marketplace/chains.json`](../../config/marketplace/chains.json).
Copies in prose are informational only; build generation and runtime identity
checks must use the registry.

## Decision

1. Keep the Mainnet and Sepolia Arcade World and Marketplace deployments.
2. Keep existing orders, approvals, order keys, ABIs, fee/royalty semantics,
   wallet providers, and transaction calldata.
3. Replace every hosted marketplace read with the owned Torii, Fastify API,
   metadata, asset, and diagnostics plane.
4. Treat accepted L2 state as the read plane's canonical finality level.
5. Identify an order by `(orderId, collection, tokenId)`. `orderId` by itself
   is never sufficient in storage, APIs, cart validation, or logs.
6. Keep `@cartridge/arcade` behind the single static allowlisted write adapter.
   It may perform contract validity and construct list, offer, cancel, and
   execute calls; it may not issue hosted reads.
7. Fail checkout closed when API readiness, chain identity, Book state, order
   terms, direct-chain validity, or index freshness cannot be proven.

## Explicitly accepted contract risk

The retained buy-order executor accepts client-fee receiver terms that are not
bound into the maker's stored order. This migration does not change that
on-chain behavior. The risk is accepted only with these controls:

- Offer creation always displays a warning that the executor can select an
  unbound client-fee receiver.
- The warning may not be hidden by rollout state or currency selection.
- API data and checkout preflight must not describe that fee receiver as maker
  committed.
- No migration test may imply that the owned read plane fixes the executor.
- A future contract/security project is required to remove the risk.

This is risk acceptance, not a security finding closure.

## Registry inclusion decision

The former frontend environment listed
`0x0117feca92e98eeca862099c0b4567f32c252bf1b736f2946f0df4f42fa8a544`
as “Cosmetics Claim.” Direct chain inspection shows that its ABI implements a
claim application (`CosmeticCollectiblesClaim`), not ERC-721 or ERC-1155. It is
therefore intentionally excluded from the collection index and public
collection catalog. The Cosmetics token contract remains included.

Sepolia currently has no product NFT collection in the registry. This is not a
license to substitute an arbitrary contract: the production release gate
requires a registered, verified Sepolia collection and a complete signed
lifecycle test before `launch_enabled=true` can pass.

## Consequences

- No relisting, approval migration, or order migration is required.
- Read infrastructure can be rebuilt or rolled back without an on-chain write.
- Contract defects and legacy semantics remain authoritative.
- The owned API can expose stronger provenance and safety checks but cannot
  make an unsafe on-chain transition impossible.
- The hosted Cartridge endpoint is not a rollback target. Browse rollback uses
  an earlier owned API/Torii deployment or bounded stale CDN data; checkout is
  disabled.

## Verification

Production release evidence must prove:

- Registry class identities still match both chains.
- Two deterministic empty replays have identical order, Book, token, balance,
  trait, and activity hashes at the same fixed checkpoint.
- Browser traffic contains no Cartridge Torii or Cartridge static asset URL.
- `pnpm ci:arcade-imports` passes.
- Offer warning and checkout fail-closed tests pass.
- Rollback leaves chain state unchanged.
