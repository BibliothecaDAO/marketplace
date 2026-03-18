# Collection Filter Performance TDD PRD

Version: 1.0  
Date: March 18, 2026  
Status: Draft for execution  
Primary focus: Fast first filter paint, responsive trait interactions, preserved URL-canonical discovery state

## 1. Product Intent

Improve perceived and measured performance on `/collections/[address]` so trait filters feel immediate on initial load and during interaction, without weakening current marketplace behavior:

1. Preserve multi-collection routing and URL-canonical filter state.
2. Preserve lazy trait-value loading and active-filter-aware counts.
3. Reduce time until users can see and use the filter sidebar.
4. Avoid loading unrelated collection-grid work on the critical path for filter paint.

## 2. Problem Statement

The collection page currently feels slow because the trait sidebar is blocked on client-side boot and separate network requests, while the route also performs additional token-grid work that competes for bandwidth and render time.

Observed causes from code inspection:

1. Filter metadata is client-fetched after hydration.
   - `src/app/collections/[address]/page.tsx` only resolves the address and renders a client container.
   - `src/features/collections/collection-route-view.tsx` starts `useTraitNamesSummaryQuery` on the client.
2. Trait values require a second request when a user opens a trait group.
   - `useTraitValuesQuery` is keyed by `traitName` and other active filters, so open groups refetch as filters change.
3. The grid performs additional sequential work unrelated to first filter paint.
   - `collection-token-grid` fetches listings, derives token ids, then fetches those tokens in a second query.
4. Each filter toggle performs route-state churn.
   - `router.push` happens for every change, resetting grid state and query keys.

The slow experience is primarily a query and rendering-path problem, not a trait-option computation problem.

## 3. Goals and Success Metrics

## 3.1 Product Goals

1. Make the filter sidebar visibly useful on first paint.
2. Keep trait interactions responsive under active filtering.
3. Preserve exact filter URL behavior across refresh and share-link flows.
4. Reduce the amount of unrelated work on the route’s critical path.

## 3.2 Performance KPIs

1. First filter paint:
   - Definition: time from navigation start to first rendered trait list with real trait names.
   - Target: p50 <= 1.2s on local benchmark fixtures, p95 <= 2.0s.
2. Trait open latency:
   - Definition: time from expanding a trait group to visible values or loading skeleton.
   - Target: feedback <= 150ms, resolved values p50 <= 800ms.
3. Filter apply responsiveness:
   - Definition: time from selecting a trait value to visible pending UI and updated URL.
   - Target: pending UI <= 100ms, URL sync <= 250ms.
4. Main-thread stability:
   - Definition: no long task > 200ms caused by sort/filter render work on benchmark collections during first interaction.
   - Target: zero benchmark runs with route-blocking long task above threshold.

## 3.3 Guardrails

1. No regression to URL-canonical `trait` and `sort` state.
2. No regression to active-filter-aware trait counts.
3. No regression to cart/add-to-cart behavior from collection grid.
4. No release with failing unit, integration, e2e, typecheck, or lint checks.

## 4. Current Baseline

Current route behavior:

1. The route shell is server-rendered but does not prefetch filter data.
2. Trait names are fetched via `useTraitNamesSummaryQuery` on the client.
3. Trait values are fetched lazily for the currently open trait only.
4. The route mounts token, listing, and trait queries together in the same client tree.
5. Grid enrichment performs a listings -> token ids -> tokens waterfall.
6. Filter changes push new search params immediately for every interaction.

Known positive behavior to retain:

1. Trait value requests are lazy rather than eager N+1 on initial render.
2. Query client already applies a 60 second stale time and disables refetch-on-focus.
3. Trait parsing and precomputed filter generation are deterministic and already tested.

## 5. Scope

## 5.1 In Scope

1. `/collections/[address]` route performance for filter sidebar loading and interaction.
2. Server/client data-fetching boundary for trait summaries.
3. Cache strategy for collection trait summaries.
4. Query isolation so filter paint is not blocked by grid enrichment work.
5. URL update ergonomics for rapid filter interactions.
6. Benchmarking and instrumentation for first filter paint and interaction latency.

## 5.2 Out of Scope

1. New discovery features unrelated to performance.
2. Redesign of collection filter UX or visual language.
3. New backend indexing systems.
4. Changes to cart, checkout, or token detail behavior except where required to prevent regression.

## 6. Users and Core Jobs

1. Collector:
   - Open a collection and immediately understand the available trait filters.
   - Narrow token results without waiting through heavy page recomputation.
2. Trader:
   - Change filters rapidly while comparing listed inventory.
3. Operator:
   - Measure whether collection performance improved and remained stable across releases.

## 7. Root Cause Summary

## 7.1 Primary Cause: Client-only Filter Metadata Fetch

Trait names are not prefetched on the server. The first meaningful sidebar render waits on:

1. client hydration
2. query startup
3. Arcade import/query execution
4. network response

This produces a slow empty sidebar even when the route shell is already visible.

## 7.2 Secondary Cause: Unrelated Waterfall on the Same Route

The collection grid starts work that is not required to make filters usable:

1. listings fetch
2. derive listed token ids
3. token fetch for those ids

This increases contention and can delay interactive work on large collections.

## 7.3 Tertiary Cause: High Churn During Filter Changes

Each toggle updates URL state immediately, which causes:

1. route-state churn
2. query-key churn
3. grid reset work
4. refetch of open trait values when other active filters change

## 8. Proposed Solution

## 8.1 Primary Architecture Change

Move trait summary loading to the server route boundary and hydrate the result into the client tree before the sidebar mounts.

Implementation direction:

1. In `src/app/collections/[address]/page.tsx`, prefetch collection essentials and trait summary in parallel.
2. Hydrate the query cache or pass typed server-fetched data into the collection route view.
3. Render the filter sidebar from prefetched summary data on first paint.
4. Keep trait-value requests lazy per open trait group.

## 8.2 Critical Path Isolation

Decouple filter paint from grid enrichment work.

Implementation direction:

1. Split the filter sidebar and token grid into separate suspense or loading boundaries.
2. Defer listed-token enrichment until after first grid paint or only when required by the current tab/sort.
3. Ensure the sidebar does not wait for listings-derived token work.

## 8.3 Interaction Smoothing

Reduce churn from per-click routing work.

Implementation direction:

1. Wrap URL updates in transitions.
2. Prefer `router.replace` for rapid in-page filter changes unless history behavior explicitly requires `push`.
3. Batch related filter changes where feasible.
4. Preserve optimistic local state so checkboxes/pills respond immediately.

## 8.4 Cache Strategy

Trait summaries should be cached by collection address and project id because they are reused often and change much less frequently than token-grid state.

Implementation direction:

1. Add server-side request deduplication for trait summary fetches.
2. Add short-lived cache semantics appropriate for collection metadata freshness.
3. Keep client query stale behavior aligned with server caching to avoid thrash.

## 9. Functional Requirements

## FR-PERF-01 First Filter Paint

Requirements:

1. The route must render trait names without waiting for a client-only trait-summary fetch.
2. The sidebar must show a stable loading skeleton only when prefetched data is unavailable.
3. The route must preserve existing empty and error states for missing trait metadata.

Acceptance criteria:

1. Trait names are available on first meaningful render for benchmark collections with valid trait metadata.
2. Refreshing the page does not revert to a long empty “Loading traits...” state when cached summary data is available.
3. Missing trait metadata still shows a non-blocking fallback state.

Tests required:

1. Unit: server prefetch helper builds the expected query payload and cache key.
2. Integration: route renders prefetched trait names without waiting for client query resolution.
3. E2E: hard-refresh collection page and verify trait names appear before token-grid enrichment completes.

## FR-PERF-02 Trait Interaction Responsiveness

Requirements:

1. Expanding a trait group must provide immediate feedback.
2. Selecting a trait value must update local UI immediately and preserve canonical URL state.
3. Open trait groups may refetch counts, but feedback must not block input.

Acceptance criteria:

1. Expanding a trait group shows either values or a loading placeholder within 150ms.
2. Selecting a filter updates the selected state before the grid finishes reloading.
3. URL state remains shareable and equivalent after refresh.

Tests required:

1. Unit: route-state update helper distinguishes replace-vs-push semantics.
2. Integration: toggle trait selection and assert immediate active state plus eventual URL sync.
3. E2E: apply multiple trait filters rapidly and verify no lost selections or stale URL state.

## FR-PERF-03 Critical Path Isolation

Requirements:

1. The filter sidebar must not depend on listings-derived token enrichment.
2. Grid enrichment work must be deferred or isolated from first filter paint.
3. Loading states for sidebar and grid must remain independent.

Acceptance criteria:

1. The sidebar can render usable filter data while the grid is still loading.
2. Listed-token enrichment no longer blocks first filter paint.
3. Error/loading in grid enrichment does not collapse the filter sidebar.

Tests required:

1. Unit: listed-token enrichment selector skips work when not required.
2. Integration: sidebar remains interactive while deferred grid enrichment is pending.
3. E2E: benchmark collection route still exposes filters when listings-derived token work is artificially delayed.

## FR-PERF-04 Observability and Regression Protection

Requirements:

1. The route must record benchmarkable measurements for filter paint and filter apply latency.
2. Performance regressions must be catchable in CI or pre-merge scripts.
3. The benchmark harness output must be deterministic and reviewable.

Acceptance criteria:

1. A repeatable benchmark script reports p50/p95 for first filter paint and filter apply.
2. Regression thresholds are documented and enforced in engineering workflow.
3. Performance evidence can be attached to PRs affecting collection performance.

Tests required:

1. Unit: benchmark report includes new filter-paint and interaction targets.
2. Integration: instrumentation events fire with expected route and collection identifiers.
3. E2E: benchmark scenario can be executed against a local fixture or mocked environment.

## 10. Technical Design Constraints

1. UI must continue using `shadcn/ui` primitives and Tailwind tokens only.
2. Business logic belongs in `src/lib` or `src/features`, not route files beyond route orchestration.
3. Strong typing is required across prefetch, hydration, cache, and benchmark code.
4. Changes must be test-first for behavior and performance-sensitive logic.

## 11. Delivery Plan (TDD)

## Phase 0: Baseline and Measurement

Goal:
Establish a trustworthy performance baseline before behavior changes.

### PERF-001: Benchmark Harness Extension

Outcome:
Capture first filter paint and filter apply metrics in a repeatable schema.

RED tests to write first:

1. unit test for benchmark report schema covering filter-specific targets
2. unit test for percentile handling with partial failures and empty samples

GREEN implementation tasks:

1. extend `src/lib/marketplace/performance-harness.ts` for filter targets
2. add benchmark target names and report formatting for collection filter performance

REFACTOR tasks:

1. extract shared benchmark target factories
2. keep naming stable for future CI reporting

Evidence required in PR:

1. `pnpm test -- performance-harness`
2. sample benchmark report artifact

Estimate: 2

### PERF-002: Route Performance Instrumentation

Outcome:
Track trait-summary ready, first filter paint, and filter-apply milestones.

RED tests to write first:

1. integration test for instrumentation callback/event payload on prefetched render
2. integration test for filter-apply event timing boundaries

GREEN implementation tasks:

1. add lightweight performance markers in collection route feature code
2. expose route and collection metadata in event payloads

REFACTOR tasks:

1. centralize instrumentation constants and payload typing

Evidence required in PR:

1. test output for instrumentation module
2. example captured timings from local run

Estimate: 3

## Phase 1: First Filter Paint

Goal:
Make trait names available at first meaningful render.

### PERF-010: Server Trait Summary Prefetch

Outcome:
Collection route prefetched with trait summary and collection essentials in parallel.

RED tests to write first:

1. unit test for server prefetch helper cache key and argument normalization
2. integration test for hydrated route rendering trait names without client fetch delay
3. integration test for empty/error fallback when prefetch fails

GREEN implementation tasks:

1. add server-side prefetch helper for trait summary
2. fetch collection essentials and trait summary in parallel from the route boundary
3. hydrate or pass prefetched data into the client collection module

REFACTOR tasks:

1. reduce duplication between client query key factories and server prefetch code
2. extract typed route preload module under `src/features/collections` or `src/lib/marketplace`

Evidence required in PR:

1. `pnpm test`
2. screenshot or video of first filter paint before/after

Estimate: 5

### PERF-011: Trait Summary Cache Policy

Outcome:
Repeated collection visits reuse summary data instead of refetching immediately.

RED tests to write first:

1. unit test for cache deduplication per collection address/project id
2. integration test for repeated route render reusing cached summary data

GREEN implementation tasks:

1. introduce request deduplication and short-lived cache semantics
2. align cache freshness with client query configuration

REFACTOR tasks:

1. document cache contract in code and docs

Evidence required in PR:

1. tests demonstrating stable cache reuse
2. benchmark showing improved repeat navigation performance

Estimate: 3

## Phase 2: Critical Path Isolation

Goal:
Keep filters usable even when grid-related work is still loading.

### PERF-020: Separate Sidebar and Grid Loading Boundaries

Outcome:
Sidebar render no longer waits on grid enrichment work.

RED tests to write first:

1. integration test proving sidebar renders while grid remains pending
2. integration test proving grid error/loading does not hide filters

GREEN implementation tasks:

1. split sidebar and grid into isolated loading boundaries
2. keep route-level loading and error messaging explicit per panel

REFACTOR tasks:

1. simplify collection route view composition to avoid cross-coupled loading state

Evidence required in PR:

1. integration test output
2. screenshots of independent loading states

Estimate: 5

### PERF-021: Defer Listed-Token Enrichment

Outcome:
Listings-derived token waterfall removed from the initial filter critical path.

RED tests to write first:

1. unit test for enrichment trigger conditions
2. integration test proving first filter paint does not await listed-token enrichment
3. integration test preserving listed-token behavior when enrichment eventually runs

GREEN implementation tasks:

1. defer or gate listed-token enrichment until needed
2. preserve grid correctness and listed-token display behavior

REFACTOR tasks:

1. extract enrichment decision logic from the grid component

Evidence required in PR:

1. targeted test output
2. benchmark comparison showing reduced initial route latency

Estimate: 5

## Phase 3: Interaction Smoothing

Goal:
Reduce route churn while preserving canonical URL state.

### PERF-030: Transitioned Filter URL Updates

Outcome:
Filter toggles feel immediate and do not block input.

RED tests to write first:

1. integration test for optimistic selection state during pending navigation
2. integration test for canonical URL output after rapid filter changes

GREEN implementation tasks:

1. move filter URL updates into transitions
2. evaluate `replace` for rapid filter changes where history fidelity is not required
3. preserve refresh/share-link semantics

REFACTOR tasks:

1. extract reusable filter navigation helper

Evidence required in PR:

1. `pnpm test`
2. manual verification notes for back/forward behavior

Estimate: 3

### PERF-031: Open Trait Refetch Ergonomics

Outcome:
Open trait group refetches remain accurate without jarring UX.

RED tests to write first:

1. integration test for open trait group staying visually stable while counts refetch
2. integration test for no lost active state during rapid changes

GREEN implementation tasks:

1. improve pending-state presentation for open trait groups
2. avoid unnecessary visual resets while values reload

REFACTOR tasks:

1. isolate trait-panel pending state logic from raw query objects

Evidence required in PR:

1. interaction capture for rapid filter toggling

Estimate: 3

## 12. Test Plan and Coverage Matrix

| Area | Unit | Integration | E2E |
| --- | --- | --- | --- |
| Server prefetch | cache key + payload | hydrated first render | refresh route -> filters visible |
| Trait summary cache | dedupe policy | repeat visit reuse | repeat navigation smoke |
| Sidebar/grid isolation | enrichment gating | independent loading states | delayed grid still shows filters |
| Filter URL updates | canonical params | optimistic UI + URL sync | rapid multi-filter apply |
| Trait refetch ergonomics | pending-state helpers | open group stability | rapid change stability |
| Benchmarking | report schema | instrumentation payloads | benchmark route flow |

## 13. Risks and Mitigations

1. Server-prefetch mismatch with client query keys:
   - Mitigation: share typed key factories and fixture-backed integration tests.
2. Stale trait metadata from aggressive caching:
   - Mitigation: short cache windows and explicit cache invalidation contract.
3. History/back-button behavior regressions from `replace`:
   - Mitigation: preserve documented semantics and add e2e coverage.
4. Hidden dependency between grid enrichment and sidebar state:
   - Mitigation: isolate panel state and add delayed-grid integration tests.

## 14. Rollout and Evidence

Each implementation PR should include:

1. before/after benchmark numbers for first filter paint
2. test evidence with exact commands
3. screenshots or short recordings for initial route load and rapid filter application
4. risk notes covering URL state, sidebar loading, and grid behavior

Recommended quality gates for the implementation PRs:

1. `pnpm test`
2. `pnpm typecheck`
3. `pnpm lint`
4. `pnpm build`
5. `pnpm test:e2e` for any UI behavior change

## 15. Definition of Done

1. Trait names render from prefetched or hydrated data on first meaningful route paint.
2. Sidebar usability is no longer blocked by listings-derived grid enrichment.
3. URL-canonical filter state remains correct across refresh, share, and back/forward flows.
4. Benchmark evidence shows improvement against the baseline targets in this document.
5. All tests required by the relevant phase pass before merge.
