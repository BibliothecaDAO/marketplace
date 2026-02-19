# Biblio Marketplace TDD Implementation Plan

Version: 1.0  
Date: February 19, 2026  
Source of truth: `docs/TDD-PRD.md`

## 1. Delivery Model

Sprint cadence:
- 2-week sprints
- 1 engineering squad
- Strict TDD for all behavior changes (`RED -> GREEN -> REFACTOR`)

Working agreements:
- No ticket starts without explicit failing tests.
- Every ticket ships with unit + integration tests; funnel-impacting tickets add e2e coverage.
- No PR merges without `lint`, `typecheck`, `test`, `build` passing.

Definition of done per ticket:
1. Acceptance criteria met.
2. Tests added and passing in CI.
3. Accessibility checks included where UI changed.
4. Screenshots attached for UI deltas.

## 2. Ticket Template (Use For Every Ticket)

- Ticket ID:
- Outcome:
- Scope:
- Dependencies:
- RED tests to write first:
- GREEN implementation tasks:
- REFACTOR tasks:
- Evidence required in PR:
- Estimate (story points):

## 3. Sprint Roadmap Overview

- Sprint 0: Baseline hardening and funnel test scaffolding
- Sprint 1: Discovery foundations and URL-canonical state
- Sprint 2: Purchase clarity, fee transparency, checkout resilience
- Sprint 3: Portfolio route and trust/provenance UX
- Sprint 4: Funnel optimization, analytics, and release hardening

## 4. Sprint 0 - Baseline Hardening

Goal:
- Lock current behavior with regression coverage before feature expansion.

### MKT-001: Full Purchase Funnel E2E Skeleton
- Outcome: Add deterministic e2e for `home -> collection -> token -> add -> cart` path.
- Scope: `tests/e2e/home.spec.ts`, new `tests/e2e/purchase-funnel.spec.ts`.
- Dependencies: none.
- RED tests to write first:
  - failing spec for token add from collection page to cart sidebar row.
  - failing spec for add from token detail to cart sidebar row.
- GREEN implementation tasks:
  - stabilize selectors via data-testid where missing.
  - ensure cart sidebar open/close behavior is testable.
- REFACTOR tasks:
  - extract e2e helpers for route nav and cart assertions.
- Evidence required in PR:
  - failing and passing Playwright logs.
  - screenshots for changed test selectors.
- Estimate: 5

### MKT-002: Cart Error Visibility Regression Coverage
- Outcome: Prevent silent add-to-cart rejections.
- Scope: `src/features/cart/hooks/use-add-to-cart-feedback.ts`, `src/features/cart/components/cart-sidebar.tsx`, related tests.
- Dependencies: none.
- RED tests to write first:
  - integration test for mixed-currency rejection visible without requiring manual cart open.
  - integration test for max-cap rejection visibility.
- GREEN implementation tasks:
  - surface reject state in local context (toast/inline message).
  - preserve existing success behavior.
- REFACTOR tasks:
  - consolidate feedback message mapping.
- Evidence required in PR:
  - before/after UI screenshots for rejection case.
- Estimate: 3

### MKT-003: Remove Dead/Placeholder Trust Breakers
- Outcome: No production placeholder external links.
- Scope: `src/components/layout/header.tsx`, header tests.
- Dependencies: none.
- RED tests to write first:
  - header test asserting no `href="#"` in social links.
- GREEN implementation tasks:
  - wire real URLs or conditionally hide links.
- REFACTOR tasks:
  - centralize external link config.
- Evidence required in PR:
  - unit test output + screenshot of header.
- Estimate: 2

## 5. Sprint 1 - Discovery Foundations

Goal:
- Improve item discovery speed and state continuity.

### MKT-010: Home Global Search
- Outcome: Search across visible collections/tokens from `/`.
- Scope: `src/components/marketplace/marketplace-home.tsx`, `collection-row.tsx`, new helper under `src/lib/marketplace/`.
- Dependencies: MKT-001.
- RED tests to write first:
  - unit tests for query normalization and matching.
  - integration test for search filtering on home rows.
- GREEN implementation tasks:
  - add search input and debounced filtering.
  - explicit empty-state + reset action.
- REFACTOR tasks:
  - extract reusable search state hook.
- Evidence required in PR:
  - component test snapshots for search/empty states.
- Estimate: 5

### MKT-011: Collection Sort Controls + URL Sync
- Outcome: Sort mode on collection route (`price asc/desc`, `recent`) persisted in URL.
- Scope: `src/features/collections/collection-route-container.tsx`, `collection-token-grid.tsx`, query helpers.
- Dependencies: MKT-001.
- RED tests to write first:
  - parse/serialize tests for `sort` query param.
  - integration test for sort toggles updating URL and ordering.
- GREEN implementation tasks:
  - add sort controls.
  - apply deterministic client-side sort fallback when SDK sort unavailable.
- REFACTOR tasks:
  - compose all collection query params in one helper module.
- Evidence required in PR:
  - failing/passing URL-sync tests.
- Estimate: 5

### MKT-012: Collection Market Activity Row Usability
- Outcome: Orders/listings rows become actionable and informative.
- Scope: `src/features/collections/collection-market-panel.tsx`.
- Dependencies: MKT-011.
- RED tests to write first:
  - row includes token, price, owner, status/time where available.
  - row action navigates to token detail.
- GREEN implementation tasks:
  - redesign rows with clear CTA(s).
  - maintain existing filter behavior.
- REFACTOR tasks:
  - split row renderers into small components.
- Evidence required in PR:
  - screenshots for orders + listings tabs.
- Estimate: 3

## 6. Sprint 2 - Purchase Clarity and Conversion

Goal:
- Make fees transparent and checkout failures recoverable.

### MKT-020: Fee Math Engine and Cart Summary Integration
- Outcome: Cart shows real subtotal, marketplace fee, royalty estimate, total.
- Scope: new `src/lib/marketplace/fees.ts`, `src/features/cart/components/cart-sidebar.tsx`, hooks/tests.
- Dependencies: MKT-001, MKT-002.
- RED tests to write first:
  - unit tests for bigint-safe fee calculations.
  - integration test for reactive summary updates on add/remove.
- GREEN implementation tasks:
  - query marketplace fee/royalty where possible.
  - replace hardcoded fee row.
- REFACTOR tasks:
  - keep presentation and arithmetic separate.
- Evidence required in PR:
  - summary math test output + UI screenshot.
- Estimate: 8

### MKT-021: Checkout Stale Recovery UX
- Outcome: Users can recover quickly from stale listing block.
- Scope: `cart-sidebar.tsx`, cart store, tests.
- Dependencies: MKT-020.
- RED tests to write first:
  - stale row shows actionable guidance (`remove`, `refresh`, `retry`).
  - retry succeeds after stale row removal.
- GREEN implementation tasks:
  - add inline row action affordances.
  - improve checkout status messages.
- REFACTOR tasks:
  - normalize checkout error codes/messages.
- Evidence required in PR:
  - e2e stale->recover->success run.
- Estimate: 5

### MKT-022: Token Detail Fee/Royalty Card
- Outcome: Fee context is visible before add-to-cart.
- Scope: `src/features/token/token-detail-view.tsx`, marketplace hooks, tests.
- Dependencies: MKT-020.
- RED tests to write first:
  - token detail renders fee/royalty card with loading/empty/error states.
- GREEN implementation tasks:
  - fetch and display fee and royalty estimate per token.
- REFACTOR tasks:
  - extract token pricing panel component.
- Evidence required in PR:
  - screenshot and component tests for all states.
- Estimate: 3

## 7. Sprint 3 - Portfolio and Trust Surface

Goal:
- Improve wallet discoverability and confidence signals.

### MKT-030: New `/portfolio` Route with Address Input
- Outcome: Users can inspect arbitrary wallet holdings without connection.
- Scope: add `src/app/portfolio/page.tsx`, new `src/features/portfolio/*`, preserve `/profile/[address]`.
- Dependencies: MKT-001.
- RED tests to write first:
  - route renders address input and loads holdings.
  - invalid/empty address handling.
- GREEN implementation tasks:
  - implement portfolio search form + results list.
  - link holdings to token detail.
- REFACTOR tasks:
  - share parsing logic with existing profile view.
- Evidence required in PR:
  - route screenshot desktop/mobile.
- Estimate: 8

### MKT-031: Collection Trust/Provenance Indicators
- Outcome: Visible trust markers in collection header.
- Scope: `collection-route-view.tsx`, config model, tests.
- Dependencies: MKT-011.
- RED tests to write first:
  - verified badge shown when configured.
  - fallback hidden state when unavailable.
- GREEN implementation tasks:
  - introduce optional trust metadata in collection config.
  - render badge/hint without clutter.
- REFACTOR tasks:
  - centralize trust metadata mapping.
- Evidence required in PR:
  - UI screenshot + tests.
- Estimate: 3

### MKT-032: Dynamic OG Metadata Quality Upgrade
- Outcome: Better social share previews for token and collection pages.
- Scope: `src/lib/marketplace/seo-data.ts`, OG image routes.
- Dependencies: none.
- RED tests to write first:
  - metadata tests for title/image fallback behavior.
- GREEN implementation tasks:
  - enrich image/title with known collection/token context.
- REFACTOR tasks:
  - dedupe SEO helper logic.
- Evidence required in PR:
  - metadata test output.
- Estimate: 3

## 8. Sprint 4 - Optimization and Release Hardening

Goal:
- Finalize funnel reliability, observability, and accessibility.

### MKT-040: Funnel Analytics Instrumentation
- Outcome: Core discovery and checkout events emitted consistently.
- Scope: add analytics adapter + event calls in home/collection/detail/cart.
- Dependencies: MKT-010, MKT-020, MKT-021.
- RED tests to write first:
  - unit tests for event payload formatting.
  - integration test for `add_to_cart_*` and `checkout_*` emission.
- GREEN implementation tasks:
  - instrument defined event map from PRD.
- REFACTOR tasks:
  - typed event contract module.
- Evidence required in PR:
  - test logs proving event payloads.
- Estimate: 5

### MKT-041: Accessibility Regression Sweep
- Outcome: Primary flows satisfy keyboard/focus and ARIA requirements.
- Scope: header, filters, grid, cart sheet, dialogs/tabs.
- Dependencies: all UI tickets.
- RED tests to write first:
  - integration tests for keyboard nav and focus management.
- GREEN implementation tasks:
  - fix focus order, labels, and keyboard traps.
- REFACTOR tasks:
  - reusable accessibility test helpers.
- Evidence required in PR:
  - keyboard test output + Lighthouse report.
- Estimate: 5

### MKT-042: Release Candidate E2E Matrix
- Outcome: Stable high-signal e2e matrix in CI for conversion flow.
- Scope: `tests/e2e/*`, CI workflow tuning.
- Dependencies: all prior funnel tickets.
- RED tests to write first:
  - failing end-to-end suite covering discovery->purchase path variants.
- GREEN implementation tasks:
  - stabilize fixtures, retries, and deterministic selectors.
- REFACTOR tasks:
  - split smoke vs full regression suites.
- Evidence required in PR:
  - CI passing matrix artifacts.
- Estimate: 5

## 9. Immediate Kickoff Order (Start Now)

1. MKT-001
2. MKT-002
3. MKT-003
4. MKT-010
5. MKT-011

## 10. Sprint Capacity Guide (Suggested)

If capacity is ~16 points per sprint:
- Sprint 0: MKT-001 (5), MKT-002 (3), MKT-003 (2) = 10 points, plus carry-in bugfix buffer.
- Sprint 1: MKT-010 (5), MKT-011 (5), MKT-012 (3) = 13 points.
- Sprint 2: MKT-020 (8), MKT-021 (5), MKT-022 (3) = 16 points.
- Sprint 3: MKT-030 (8), MKT-031 (3), MKT-032 (3) = 14 points.
- Sprint 4: MKT-040 (5), MKT-041 (5), MKT-042 (5) = 15 points.

## 11. Traceability to PRD

- Discovery: FR-01, FR-02, FR-03, FR-04, FR-05 -> MKT-010/011/012
- Purchase clarity: FR-06, FR-07, FR-08, FR-09 -> MKT-020/021/022
- Portfolio + trust: FR-10, FR-11 -> MKT-030/031/032
- Reliability + accessibility: FR-12, FR-13 -> MKT-041/042
- Analytics: PRD analytics section -> MKT-040
