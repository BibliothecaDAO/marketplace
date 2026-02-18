# Biblio Marketplace Scope

## 1. Goal
Build a production-ready Next.js marketplace for multiple collections using only:
- `shadcn/ui` components
- Tailwind CSS tokens/utilities
- `@cartridge/arcade` marketplace SDK

The current scaffold is a foundation release (P0) with SDK wiring, typed runtime config, and a minimal responsive UI shell.

## 2. Product Requirements
- Multi-collection browsing and switching.
- Collection/token listing views powered by Arcade marketplace hooks.
- Minimal but polished visual language using semantic theme tokens (`primary`, `secondary`, `accent`, `muted`, `destructive`, `chart-*`).
- No custom design system outside shadcn+Tailwind primitives.
- Configuration via environment variables for chain and collection registry.
- Cart-based buying flow that allows selecting NFTs and purchasing selected listings in one action.
- Sweeper-ready selection pipeline that can auto-add lowest-value listings into the cart.

## 3. Architecture (Target)
- **Framework**: Next.js App Router (TypeScript).
- **UI**: shadcn components + Tailwind theme variables.
- **Data Layer**: Arcade React hooks under `MarketplaceClientProvider`.
- **Client State**: Zustand for persisted cart state and checkout status.
- **Config**: runtime env parsing in `src/lib/marketplace/config.ts`.
- **Rendering strategy**:
  - Server component route shell (`src/app/page.tsx`).
  - Client marketplace module for interactive state/hooks (`src/components/marketplace/marketplace-shell.tsx`).

## 4. SDK Integration Plan
1. Initialize provider once at app layout level.
2. Read chain/project defaults from env and build `MarketplaceClientConfig`.
3. Source collection registry from env (`NEXT_PUBLIC_MARKETPLACE_COLLECTIONS`).
4. Use hooks per selected collection:
   - `useMarketplaceCollection`
   - `useMarketplaceCollectionTokens`
   - `useMarketplaceCollectionListings`
5. Add robust loading/error/empty UI states at every query boundary.

## 5. Route Map (Planned)
- `/`:
  - Collection switcher
  - Token grid
  - Status/metrics cards
  - Theme token palette
- `/collections/[address]` (P1):
  - Collection profile
  - Trait filters
  - Pagination/infinite scroll
- `/collections/[address]/tokens/[tokenId]` (P1):
  - Token detail
  - Listing history
  - Royalty + fees
- Global header cart control (P2):
  - Top-right cart trigger
  - Right-side cart popout/sidebar
  - Checkout state and inline per-item validation errors

## 6. Delivery Phases

## Phase P0 (implemented in this init)
- Next.js + Tailwind + shadcn setup.
- Arcade SDK install and provider wiring.
- Typed env configuration parser with warnings.
- Minimal responsive marketplace shell with:
  - collection selection
  - token querying
  - listing counts
  - theme color coverage card
- Setup docs (`README.md`, `.env.example`).

## Phase P1 (core marketplace UX)
- URL-stateful collection/token routes.
- Pagination and cursor management for token results.
- Token detail page with orders/listings.
- Fees + royalty display using SDK methods.
- Strong error states and retry controls.

## Phase P2 (conversion + cart checkout)
- Wallet/connect integration if required by product flow.
- Offer/listing action flows and transaction UX.
- Cart item selection from collection/home/detail surfaces.
- Persisted Zustand cart store with local storage.
- Single-transaction cart checkout.
- Checkout fee-inclusive totals and strict stale listing validation.
- Collection verification badges and provenance metadata.
- Analytics instrumentation (view/click/listing funnel).

## Phase P3 (sweeper + scale + ops)
- Sweeper intake logic to auto-add lowest-value listings to cart.
- Caching strategy and ISR/revalidation policy.
- Monitoring + alerting around SDK/API failures.
- Security hardening and dependency policy.
- CI pipeline: lint, typecheck, tests, build.

## 7. Configuration Contract
Environment variables:
- `NEXT_PUBLIC_MARKETPLACE_CHAIN_ID` = `SN_MAIN` | `SN_SEPOLIA` | `0x...`
- `NEXT_PUBLIC_MARKETPLACE_DEFAULT_PROJECT` = optional Arcade project id
- `NEXT_PUBLIC_MARKETPLACE_COLLECTIONS` = CSV of `address|name|projectId`

Example:
`0x123...|Genesis|project-a,0x456...|Artifacts|project-b`

## 8. Testing Strategy
- P0: lint + build gate (done for scaffold validation).
- P1:
  - Unit tests for env parser and metadata extraction helpers.
  - Component tests for loading/error/empty/success states.
  - E2E flow: select collection -> render tokens -> open token detail.
- P2+:
  - Smoke tests against staging chain/project.
  - Contract/SDK response shape validation.

## 9. Risks and Mitigation
- **SDK/node engine drift**: lock versions and enforce CI runtime.
- **Collection metadata inconsistency**: normalize fields and keep fallbacks.
- **Slow queries on large collections**: cursor pagination + virtualization.
- **Env misconfiguration**: startup warnings and visible empty-state guidance.

## 10. Acceptance Criteria for Initial Scaffold
- App starts with `npm run dev`.
- Uses shadcn/Tailwind only for UI primitives.
- Marketplace provider is initialized globally.
- At least one configured collection can be queried via SDK hooks.
- Scope document clearly defines phased plan and delivery boundaries.

## 11. Approved Cart and Sweeper Scope (February 18, 2026)
1. Cart entries represent specific listings and are keyed by `orderId` with `collection` and `tokenId` context.
2. Add-to-cart behavior from collection/home views auto-selects the cheapest active listing for a token.
3. Token detail view supports `Add to cart` only for buy intent (no direct buy shortcut in this phase).
4. Cart accepts only one currency at a time.
5. Cart has a hard cap of 25 items.
6. Cart state persists locally through Zustand persistence.
7. Checkout must run as a single transaction and does not fall back to sequential execution.
8. Checkout blocks strictly when any selected listing is stale or changed.
9. Validation failures are shown as per-item inline error rows in the cart.
10. Cart total includes marketplace fee data in summary calculations.
11. Sweeper integration path auto-adds lowest-value listings into the cart as candidate selections.
