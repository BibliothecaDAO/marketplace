# Biblio Marketplace TDD PRD

Version: 2.0  
Date: February 19, 2026  
Status: Draft for execution  
Primary focus: Usability, discoverability, ease of purchase

## 1. Product Intent

Build a production-grade NFT marketplace for multiple collections on Arcade SDK with:
- Fast discovery from home to token detail.
- Frictionless and trustworthy purchase flow.
- Clean, minimal UX using only `shadcn/ui` + Tailwind tokens.
- Strict test-driven delivery where behavior is specified before implementation.

## 2. Problem Statement

The app already supports the core surfaces (home, collection, token detail, cart, profile, ops), but conversion-critical UX still has gaps:
1. Discovery is strong at collection level but weak globally (search/sort/state continuity).
2. Cart checkout is safe but fee transparency and failure feedback are incomplete.
3. Market trust signals (verification/provenance) are minimal.
4. Test depth is strong in unit/integration, but full purchase funnel e2e coverage is limited.

This PRD defines a phased, test-first path from current state to production-ready UX.

## 3. Goals and Success Metrics

## 3.1 Product Goals
1. Reduce time-to-first-relevant-token.
2. Increase add-to-cart to checkout completion.
3. Make checkout failures actionable and recoverable.
4. Preserve strict technical quality and release confidence.

## 3.2 UX KPIs (Primary)
1. Discovery speed:
   - Median time from landing on `/` to opening a token detail page.
   - Target: -30% from current baseline.
2. Purchase conversion:
   - Cart checkout success rate = successful tx / checkout attempts.
   - Target: >= 85% on healthy network conditions.
3. Failure recoverability:
   - Percentage of stale-listing checkout failures that recover to successful checkout within 3 minutes.
   - Target: >= 60%.
4. Navigation clarity:
   - Percentage of user sessions with at least one meaningful discovery action (`search`, `trait`, `sort`, `collection switch`) before exit.
   - Target: +20%.

## 3.3 Quality KPIs (Guardrails)
1. Lighthouse accessibility score on `/`, `/collections/[address]`, `/collections/[address]/[tokenId]`: >= 95.
2. No release with failing unit, integration, or e2e checks.
3. Zero critical regressions in cart transaction path.

## 4. Current Baseline (As of February 19, 2026)

Implemented:
1. Home collection rows with horizontal token discovery and add-to-cart.
2. Collection route with trait filtering, token grid pagination, market activity tab.
3. Token detail with listings, ownership-aware action forms, add-to-cart.
4. Persisted cart store (single currency, 25 max items, stale listing validation, atomic checkout).
5. Wallet profile route and client ops route.

Gaps to close:
1. Fee-inclusive checkout totals are not implemented with real fee data.
2. Add-to-cart rejection feedback can be missed.
3. Discoverability features are incomplete (global search/sort and URL-canonical state).
4. Trust and provenance surfaces are limited.
5. End-to-end tests do not fully cover funnel-critical scenarios.

## 5. Scope

## 5.1 In Scope
1. UX and behavior improvements on:
   - `/`
   - `/collections/[address]`
   - `/collections/[address]/[tokenId]`
   - Global cart sidebar
   - `/portfolio` (new)
   - `/ops` diagnostics improvements
2. Full TDD delivery for each behavior.
3. SDK-based fee/royalty visibility in evaluation and checkout.
4. Discoverability and purchase funnel analytics instrumentation.

## 5.2 Out of Scope
1. New protocol mechanics outside SDK support.
2. Custom design system beyond shadcn primitives and Tailwind tokens.
3. Custom backend indexing pipeline.

## 6. Users and Core Jobs

1. Collector:
   - Discover interesting tokens quickly.
   - Compare price and trait relevance.
   - Buy safely with clear totals and error handling.
2. Trader:
   - Inspect listings/orders efficiently.
   - Verify listing freshness before transaction.
3. Portfolio owner:
   - Inspect holdings by wallet and jump to listed assets.
4. Operator:
   - Diagnose client, config, and query health quickly.

## 7. UX Principles

1. Information hierarchy first:
   - Context -> filters/sort -> token cards -> market actions.
2. Predictable state:
   - URL is source of truth for discovery state.
3. Low-friction purchase:
   - Clear CTA, visible fees, explicit validation outcomes.
4. Actionable errors:
   - Every failure includes what happened and what to do next.
5. Accessible by default:
   - Keyboard support, focus visibility, AA contrast, semantic structure.
6. Performance-first interactions:
   - Skeleton loading, incremental rendering, no blocking waits.

## 8. Information Architecture and Routes

1. `/` (Marketplace Home)
   - Collection discovery rows
   - Global search entry
   - Quick sort/filter controls
   - Featured market stats
2. `/collections/[address]`
   - Collection header and stats
   - Trait filter panel
   - Token grid with pagination
   - Sort controls
   - Market activity tab
3. `/collections/[address]/[tokenId]`
   - Token media and metadata
   - Listings with best-price emphasis
   - Fee + royalty estimate
   - Add-to-cart by listing
4. Global cart sidebar
   - Listing rows keyed by `orderId`
   - Inline stale validation errors
   - Fee-inclusive totals
   - Single transaction checkout
5. `/portfolio` (new)
   - Address input
   - Holdings view with filters
   - Jump-to-token actions
6. `/ops`
   - Client status
   - Error diagnostics
   - Refresh/retry controls

## 9. Functional Requirements

## FR-01 Home Discoverability

Requirements:
1. Home must support quick discovery across collections.
2. Include global search by token name/id and collection name.
3. Include default sort mode (e.g., `recent`, `floor`, `volume` where supported).
4. Preserve minimal, readable layout on mobile and desktop.

Acceptance criteria:
1. Users can discover and open token detail in <= 3 primary interactions.
2. Search with no results shows explicit empty state and reset action.
3. Search and sort selections are reflected in URL when applicable.

Tests required:
1. Unit: search query normalization and matching logic.
2. Integration: home search updates displayed rows deterministically.
3. E2E: landing -> search -> open token detail.

## FR-02 Collection Discovery and Navigation

Requirements:
1. Collection switching updates route and resets cursor/filter state correctly.
2. Collection header must expose supply, listing count, and floor where available.
3. Collection-level sort controls must be available and URL-stateful.

Acceptance criteria:
1. Route updates immediately on collection switch without full reload.
2. On switch, stale cursor/filter state does not leak from previous collection.
3. Missing collection returns explicit empty state without crash.

Tests required:
1. Unit: query param parse/serialize helpers.
2. Integration: collection switch + URL sync + reset semantics.
3. E2E: navigate across two collections with persistent UX correctness.

## FR-03 Trait Filtering and URL Canonical State

Requirements:
1. Trait selections must update URL (`trait=Name:Value`).
2. Refresh and share-link must reconstruct identical filter state.
3. Trait counts update with active filters.
4. Clear-all and per-trait clear actions must be supported.

Acceptance criteria:
1. Trait state survives hard refresh.
2. Copy/paste URL reproduces same filtered results.
3. Empty trait metadata shows non-blocking fallback state.

Tests required:
1. Unit: filter flattening, parse, and merge logic.
2. Integration: sidebar interaction updates grid results + URL.
3. E2E: apply traits, refresh, and verify stable results.

## FR-04 Token Grid Usability

Requirements:
1. Support grid density modes and pagination.
2. Each card must show image fallback, token id, and best known price.
3. Add-to-cart CTA must map to cheapest active listing for token.
4. CTA states must indicate success/failure clearly.

Acceptance criteria:
1. Pagination never duplicates previously loaded tokens.
2. Add-to-cart success is immediately visible near user action.
3. Add-to-cart failure is immediately visible with reason and next step.

Tests required:
1. Unit: cheapest listing resolver and token dedupe.
2. Integration: density switch, cursor pagination, add-to-cart behavior.
3. E2E: add from collection grid and verify cart row.

## FR-05 Market Activity Discoverability

Requirements:
1. Orders/listings tab must show meaningful row summaries:
   - token id
   - price
   - owner/maker
   - status/time where available
2. Rows should support direct action:
   - jump to token detail
   - add listing to cart where applicable
3. Filters must include status/category/token id and ownership verification toggle.

Acceptance criteria:
1. Users can navigate from activity row to token detail in one click.
2. Empty and error states are explicit for each panel independently.
3. Filters update results without affecting unrelated tabs.

Tests required:
1. Integration: orders and listings filter behavior isolation.
2. E2E: collection activity filtering and row navigation.

## FR-06 Token Detail Evaluation and Purchase Readiness

Requirements:
1. Token detail page must prioritize:
   - media
   - collection context
   - attributes
   - best listing and listing table
2. Listing rows must clearly mark best price and expiration.
3. Add-to-cart must be available for cheapest and per-row listings.
4. Token-level fee and royalty estimate card must be shown.

Acceptance criteria:
1. Deep links load deterministically for decimal/hex token ids.
2. Expired listings are not purchasable.
3. Fee/royalty values are visible before user adds to cart.

Tests required:
1. Unit: token id normalization and listing expiration handling.
2. Integration: best-price selection and per-row add behavior.
3. E2E: open token detail, add listing, inspect fee/royalty card.

## FR-07 Cart State Model and Feedback

Requirements:
1. Cart row identity is `orderId`.
2. Cart enforces one-currency constraint and max 25 items.
3. Add errors (mixed currency, max reached) must surface immediately in context.
4. Cart should open only when that improves flow, not hide critical errors.

Acceptance criteria:
1. Duplicate add by same `orderId` is deduped.
2. Mixed-currency rejection includes explicit reason and remediation.
3. Max-cap rejection includes current count and cap.

Tests required:
1. Unit: store constraints and candidate intake ordering.
2. Integration: add flow feedback from home/grid/detail.
3. E2E: mixed-currency and max-cap rejection visibility.

## FR-08 Atomic Checkout and Validation

Requirements:
1. Checkout pre-validates each selected listing against latest market state.
2. Any stale/changed listing blocks checkout completely.
3. Validation failures render inline per row with actionable messaging.
4. Valid checkout submits one transaction only.

Acceptance criteria:
1. No partial execution when one row is stale.
2. Success state exposes a single transaction hash.
3. Retrying after removing invalid rows can proceed successfully.

Tests required:
1. Unit: listing/cart row match validator.
2. Integration: stale validation and inline error rendering.
3. E2E: stale scenario -> recover -> successful checkout.

## FR-09 Fee and Royalty Transparency

Requirements:
1. Checkout summary must include:
   - subtotal
   - marketplace fee
   - royalty estimate (if available)
   - total
2. Totals update reactively as cart changes.
3. Fee sources must come from SDK queries, not hardcoded zero.

Acceptance criteria:
1. Non-zero fee contexts display non-zero fee rows correctly.
2. Fee row units and precision match token currency conventions.
3. Total equals deterministic sum of row components.

Tests required:
1. Unit: fee math helpers with bigint-safe arithmetic.
2. Integration: dynamic total updates on add/remove.
3. E2E: compare row values and computed total in cart.

## FR-10 Portfolio Discoverability

Requirements:
1. Add `/portfolio` route with wallet address input.
2. Portfolio page should support querying arbitrary addresses.
3. Include filters for collection/token where dataset allows.
4. Keep existing `/profile/[address]` deep links working.

Acceptance criteria:
1. User can inspect a wallet without connecting that wallet.
2. Portfolio list links to token detail routes.
3. Empty/error states are explicit and non-blocking.

Tests required:
1. Unit: portfolio payload normalization and filtering.
2. Integration: address input triggers query and renders results.
3. E2E: paste address -> open owned token detail.

## FR-11 Trust, Provenance, and Metadata Quality

Requirements:
1. Collection-level trust markers:
   - verified status (if available from config/source)
   - provenance hints
2. Token/share metadata should be richer:
   - dynamic OG image title/image where possible
3. Placeholder social links in header must be replaced with real URLs or removed.

Acceptance criteria:
1. Trust indicators are visible without cluttering primary actions.
2. Shared token/collection links produce meaningful previews.
3. No dead placeholder links in production header.

Tests required:
1. Integration: trust indicator rendering fallback logic.
2. E2E: metadata route smoke for token and collection pages.

## FR-12 Reliability and Error Recovery

Requirements:
1. Every data block must have loading/empty/error/success handling.
2. Errors should include scoped retry controls when safe.
3. One panel failure must not crash sibling panels.

Acceptance criteria:
1. Simulated failure in listings does not break token metadata pane.
2. Retry path restores successful state without losing user-selected state.

Tests required:
1. Integration: panel isolation and retry state preservation.
2. E2E: injected network error and recovery on core routes.

## FR-13 Accessibility and Responsive UX

Requirements:
1. Full keyboard navigation for all interactive surfaces.
2. Visible focus states and semantic landmarks.
3. Mobile-first usability:
   - filter discoverability on narrow screens
   - cart readability on small viewports

Acceptance criteria:
1. No keyboard traps in dialogs/sheets/tabs.
2. Focus order is logical for primary flows.
3. Mobile add-to-cart and checkout remain usable without horizontal overflow issues.

Tests required:
1. Integration: keyboard interaction tests for dialogs and tabs.
2. E2E: mobile viewport funnel checks.

## 10. Non-Functional Requirements

1. Performance:
   - Core route interactive under 3s p75 on target network.
   - Avoid unnecessary refetch loops and duplicate queries.
2. Scalability:
   - Cursor pagination for large collections.
   - Defensive parsing for inconsistent metadata.
3. Security:
   - No unsafe transaction assumptions.
   - Preserve strict stale-listing blocking semantics.
4. Maintainability:
   - Business logic in `src/lib` and feature modules.
   - Keep route files minimal.

## 11. TDD Governance

## 11.1 Core Rules
1. No production behavior without a failing test first.
2. Every PR includes RED -> GREEN -> REFACTOR evidence.
3. One behavior per test.
4. Prefer integration boundaries over deep mocking.
5. Bug fixes begin with regression tests.

## 11.2 Test Layers
1. Unit (fast, deterministic):
   - parsers, normalizers, fee math, filtering helpers.
2. Integration (component + hooks with MSW):
   - route-level behavior and state transitions.
3. E2E (Playwright):
   - critical funnel and cross-route interactions.

## 11.3 Required CI Gates
1. `npm run lint`
2. `npm run typecheck`
3. `npm test`
4. `npm run build`
5. `npm run test:e2e`

## 12. Test Plan and Coverage Matrix

| Area | Unit | Integration | E2E |
| --- | --- | --- | --- |
| Home search/sort | query normalization | result rendering + empty state | land -> search -> detail |
| Collection filters | URL parse/serialize | sidebar + grid sync | apply filters + refresh |
| Token detail | token id normalization | listings state + add CTA | detail -> add -> cart |
| Cart constraints | store rules | feedback rendering | mixed currency / max cap |
| Checkout | listing match logic | stale block + inline rows | stale -> recover -> success |
| Fee math | bigint fee/total helpers | cart summary updates | total correctness smoke |
| Portfolio | payload normalization | address query flow | portfolio -> token link |
| Accessibility | utility/logic tests | keyboard operations | desktop + mobile smoke |

## 13. Epics and Scoped Roadmap

## Phase 0: Baseline Hardening (1 sprint)

Scope:
1. Lock current behavior with missing regression tests for cart, detail, and route state.
2. Add e2e skeleton for full purchase funnel.
3. Remove dead links/placeholders that reduce trust.

Exit criteria:
1. Existing behavior fully covered by tests before net-new features.
2. No critical open regression bugs.

## Phase 1: Discovery Foundations (1-2 sprints)

Scope:
1. Home global search and collection-level sort.
2. Canonical URL state for search/sort/filter/cursor.
3. Improve market activity row usefulness and navigation.

Exit criteria:
1. Users can discover target token in <= 3 interactions (median benchmark).
2. URL copy/paste fully restores discovery state.

## Phase 2: Purchase Clarity and Conversion (1-2 sprints)

Scope:
1. Implement fee-inclusive totals and royalty estimate visibility.
2. Improve add-to-cart and checkout failure messaging.
3. Harden stale-listing recovery path UX.

Exit criteria:
1. Cart totals include real fee components from SDK.
2. Checkout failure reasons are explicit and actionable at row level.

## Phase 3: Portfolio and Trust Surface (1 sprint)

Scope:
1. Add `/portfolio` with address input and filters.
2. Add collection trust/provenance markers.
3. Improve SEO/social share metadata and OG quality.

Exit criteria:
1. Unconnected users can inspect any wallet address.
2. Collection/token share links produce useful previews.

## Phase 4: Funnel QA and Optimization (1 sprint)

Scope:
1. Expand e2e coverage for full conversion funnel.
2. Add event instrumentation and funnel dashboards.
3. Address final performance and accessibility regressions.

Exit criteria:
1. Critical funnel e2e suite stable in CI.
2. Accessibility target achieved on primary routes.

## 14. Priority Backlog

## P0 (must-have)
1. Fee-inclusive cart totals from SDK.
2. Immediate add-to-cart rejection feedback.
3. URL-canonical discovery state.
4. Full stale-listing recovery UX and tests.
5. Core funnel e2e coverage.

## P1 (high-value)
1. Home global search/sort.
2. Actionable market activity rows.
3. `/portfolio` route with address input.
4. Trust/provenance indicators.

## P2 (nice-to-have)
1. Enhanced social card visuals.
2. Advanced portfolio filters and saved views.
3. Discovery personalization experiments.

## 15. Analytics and Event Instrumentation

Required events:
1. `home_search_submitted`
2. `collection_filter_changed`
3. `token_detail_viewed`
4. `add_to_cart_attempted`
5. `add_to_cart_failed`
6. `checkout_started`
7. `checkout_blocked_stale`
8. `checkout_submitted`
9. `checkout_succeeded`
10. `checkout_failed`

Required properties:
1. `collection`
2. `tokenId`
3. `orderId`
4. `currency`
5. `price`
6. `cartSize`
7. `errorCode`
8. `route`

## 16. Risks and Mitigations

1. SDK payload inconsistencies:
   - Mitigation: strict normalizers, resilient fallback parsing, regression tests.
2. Large collection performance:
   - Mitigation: cursor pagination, lazy loading, lightweight cards.
3. Transaction failure ambiguity:
   - Mitigation: explicit error mapping and per-row diagnostics.
4. State explosion across route params:
   - Mitigation: centralized URL state helpers and property-based parser tests.

## 17. Definition of Done for Each PR

1. Behavior specified by failing tests first.
2. Implementation merged only after all quality gates pass.
3. Accessibility impact considered and tested.
4. No unrelated file modifications.
5. PR includes:
   - change rationale
   - risk assessment
   - test evidence
   - screenshots for UI changes

## 18. Appendix: Route and Feature Ownership

1. Home discovery:
   - `src/components/marketplace/marketplace-home.tsx`
   - `src/components/marketplace/collection-row.tsx`
2. Collection experience:
   - `src/features/collections/*`
3. Token detail and purchase prep:
   - `src/features/token/token-detail-view.tsx`
4. Cart and checkout:
   - `src/features/cart/*`
5. Portfolio:
   - `src/features/profile/*` (existing), plus new `src/features/portfolio/*`
6. Ops:
   - `src/features/ops/*`

