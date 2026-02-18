# Biblio Marketplace TDD PRD

Version: 1.1  
Date: February 18, 2026  
Target SDK: `@cartridge/arcade@0.3.12` (`@cartridge/arcade/marketplace`, `@cartridge/arcade/marketplace/react`)

## 1. Product Intent

Build a production-grade marketplace web app for multiple collections with:
- Clean, minimal UX using only `shadcn/ui` + Tailwind theme tokens
- Full feature coverage of the Marketplace SDK surface
- Strict test-driven development (TDD) from first feature to release

## 2. Goals

1. Deliver full SDK feature parity in user-facing workflows.
2. Make browsing, filtering, and evaluating tokens fast and low-friction.
3. Enforce quality gates where no production feature lands without a failing test first.
4. Keep architecture simple enough for quick iteration across collections and projects.

## 3. Non-Goals

1. Custom design system outside shadcn primitives.
2. Trading protocol changes outside SDK capabilities.
3. Server-side indexing pipeline (app will consume SDK data plane only).

## 4. Users and Core Jobs

1. Collector: browse collections, filter traits, inspect listing details, estimate fees.
2. Trader: compare active listings, check token-level orders, estimate royalties before action.
3. Portfolio owner: view token balances across addresses and contracts.
4. Operator/admin: verify marketplace client health, project config, and runtime errors quickly.

## 5. UX Principles (Clean and Minimal)

1. Information hierarchy first: collection context, filters, token grid, detail panel.
2. Fewer clicks: common actions available in one view (filter, sort, detail preview).
3. State clarity: every async block shows loading, empty, error, success explicitly.
4. URL as state: selected collection, filters, search, and cursor are shareable links.
5. Accessibility baseline:
   - Keyboard navigable controls
   - Semantic headings/landmarks
   - Visible focus states
   - Color contrast meeting WCAG AA
6. Performance-first interactions:
   - Skeletons over blocking spinners
   - Debounced search/filter updates
   - Cursor pagination and incremental rendering

## 6. Information Architecture and Routes

1. `/`
   - Overview dashboard
   - Collection switcher
   - Featured tokens/listings snapshot
2. `/collections/[address]`
   - Collection summary
   - Trait filter panel
   - Token grid with cursor pagination
   - Listing and order tabs
3. `/collections/[address]/tokens/[tokenId]`
   - Token metadata and media
   - Orders/listings history
   - Fee and royalty estimate card
4. Global cart sidebar
   - Header trigger in top-right
   - Listing-based cart rows keyed by `orderId`
   - Inline per-item validation error rows
   - One-click buy-all submit
5. `/portfolio`
   - Address input
   - Token balances with filters (contracts, token ids, project)
6. `/ops`
   - Client status (`idle/loading/ready/error`)
   - Config diagnostics and refresh controls

## 7. Functional Requirements

## FR-01 Client lifecycle and configuration

1. App initializes marketplace client via provider config (`chainId`, `defaultProject`, optional provider and resolvers).
2. UI exposes client status and recoverability (`refresh` action).
3. Invalid env configuration produces visible warnings and safe fallbacks.

Acceptance criteria:
1. If config is valid, client reaches `ready` and data queries can run.
2. If config fails, app shows non-blocking error UI with retry.

## FR-02 Collection summary and navigation

1. Load collection by address and optional project.
2. Show metadata, supply, contract type, and image fallback behavior.
3. Allow collection switching without full page reload.

Acceptance criteria:
1. Switching collection updates URL and resets token cursor.
2. Missing collection response renders empty-state card, not crash.

## FR-03 Token discovery

1. Query collection tokens with cursor, limit, tokenIds, and attributeFilters.
2. Support optional image resolution strategy (`fetchImages` + custom resolver).
3. Support local filter fallback with metadata utility functions when needed.

Acceptance criteria:
1. Cursor "next page" loads additional tokens correctly.
2. Local metadata filter output matches expected active filter semantics.

## FR-04 Orders and listings

1. Query collection orders with category/status/token constraints.
2. Query collection listings with optional ownership verification.
3. Expose listing count and order facets in UI.

Acceptance criteria:
1. Status/category filter changes update results and counts.
2. Empty listing state is explicit and actionable.

## FR-05 Trait intelligence and filter UX

1. Fetch trait names summary and trait values by selected filters.
2. Fetch expanded traits for bulk filter sidebars.
3. Aggregate metadata pages and derive available filter tree.
4. Build precomputed filter data for fast rendering and sorting.

Acceptance criteria:
1. Filter counts update when active filters change.
2. Invalid/missing trait values do not break filter panel.

## FR-06 Token detail experience

1. Query token detail by collection + token id.
2. Show token metadata, media, and linked orders/listings.
3. Handle token not found with specific empty state.

Acceptance criteria:
1. Deep link to token detail loads correct token and associated market data.
2. Token view remains interactive during background refresh.

## FR-07 Portfolio balances

1. Query balances by account addresses, contracts, and token ids.
2. Support cursor pagination for large result sets.
3. Support project/defaultProject behaviors consistently.

Acceptance criteria:
1. Multi-address query merges and displays deterministic results.
2. Cursor paging is stable and does not duplicate rows.

## FR-08 Fees and royalty estimate

1. Query marketplace fees.
2. Query royalty fee by collection/token/amount.
3. Display effective fee math clearly.

Acceptance criteria:
1. Fee values show numerator/denominator and receiver.
2. Royalty estimate handles zero and large amount values safely.

## FR-09 Error handling, retries, and resilience

1. Every data block has dedicated error rendering and retry.
2. Failures in one panel do not take down unrelated panels.
3. Retry does not lose user-selected filters/search state.

Acceptance criteria:
1. Simulated network failure recovers through retry action.
2. Error boundary and toasts show meaningful diagnostics.

## FR-10 UX polish and accessibility

1. Responsive layout at mobile, tablet, desktop.
2. Keyboard operations for all controls and dialogs.
3. Clear visual hierarchy and spacing system from theme tokens.

Acceptance criteria:
1. All interactive controls are reachable by keyboard.
2. Lighthouse accessibility score >= 95 on primary routes.

## FR-11 Cart state and selection model

1. Cart entries represent concrete listings and must include `orderId`, `collection`, `tokenId`, `price`, and `currency`.
2. Cart add behavior from collection and home surfaces resolves to the cheapest active listing for a token.
3. Token detail route exposes `Add to cart` as the buy action for this phase.
4. Cart supports one currency only and blocks mixed-currency additions.
5. Cart size is capped at 25 items.
6. Cart persists locally using Zustand persistence.

Acceptance criteria:
1. Duplicate `orderId` adds are deduplicated.
2. Attempting to exceed 25 items is rejected with visible feedback.
3. Mixed-currency adds are rejected with visible feedback.
4. Cart state restores after reload from local persistence.

## FR-12 Atomic cart checkout and validation

1. Checkout pre-validates each selected listing before transaction submission.
2. If any listing is stale, changed, or invalid, checkout is strictly blocked.
3. Checkout submits a single transaction for all valid selected listings.
4. Cart totals include marketplace fee values in checkout summary.
5. Validation failures are rendered per item as inline error rows.

Acceptance criteria:
1. Any stale listing prevents submission and highlights each failing row.
2. Successful submission path emits one transaction hash for the entire cart.
3. Fee-inclusive total updates as cart composition changes.

## FR-13 Sweeper-ready candidate intake

1. Sweeper candidate generation path can auto-add listings to cart.
2. Auto-add strategy prioritizes lowest-value listings.
3. Candidate intake respects currency and max-size constraints.

Acceptance criteria:
1. Candidate intake fills cart in ascending price order.
2. Intake stops at 25 items or first disallowed currency.

## 8. SDK Coverage Matrix (Must Implement)

| Capability | SDK API | Product Surface | Required |
| --- | --- | --- | --- |
| Client creation | `createMarketplaceClient` | App bootstrap, ops diagnostics | Yes |
| React provider | `MarketplaceClientProvider` | Global data context | Yes |
| Client state | `useMarketplaceClient` | Status badges, refresh action | Yes |
| Collection summary | `useMarketplaceCollection` + `getCollection` | Collection header and metadata | Yes |
| Collection tokens | `useMarketplaceCollectionTokens` + `listCollectionTokens` + `fetchCollectionTokens` | Token grid, cursor pagination | Yes |
| Collection orders | `useMarketplaceCollectionOrders` + `getCollectionOrders` | Orders tab, filters | Yes |
| Collection listings | `useMarketplaceCollectionListings` + `listCollectionListings` | Listings tab, count cards | Yes |
| Token detail | `useMarketplaceToken` + `getToken` | Token detail route | Yes |
| Buy execution | `ArcadeProvider.marketplace.execute` + `buildExecuteCalldata` | Cart buy-all single transaction | Yes |
| Token balances | `useMarketplaceTokenBalances` + `fetchTokenBalances` | Portfolio route | Yes |
| Marketplace fees | `useMarketplaceFees` + `getFees` | Fees panel | Yes |
| Royalty estimate | `useMarketplaceRoyaltyFee` + `getRoyaltyFee` | Token pricing card | Yes |
| Trait names summary | `fetchTraitNamesSummary` + `aggregateTraitNamesSummary` | Filter sidebar sections | Yes |
| Trait values | `fetchTraitValues` + `aggregateTraitValues` | Filter options and counts | Yes |
| Expanded trait metadata | `fetchExpandedTraitsMetadata` | Bulk trait fetch | Yes |
| Trait metadata pages | `fetchCollectionTraitMetadata` + `aggregateTraitMetadata` | Preload full trait index | Yes |
| Filter state flattening | `flattenActiveFilters` | URL/query serialization | Yes |
| Filter availability | `buildAvailableFilters` | Dynamic valid options | Yes |
| Filter precompute | `buildPrecomputedFilters` | Sorted facet rendering | Yes |
| Token filter matcher | `tokenMatchesFilters` + `filterTokensByMetadata` | Client fallback filtering | Yes |
| Image resolver support | `resolveTokenImage` + `resolveContractImage` config hooks | Media fallback strategy | Yes |

## 9. Technical Architecture

1. Next.js App Router (RSC default, client islands for interactive marketplace modules).
2. SDK access through a dedicated service layer:
   - `src/lib/marketplace/client.ts`
   - `src/lib/marketplace/queries.ts`
   - `src/lib/marketplace/traits.ts`
3. UI feature modules:
   - `src/features/collections/*`
   - `src/features/tokens/*`
   - `src/features/cart/*`
   - `src/features/portfolio/*`
   - `src/features/ops/*`
4. Shared UI primitives only from `src/components/ui/*`.
5. URL state helpers for filters/cursor/search.
6. Zustand persisted store for cart state and checkout lifecycle.

## 10. TDD Governance Rules

1. No production code before a failing test exists for the behavior.
2. Every PR includes evidence:
   - Failing test output (RED)
   - Passing test output (GREEN)
   - Any refactor notes (REFACTOR)
3. One behavior per test.
4. Mocks only when unavoidable; prefer real integration boundaries via MSW.
5. Bug fixes must begin with a regression test reproducing the bug.

## 11. Test Stack

1. Unit and integration:
   - Vitest
   - React Testing Library
   - MSW (network contract simulation)
2. End-to-end:
   - Playwright
3. Static gates:
   - ESLint
   - TypeScript (`tsc --noEmit`)
   - Next build

## 12. TDD Backlog by Epic (Red -> Green -> Refactor)

## Epic A: Client bootstrap and config safety

Tests first:
1. `config.parses_valid_chain_alias_and_default_project`
2. `config_falls_back_on_invalid_chain_with_warning`
3. `provider_reports_ready_state_after_init`
4. `provider_refresh_recovers_from_init_failure`

Implementation after red:
1. Add runtime schema validation and typed warning channel.
2. Add `/ops` state panel with refresh button.

Refactor:
1. Extract config parser and error formatter utilities.

## Epic B: Collection discovery

Tests first:
1. `collection_route_loads_summary_for_address`
2. `collection_switch_updates_url_and_resets_cursor`
3. `collection_empty_state_shows_when_not_found`

Implementation after red:
1. Route-level loader and stateful collection switcher.
2. Empty and error state components.

Refactor:
1. Move route/query param parsing into shared helper.

## Epic C: Token grid and pagination

Tests first:
1. `token_grid_renders_first_page_with_skeleton_then_data`
2. `token_grid_loads_next_cursor_page_without_duplicates`
3. `token_grid_respects_limit_and_tokenIds_filters`
4. `token_grid_uses_image_fallback_when_missing`

Implementation after red:
1. Cursor pagination controls.
2. Deterministic token keying and dedupe.
3. Image resolver fallback pipeline.

Refactor:
1. Isolate token card presenter and token adapter.

## Epic D: Orders and listings

Tests first:
1. `orders_tab_filters_by_status_and_category`
2. `listings_tab_filters_by_token_and_project`
3. `listings_verify_ownership_flag_changes_query_behavior`
4. `orders_and_listings_errors_are_isolated_per_panel`

Implementation after red:
1. Tabbed results view with filter controls.
2. Shared query state with independent retry actions.

Refactor:
1. Extract order/listing table components and query hooks wrapper.

## Epic E: Trait filters and metadata

Tests first:
1. `trait_summary_aggregates_names_across_projects`
2. `trait_values_respect_other_active_filters`
3. `available_filters_exclude_invalid_combinations`
4. `precomputed_filters_sort_and_count_are_stable`
5. `flatten_active_filters_round_trips_with_url_params`
6. `token_matches_filters_and_batch_filter_are_consistent`

Implementation after red:
1. Trait sidebar with dynamic facet counts.
2. Filter chips and clear-all workflow.

Refactor:
1. Consolidate trait state reducer and serialization logic.

## Epic F: Token detail, fees, and royalties

Tests first:
1. `token_detail_route_loads_token_and_related_orders`
2. `fees_panel_shows_marketplace_fee_components`
3. `royalty_estimate_updates_when_amount_changes`
4. `royalty_estimate_handles_zero_and_large_amounts`

Implementation after red:
1. Token detail page and market activity cards.
2. Fee/royalty calculator module.

Refactor:
1. Monetary formatting utilities with bigint-safe adapters.

## Epic G: Portfolio balances

Tests first:
1. `portfolio_queries_by_single_address`
2. `portfolio_queries_by_multiple_addresses_and_contracts`
3. `portfolio_cursor_pagination_is_stable`
4. `portfolio_empty_state_for_no_balances`

Implementation after red:
1. Portfolio route and query form.
2. Balance results table with paging controls.

Refactor:
1. Normalize token balance view model adapter.

## Epic H: UX quality and accessibility hardening

Tests first:
1. `all_primary_controls_are_keyboard_reachable`
2. `focus_order_is_logical_in_filter_drawer`
3. `mobile_layout_preserves_primary_actions`
4. `route_state_persists_after_refresh`

Implementation after red:
1. Keyboard shortcuts and focus management.
2. Responsive polish and final visual cleanup.

Refactor:
1. Remove duplicated state patterns and dead code.

## Epic I: Cart store and sidebar UX

Tests first:
1. `cart_store_dedupes_by_order_id`
2. `cart_store_rejects_mixed_currency`
3. `cart_store_enforces_max_25_items`
4. `cart_store_persists_and_rehydrates`
5. `header_cart_trigger_opens_top_right_sidebar`
6. `cart_sidebar_renders_inline_item_errors`

Implementation after red:
1. Introduce persisted Zustand cart store with selectors.
2. Add top-right header cart trigger and sidebar.
3. Render listing rows keyed by `orderId`.

Refactor:
1. Extract cart selectors and invariant guard helpers.

## Epic J: Cheapest-listing add flows and detail buy UX

Tests first:
1. `collection_and_home_add_to_cart_resolves_cheapest_listing`
2. `token_detail_exposes_add_to_cart_only`
3. `add_to_cart_blocks_mixed_currency_and_surfaces_row_error`
4. `add_to_cart_blocks_when_cart_at_capacity`

Implementation after red:
1. Wire add-to-cart controls in collection/home/token detail surfaces.
2. Resolve cheapest listing using listing query results.
3. Surface add failure reasons inline in cart rows.

Refactor:
1. Consolidate listing-to-cart adapter utilities.

## Epic K: Atomic checkout, strict blocking, and fee total

Tests first:
1. `checkout_blocks_when_any_listing_is_stale`
2. `checkout_renders_per_item_inline_validation_errors`
3. `checkout_submits_single_transaction_for_all_items`
4. `checkout_total_includes_marketplace_fee`
5. `successful_checkout_clears_purchased_rows`

Implementation after red:
1. Build preflight validation pass across cart items.
2. Build execute multicall payload from validated listings.
3. Submit one transaction and update cart state on success.
4. Render fee-inclusive summary block in sidebar.

Refactor:
1. Extract checkout orchestrator from sidebar UI component.

## Epic L: Sweeper candidate auto-add foundation

Tests first:
1. `sweeper_candidate_intake_adds_lowest_price_first`
2. `sweeper_candidate_intake_stops_at_25_items`
3. `sweeper_candidate_intake_respects_single_currency_rule`

Implementation after red:
1. Add candidate intake API on cart store.
2. Sort candidate listings by price ascending before insertion.
3. Reuse cart invariant guards for intake behavior.

Refactor:
1. Share candidate normalization across sweeper and manual add flows.

## 13. Definition of Done

1. Every SDK capability in Section 8 has:
   - A user-facing implementation
   - At least one automated test case
2. No feature merged without red-green evidence in PR.
3. CI passes:
   - unit/integration tests
   - e2e smoke tests
   - lint + typecheck + build
4. Accessibility and performance gates:
   - Lighthouse accessibility >= 95 on `/`, `/collections/[address]`, `/collections/[address]/tokens/[tokenId]`
   - Lighthouse performance >= 85 on same routes
5. Documentation updated:
   - This PRD
   - Route-level feature docs
   - Env and runbook updates
6. Cart constraints hold under tests:
   - listing-based `orderId` identity
   - one currency only
   - max 25 items
   - strict stale-block checkout
   - single transaction submit

## 14. Delivery Plan

1. Milestone M1: Epics A-B-C (foundation browsing)
2. Milestone M2: Epics D-E (market and trait intelligence)
3. Milestone M3: Epics F-G (detail economics and portfolio)
4. Milestone M4: Epic H (UX hardening)
5. Milestone M5: Epics I-J (cart foundation and add flows)
6. Milestone M6: Epics K-L (atomic checkout and sweeper intake)

## 15. Risks and Mitigations

1. SDK response variance across projects
   - Mitigation: strict adapter tests with fixture matrix.
2. Metadata quality inconsistency
   - Mitigation: defensive parsing and image/name fallback tests.
3. Query latency for large collections
   - Mitigation: cursor pagination, incremental rendering, and precomputed filter slices.
4. Runtime incompatibilities
   - Mitigation: lock Node and dependency versions in CI, add startup diagnostics in `/ops`.
5. Cart transaction failure and stale listings
   - Mitigation: strict preflight validation, inline row-level errors, and one-transaction submission path.
6. Currency mismatches in mixed listing sets
   - Mitigation: invariant guard in store to block mixed-currency cart composition.

## 16. Immediate Next Step

Implement Milestone M5 strictly by TDD:
1. Add failing tests for Epic I cart invariants and sidebar UX.
2. Build minimal Zustand persisted store and header/sidebar integration.
3. Continue with Epic J cheapest-listing add flows.
