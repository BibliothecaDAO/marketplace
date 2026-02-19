# Marketplace SDK Shared Cache PRD + TDD Plan

Version: 1.0  
Date: February 19, 2026  
Status: Approved for implementation scoping  
Owner: Marketplace team

## 1. Objective

Introduce a shared server-side cache between client UI and Arcade Marketplace SDK reads to reduce indexer load and improve user-perceived latency.

Decision for this phase:
- Use Next.js `unstable_cache` only.
- Keep wallet/portfolio reads (`useMarketplaceTokenBalances`) out of scope.

## 2. Problem Statement

Current read paths invoke SDK/indexer queries directly from client hooks, which causes:
1. Duplicate cross-user requests for identical market data.
2. Unnecessary indexer pressure under concurrent traffic.
3. Variable latency on collection pages, filters, and token detail surfaces.

Client-side React Query cache exists but is user/session-local and does not provide shared cache benefits.

## 3. Goals and Success Metrics

### 3.1 Product Goals
1. Reduce repeated indexer requests for common marketplace reads.
2. Improve responsiveness of collection/home/token pages under real traffic.
3. Preserve current UX semantics and query behavior.

### 3.2 Performance Targets
1. Shared cache hit ratio for eligible endpoints: >= 70% under steady traffic.
2. p95 response time reduction for cached reads:
   - trait metadata endpoints: >= 40% vs uncached baseline
   - collection/listings/token endpoints: >= 25% vs uncached baseline
3. SDK/indexer request volume reduction for eligible reads: >= 50% vs baseline.

### 3.3 Quality Guardrails
1. No regression in route behavior, loading states, or error states.
2. No stale data windows beyond defined TTLs.
3. No changes to write transaction flows.

## 4. Scope

### 4.1 In Scope
1. Add internal server API routes for marketplace reads currently fetched in client hooks.
2. Back each route with `unstable_cache` keyed by normalized request params.
3. Apply per-resource TTL policy:
   - Trait/filter metadata: 1 hour.
   - Collection/market/token reads: 15 seconds.
4. Migrate eligible hooks to call internal API routes instead of SDK client methods directly.
5. Add route-level observability (cache hit/miss markers).

### 4.2 Explicitly Out of Scope
1. Wallet/portfolio reads and ownership balance reads powered by `useMarketplaceTokenBalances`.
   - Includes `useWalletPortfolioQuery`, `useTokenOwnershipQuery`, `useTokenHolderQuery`.
2. Checkout/list/offer/cancel transaction execution paths.
3. External cache infrastructure (Redis/Upstash/Cloudflare) in this phase.
4. Full protocol-level invalidation beyond TTL expiry.

## 5. Current-State Callsite Inventory

Eligible reads currently in `src/lib/marketplace/hooks.ts` and related views:
1. `useCollectionQuery` -> `client.getCollection`
2. `useCollectionTokensQuery` -> `client.listCollectionTokens`
3. `useCollectionOrdersQuery` -> `client.getCollectionOrders`
4. `useCollectionListingsQuery` -> `client.listCollectionListings`
5. `useTokenDetailQuery` -> `client.getToken`
6. `useCollectionTraitMetadataQuery` -> `fetchCollectionTraitMetadata` + `aggregateTraitMetadata`
7. Token detail fee card (`src/features/token/token-detail-view.tsx`) -> `client.getFees`, `client.getRoyaltyFee`
8. SEO metadata (`src/lib/marketplace/seo-data.ts`) -> `client.getCollection`, `client.getToken`

## 6. Target Architecture

## 6.1 Read Path
1. Browser component hook calls internal route (`/api/marketplace/...`).
2. Route handler validates request params.
3. Route calls cached server function wrapped with `unstable_cache`.
4. Cached function executes SDK call on miss/stale, returns normalized payload.
5. Route returns JSON plus cache diagnostics headers.

## 6.2 Cache Strategy
1. `unstable_cache` used per resource with deterministic key parts.
2. Key parts include all response-shaping params.
3. TTL via `revalidate`:
   - 3600 for trait metadata
   - 15 for collection/tokens/orders/listings/token-detail/fees
4. Optional tags for future invalidation, but tag-driven invalidation is not required in this phase.

## 6.3 API Surface (New)

1. `GET /api/marketplace/collection`
   - Params: `address`, optional `projectId`, optional `fetchImages`
   - TTL: 15s
2. `GET /api/marketplace/collection-tokens`
   - Params: `address`, optional `project`, `cursor`, `limit`, `tokenIds[]`, `attributeFilters`
   - TTL: 15s
3. `GET /api/marketplace/collection-orders`
   - Params: `collection`, optional `status`, `category`, `tokenId`, `limit`
   - TTL: 15s
4. `GET /api/marketplace/collection-listings`
   - Params: `collection`, optional `tokenId`, `projectId`, `verifyOwnership`, `limit`
   - TTL: 15s
5. `GET /api/marketplace/token-detail`
   - Params: `collection`, `tokenId`, optional `projectId`, optional `fetchImages`
   - TTL: 15s
   - Preserves token-id fallback behavior (decimal <-> hex)
6. `GET /api/marketplace/collection-trait-metadata`
   - Params: `address`, optional `projectId`
   - TTL: 3600s
7. `GET /api/marketplace/token-fees`
   - Params: `collection`, `tokenId`, `amount`
   - TTL: 15s
   - Returns marketplace fee, royalty fee, total

## 7. Functional Requirements

### FR-CACHE-01 Shared Read Caching
1. All in-scope read endpoints must be served from server routes.
2. Server routes must cache by normalized query parameters.
3. Cache must be shared across users.

Acceptance Criteria:
1. Hook requests no longer call SDK methods directly for in-scope reads.
2. Repeated equivalent requests within TTL avoid duplicate SDK calls.

### FR-CACHE-02 TTL Policy Enforcement
1. Trait metadata responses must use 1-hour TTL.
2. Collection/market/token/fees responses must use 15-second TTL.

Acceptance Criteria:
1. TTL values are centralized constants and covered by tests.
2. Route handlers apply correct TTL by endpoint.

### FR-CACHE-03 Query Determinism
1. Cache keys must be stable for semantically equivalent params.
2. Collection token filters and token ID arrays must be normalized before keying.

Acceptance Criteria:
1. Different parameter ordering does not create duplicate cache entries.
2. Equivalent filter payloads map to same cache key.

### FR-CACHE-04 UX and Behavior Parity
1. Existing loading, error, and success states must remain unchanged.
2. Existing fallback logic for transient token fetch issues must remain intact.

Acceptance Criteria:
1. Hook tests remain green with route-backed data.
2. UI feature tests retain behavior without snapshot regressions.

### FR-CACHE-05 Scope Boundary Integrity
1. Wallet and portfolio reads must remain direct and unchanged.
2. Ownership checks tied to token balances remain unchanged.

Acceptance Criteria:
1. `useWalletPortfolioQuery`, `useTokenOwnershipQuery`, `useTokenHolderQuery` are not migrated.
2. Portfolio/profile/ownership tests pass unchanged unless only selector or plumbing updates are required.

## 8. Non-Functional Requirements

1. Type safety: strict TypeScript; no new `any`.
2. Reliability: API route errors return structured response with stable `message`.
3. Security: validate and sanitize query params before SDK calls.
4. Observability: add cache diagnostics headers:
   - `x-market-cache`: `hit` | `miss`
   - `x-market-cache-key`: hash or redacted key id (non-sensitive)

## 9. Data and Error Contracts

1. Route responses should preserve current hook-consumed shape whenever possible.
2. Failures should return `4xx` for invalid params, `5xx` for upstream/SDK failures.
3. Hook wrappers must convert non-2xx responses into thrown Errors with useful message.
4. Do not leak secrets/internal stack traces in API payloads.

## 10. Rollout Plan

### Phase 1 (Foundation)
1. Add cache constants and key-normalization utilities.
2. Add server SDK client helper used by route handlers.
3. Implement and test trait metadata route (1h TTL).

### Phase 2 (Core Read Routes)
1. Add collection/tokens/orders/listings/token-detail routes with 15s TTL.
2. Migrate corresponding hooks to route-backed fetch.
3. Preserve existing retry/fallback semantics.

### Phase 3 (Fee + SEO + Hardening)
1. Add token-fees route with 15s TTL.
2. Migrate token detail fee loading to route.
3. Reuse route-level cached helpers in SEO data fetch flow.
4. Add diagnostics coverage and finalize docs.

## 11. Detailed TDD Execution Plan

## 11.1 Test Order (Mandatory)
For each ticket:
1. RED: write failing test for one behavior.
2. Verify RED: run targeted test and confirm expected failure reason.
3. GREEN: implement minimum code to pass.
4. Verify GREEN: rerun targeted test and adjacent suite.
5. REFACTOR: cleanup only with tests green.

## 11.2 Test Matrix

### Unit Tests
1. `src/lib/marketplace/cache-policy.test.ts`
   - verifies TTL constants (15s, 1h)
   - verifies endpoint-to-TTL mapping
2. `src/lib/marketplace/cache-keys.test.ts`
   - stable key serialization for token arrays and attribute filters
   - semantic equivalence assertions
3. `src/lib/marketplace/server-client.test.ts`
   - SDK client lazy init and error handling

### Route Tests (Integration)
1. `src/app/api/marketplace/collection-trait-metadata/route.test.ts`
   - repeated calls with same params hit cache within TTL
   - cache miss after TTL window (time-mocked)
2. Equivalent tests for collection/tokens/orders/listings/token-detail/token-fees routes.
3. Validation tests for missing/invalid params returning `400`.

### Hook Tests
1. Update `src/lib/marketplace/hooks.test.ts` to verify internal route fetch calls.
2. Preserve behavior tests for:
   - collection token fallback retry without images
   - token detail alternate ID fallback
   - transient retry policy

### Feature Integration Tests
1. Collection and token feature tests continue passing with route-backed hooks.
2. Token detail fee card tests verify route payload integration.

### E2E Smoke
1. Load `/`, `/collections/[address]`, `/collections/[address]/[tokenId]` and verify functional behavior unchanged.
2. Optional network assertion: no direct browser-side calls to indexer domain for in-scope reads.

## 11.3 Ticket Backlog (TDD First)

### CACHE-001 Cache Policy and Key Utilities
- RED tests:
  - TTL mapping and key normalization equivalence.
- GREEN:
  - implement `cache-policy.ts` and `cache-keys.ts`.
- REFACTOR:
  - remove duplicate serialization logic from hooks.

### CACHE-002 Trait Metadata Cached Route (1h)
- RED tests:
  - route validation and TTL behavior.
- GREEN:
  - route + cached SDK call with `revalidate: 3600`.
- REFACTOR:
  - extract route helpers for response/error shaping.

### CACHE-003 Core Collection Routes (15s)
- RED tests:
  - each route returns expected payload and validates params.
- GREEN:
  - add collection/tokens/orders/listings/token-detail routes with `revalidate: 15`.
- REFACTOR:
  - share common request parsing.

### CACHE-004 Hook Migration to Internal Routes
- RED tests:
  - hooks fail while still expecting old SDK path.
- GREEN:
  - migrate in-scope hook queryFns to `fetch` internal API.
- REFACTOR:
  - centralize fetch helper and error parser.

### CACHE-005 Fee Route + Token Detail Migration
- RED tests:
  - fee-card behavior uses route payload for marketplace/royalty/total.
- GREEN:
  - add token-fees route, wire token detail view.
- REFACTOR:
  - share fee parsing helpers.

### CACHE-006 SEO Cache Alignment
- RED tests:
  - metadata functions use cached server helper and preserve fallback behavior.
- GREEN:
  - route/helper reuse in `seo-data.ts`.
- REFACTOR:
  - dedupe token fallback logic.

### CACHE-007 Hardening + Regression Gate
- RED tests:
  - diagnostics headers and error contract tests.
- GREEN:
  - finalize headers and docs.
- REFACTOR:
  - streamline naming and constants.

## 12. Acceptance Criteria (Release)

1. All in-scope SDK reads are routed through internal cached endpoints.
2. Trait metadata TTL is 1 hour; other in-scope reads are 15 seconds.
3. Wallet/portfolio/ownership token-balance reads remain unchanged.
4. `npm run lint`, `npm run typecheck`, `npm test`, and `npm run build` pass.
5. No behavior regression on home, collection, token detail, cart fee card.

## 13. Risks and Mitigations

1. Risk: `unstable_cache` behavior differs across deployment modes.
   - Mitigation: integration tests in CI + observability headers in production.
2. Risk: Over-caching stale listings for active trading.
   - Mitigation: strict 15s TTL and explicit refresh controls preserved.
3. Risk: Cache key cardinality explosion from unnormalized filters.
   - Mitigation: deterministic param normalization and unit tests.
4. Risk: Hidden regressions from hook transport swap.
   - Mitigation: preserve existing hook test suite semantics before refactor.

## 14. Open Questions

1. Should route handlers expose an optional `cache=skip` debug query param for ops only?
2. Do we want explicit cache tags now (`revalidateTag`) for future write-trigger invalidation, or defer fully?
3. Should SEO endpoints share the exact same cache key helper as app routes in this phase or a follow-up?

## 15. Implementation Notes for This Phase

1. Use `unstable_cache` as the only shared cache mechanism.
2. Do not introduce Redis/Upstash or external cache services.
3. Do not migrate wallet/portfolio/token-balance reads in this scope.
