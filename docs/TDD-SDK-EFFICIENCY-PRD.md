# Biblio Marketplace SDK Efficiency PRD + TDD

Version: 1.0  
Date: February 23, 2026  
Status: Draft for execution  
Primary focus: Query latency, payload efficiency, and correctness under multi-collection/multi-currency constraints

## 1. Executive Summary

This document defines a test-driven delivery plan to apply the SDK efficiency playbook to `biblio/marketplace`:
1. Force Arcade marketplace runtime to SQL edge mode explicitly.
2. Minimize browse-time ownership verification and keep validation strict only for detail/checkout.
3. Keep query endpoints bounded and deterministic.
4. Normalize token ID handling centrally for correctness and cache-key stability.
5. Upgrade trait SQL strategy away from prefix scans.
6. Adopt deferred metadata hydration for collection grids when SDK capability is available.

This is a behavior and performance initiative; all changes ship through strict `RED -> GREEN -> REFACTOR`.

## 2. Background and Baseline

### 2.1 Why this initiative

The current production app is functionally correct, but browse surfaces are heavier and stricter than necessary:
1. Runtime mode is not set explicitly to edge in client config.
2. Browse listings frequently request `verifyOwnership: true`.
3. Some listing validation paths call unbounded listing reads.
4. Trait metadata route uses `token_id LIKE` sampling rather than SQL join-based aggregation.
5. Token metadata is eagerly consumed in grid-heavy surfaces.

### 2.2 External benchmark context (from SDK notes)

Reference benchmark date: February 23, 2026.
1. Deferred listing flow p50 reported around `269ms` vs eager around `1823ms` on first page.
2. Payload reported around `16.9KB` deferred vs `~3.25MB` eager.

This project uses those numbers as directional evidence. Local targets are defined below and must be validated in-repo.

## 3. Problem Statement

Current implementation does not fully align with the optimization playbook because:
1. Runtime selection falls back to non-edge unless explicitly configured.
2. Browse pages incur ownership verification overhead intended for trust-critical actions.
3. Query boundaries are inconsistent (some missing explicit limits).
4. Token ID normalization logic is duplicated across features.
5. Trait SQL path favors simple prefix scan over collection-token join strategy.
6. Deferred metadata pipeline depends on SDK API capability not yet confirmed in the currently installed typed surface.

## 4. Goals, Non-Goals, and KPIs

### 4.1 Product goals

1. Reduce median latency for collection/home browse surfaces.
2. Reduce first-page payload size and unnecessary metadata transfer.
3. Preserve checkout safety and correctness guarantees.
4. Keep multi-collection and multi-currency invariants unchanged.

### 4.2 Non-goals

1. Protocol-level behavior changes.
2. Redesigning marketplace UX hierarchy.
3. Replacing shadcn/Tailwind primitives.
4. Introducing custom backend indexing services.

### 4.3 Success metrics

Primary:
1. Collection token-grid first-page p50 reduced by at least 40% vs current baseline.
2. Home collection-row first-page p50 reduced by at least 30% vs current baseline.
3. Browse query payload bytes reduced by at least 60% on representative collections.

Guardrails:
1. Checkout stale-listing block behavior remains unchanged.
2. No mixed-currency checkout regression.
3. No regressions in route URL canonical behavior (filters/sort/cursor).
4. Unit, integration, e2e suites pass.

## 5. Scope

### 5.1 In scope

1. `src/lib/marketplace/config.ts` runtime config contract extension.
2. Marketplace provider wiring and tests.
3. Browse listing query defaults for home, collection rows, collection grid, and collection summary surfaces.
4. Token-detail and cart listing query bounds and strictness.
5. Shared token ID normalization utility and adoption.
6. Trait metadata route runtime/query rewrite.
7. Optional deferred metadata path if SDK support is present.
8. Performance instrumentation and benchmark comparison artifact.

### 5.2 Out of scope

1. Cart transaction calldata model changes.
2. Offer/list/cancel protocol semantics.
3. Visual redesign of token card components.

## 6. Functional Requirements

## FR-01 Explicit Runtime Selection

Requirements:
1. SDK client config must include explicit runtime mode.
2. Runtime mode must default to `edge` unless overridden by env for rollback.
3. Runtime selection must be visible in ops diagnostics.

Acceptance criteria:
1. Provider initializes marketplace client with `runtime: "edge"` by default.
2. Env override can switch to `dojo` without code changes.
3. Tests verify runtime field propagation and fallback behavior.

Tests required:
1. Unit: config parser returns runtime field and validates accepted values.
2. Integration: provider forwards runtime into `MarketplaceClientProvider`.

## FR-02 Browse Ownership Policy

Requirements:
1. Browse surfaces use `verifyOwnership: false` by default.
2. Trust-critical paths keep `verifyOwnership: true`.
3. Collection market activity keeps user toggle behavior.

Acceptance criteria:
1. Home and collection browse queries no longer force ownership verification.
2. Token detail listing query remains strict.
3. Checkout pre-validation and refresh paths remain strict.

Tests required:
1. Integration: hook call assertions for browse components.
2. Integration: token detail/cart tests confirm strict ownership still enabled.

## FR-03 Bounded Listing/Order Reads

Requirements:
1. All direct listing/order reads must specify explicit `limit`.
2. Detail and validation paths use small bounded limits aligned to required behavior.
3. No unbounded list reads remain in app code.

Acceptance criteria:
1. Static scan finds zero `listCollectionListings` calls without `limit`.
2. Token detail listing read has explicit limit.
3. Cart validation and refresh listing reads have explicit limit.

Tests required:
1. Unit/integration: existing mocks assert presence of `limit` argument.
2. Regression: checkout stale handling unchanged.

## FR-04 Canonical Token ID Handling

Requirements:
1. Single shared utility normalizes/dedupes token IDs for query and key usage.
2. Decimal/hex variants map consistently to canonical forms.
3. Existing ad hoc expansion helpers are removed where safe.

Acceptance criteria:
1. Cross-feature token ID behavior is deterministic.
2. Duplicate token variants no longer create redundant query payloads.
3. Existing fallback semantics remain compatible.

Tests required:
1. Unit: canonicalization cases (`ff`, `0xff`, `255` equivalent intent where representable).
2. Integration: collection/profile/token paths continue to resolve tokens correctly.

## FR-05 Trait SQL Optimization

Requirements:
1. Trait metadata API route runs in edge runtime.
2. Trait query uses collection-token join/CTE pattern instead of `LIKE` prefix scan.
3. Caching and timeout behavior remain explicit.

Acceptance criteria:
1. Route exports `runtime = "edge"`.
2. Generated SQL contains join-based structure and no `token_id LIKE '<address>:%'`.
3. Existing fallback behavior on upstream failure remains unchanged.

Tests required:
1. Route tests updated for runtime and SQL shape.
2. Error-path cache header behavior preserved.

## FR-06 Deferred Metadata Pipeline (Capability-gated)

Requirements:
1. If SDK supports `includeMetadata: false` and metadata batch hydration APIs, token grids must load IDs/essentials first and hydrate visible cards second.
2. If SDK does not support these APIs, this requirement is deferred and explicitly documented.

Acceptance criteria:
1. Capability detection gate exists and is tested.
2. Supported path hydrates only visible card windows.
3. Unsupported path keeps current behavior with no regressions.

Tests required:
1. Unit: capability gate behavior.
2. Integration: deferred metadata fetch sequence and UI loading states.
3. E2E: collection browse remains usable under delayed metadata fetch.

## 7. Architecture and Design Decisions

1. Runtime configuration will be extended in `src/lib/marketplace/config.ts` and consumed centrally by `src/components/providers/marketplace-provider.tsx`.
2. Ownership policy logic remains near query callsites to preserve intent clarity per surface.
3. Token ID canonicalization moves to `src/lib/marketplace/token-id.ts` (new), referenced by hooks and feature modules.
4. Trait query builder remains in the API route module but with dedicated helper function(s) for testable SQL generation.
5. Deferred metadata is implemented behind a capability adapter layer to avoid leaking SDK-version branching across UI components.

## 8. TDD Delivery Model

Rules:
1. No production code for these behaviors before failing tests exist.
2. Each ticket below defines explicit RED tests first.
3. GREEN changes must be minimal and scoped to ticket outcome.
4. REFACTOR follows only after green test state.

Quality gates per PR:
1. `pnpm test`
2. `pnpm typecheck`
3. `pnpm lint`
4. For route/UI behavior changes: `pnpm build` and selected `pnpm test:e2e`

## 9. Ticketized Implementation Plan

## Sprint A: Runtime + Ownership + Bounds (high impact, low risk)

### SDK-001 Runtime config contract

Outcome:
1. Add runtime field to parsed SDK config with env override.

Status:
- [x] Completed (February 23, 2026)

Scope:
1. `src/lib/marketplace/config.ts`
2. `src/lib/marketplace/config.test.ts`

RED tests:
1. Failing test for default runtime `edge`.
2. Failing test for valid override values (`edge`, `dojo`).
3. Failing test for invalid override fallback + warning.

GREEN tasks:
1. Extend env contract and parser.
2. Set `sdkConfig.runtime` from parsed value.

REFACTOR tasks:
1. Consolidate runtime parsing helpers and warning messages.

### SDK-002 Provider wiring

Outcome:
1. Runtime config is forwarded into marketplace provider.

Status:
- [x] Completed (February 23, 2026)

Scope:
1. `src/components/providers/marketplace-provider.tsx`
2. `src/components/providers/marketplace-provider.test.tsx`

RED tests:
1. Existing provider test fails until runtime is present in config call.

GREEN tasks:
1. Pass updated `sdkConfig` unchanged.

REFACTOR tasks:
1. Keep provider test fixtures typed and minimal.

### SDK-003 Browse ownership defaults

Outcome:
1. Non-critical browse surfaces stop verifying ownership by default.

Status:
- [x] Completed (February 23, 2026)

Scope:
1. `src/features/home/use-home-page-data.ts`
2. `src/components/marketplace/collection-row.tsx`
3. `src/features/collections/collection-route-view.tsx`
4. `src/features/collections/collection-token-grid.tsx`
5. Related tests that assert `verifyOwnership: true`

RED tests:
1. Adjust failing assertions to expect `verifyOwnership: false` on browse paths.
2. Keep tests asserting strict mode where required.

GREEN tasks:
1. Update query options for browse surfaces.

REFACTOR tasks:
1. Add helper constants for browse/detail defaults to avoid drift.

### SDK-004 Bounded listings in strict paths

Outcome:
1. Add explicit limits to token detail and cart listing reads.

Status:
- [x] Completed (February 23, 2026)

Scope:
1. `src/features/token/token-detail-view.tsx`
2. `src/features/cart/components/cart-sidebar.tsx`
3. Corresponding tests

RED tests:
1. Failing tests asserting `limit` is passed in detail query and cart client calls.

GREEN tasks:
1. Set explicit limit values tuned for each path.

REFACTOR tasks:
1. Centralize listing-limit constants in `src/lib/marketplace/query-limits.ts`.

## Sprint B: Canonicalization + Trait SQL

### SDK-005 Shared token ID canonicalization utility

Outcome:
1. Replace duplicated token-id expansion/canonicalization logic with shared utility.

Status:
- [x] Completed (February 23, 2026)

Scope:
1. New: `src/lib/marketplace/token-id.ts`
2. Tests: `src/lib/marketplace/token-id.test.ts`
3. Integrations in grid/collection/profile/hooks modules

RED tests:
1. Canonical/dedupe behavior across decimal/hex inputs.
2. Stable output ordering for deterministic cache keys.

GREEN tasks:
1. Implement utility and replace feature-local helpers.

REFACTOR tasks:
1. Remove dead helper code and simplify callsites.

### SDK-006 Trait metadata SQL rewrite

Outcome:
1. Route uses edge runtime and join/CTE trait query.

Status:
- [x] Completed (February 23, 2026)

Scope:
1. `src/app/api/collections/[address]/trait-metadata/route.ts`
2. `src/app/api/collections/[address]/trait-metadata/route.test.ts`

RED tests:
1. Runtime assertion changed to `edge`.
2. SQL body assertion expects join/CTE signature and rejects legacy `LIKE` pattern.

GREEN tasks:
1. Rewrite query builder and runtime export.

REFACTOR tasks:
1. Extract SQL builder for isolated unit testing.

## Sprint C: Deferred Metadata (capability-gated)

### SDK-007 Capability probe and adapter

Outcome:
1. Formal capability layer for deferred metadata APIs.

Status:
- [x] Completed (February 23, 2026)

Scope:
1. New: `src/lib/marketplace/sdk-capabilities.ts`
2. New tests for capability detection behavior

RED tests:
1. Failing tests for supported/unsupported SDK signatures.

GREEN tasks:
1. Implement capability checks and typed adapter interface.

REFACTOR tasks:
1. Ensure no UI directly introspects SDK internals.

### SDK-008 Deferred grid hydration (only if SDK capability exists)

Outcome:
1. Collection grid and home row load minimal token page first; hydrate metadata on visible subset.

Status:
- [x] Completed as deferred-by-capability (February 23, 2026)
- Current `@cartridge/arcade@0.3.14-preview.1` surface does not expose deferred metadata APIs (`includeMetadata: false` + metadata batch hydration methods), so fallback behavior is intentionally retained.

Scope:
1. `src/features/collections/collection-token-grid.tsx`
2. `src/components/marketplace/collection-row.tsx`
3. `src/features/home/use-home-page-data.ts`
4. New/updated tests around metadata loading phases

RED tests:
1. Failing integration test for staged loading behavior.
2. Failing test that hidden cards are not hydrated immediately.

GREEN tasks:
1. Implement staged query + hydration.
2. Keep empty/error/loading boundaries explicit.

REFACTOR tasks:
1. Extract shared deferred hydration hook.

## Sprint D: Benchmarking + rollout

### SDK-009 Performance harness and report

Outcome:
1. Reproducible benchmark artifact for before/after comparisons.

Status:
- [x] Completed (February 23, 2026)

Scope:
1. Script(s) under `scripts/` and docs artifact under `.context/` or `docs/`.

RED tests:
1. Failing script assertions for output schema.

GREEN tasks:
1. Capture p50/p95 latency, payload bytes, request counts per key route.

REFACTOR tasks:
1. Normalize output format for CI diffing.

### SDK-010 Rollout controls

Outcome:
1. Feature flags for runtime mode and deferred metadata path.

Status:
- [x] Completed (February 23, 2026)

Scope:
1. Config parser + ops diagnostics + docs.

RED tests:
1. Failing config tests for flag parsing.

GREEN tasks:
1. Add flags and safe default behavior.

REFACTOR tasks:
1. Remove temporary migration branches once stable.

## 10. Test Matrix

Unit:
1. Runtime parser, canonical token IDs, capability detection, SQL builder, limit constants.

Integration (RTL/Vitest):
1. Provider runtime propagation.
2. Browse ownership flags by surface.
3. Token detail/cart strict checks.
4. Deferred metadata staged rendering (when enabled).

E2E (Playwright):
1. Browse home and collection pages with filters/sort unchanged.
2. Add-to-cart and checkout validation unaffected.
3. Trait filter behavior stable after route SQL rewrite.

Performance checks:
1. First page collection route latency and payload.
2. Home featured section latency and payload.

## 11. Rollout Strategy

1. Phase 1 rollout: runtime explicit + browse ownership defaults + bounded limits.
2. Phase 2 rollout: trait SQL rewrite.
3. Phase 3 rollout: deferred metadata behind feature flag and capability gate.
4. Keep env rollback path for runtime mode and deferred behavior toggles.

## 12. Risks and Mitigations

1. Risk: SDK typed surface may not yet expose deferred metadata APIs.  
Mitigation: capability gate and explicit deferred scope deferral.

2. Risk: browse results include stale owners when `verifyOwnership: false`.  
Mitigation: keep strict verification in detail/checkout paths and explicit refresh affordances.

3. Risk: trait SQL rewrite may alter counts unexpectedly.  
Mitigation: snapshot tests against representative fixtures and compare old/new counts in staging.

4. Risk: runtime switch may expose environment-specific edge constraints.  
Mitigation: env rollback to `dojo` and ops panel runtime visibility.

## 13. Definition of Done

1. All in-scope tickets pass with TDD evidence (failing test first, then passing).
2. CI gates pass (`lint`, `typecheck`, `test`, `build`, relevant e2e).
3. Performance report shows target improvements or documented deltas.
4. No regressions to cart safety invariants and multi-currency checkout behavior.
5. Documentation updated with final runtime/feature flag contract.

## 14. Open Questions

1. Which exact SDK ref/version should be used if deferred metadata APIs are required but absent in current package typings?
2. Should trait metadata API remain in-app route or be moved to a reusable server utility for cross-route usage?
3. What target collections should form the fixed benchmark corpus for CI parity?
