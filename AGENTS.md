# AGENTS.md

```text
    _    ____ _____ _   _ _____ ____
   / \  / ___| ____| \ | |_   _/ ___|
  / _ \| |  _|  _| |  \| | | | \___ \\
 / ___ \ |_| | |___| |\  | | |  ___) |
/_/   \_\____|_____|_| \_| |_| |____/
```

Contributor and coding-agent playbook for `biblio/marketplace`.

## 1) Mission and Constraints

This repo is a production-oriented marketplace frontend for Starknet collections.

Non-negotiable constraints:

- Use only `shadcn/ui` primitives + Tailwind tokens for UI.
- Keep business logic in `src/lib` or `src/features`, not route files.
- Preserve strict typing; avoid `any` unless unavoidable.
- Implement behavior changes with tests first (RED -> GREEN -> REFACTOR).
- Keep changes focused; avoid broad refactors unless requested.

## 2) Read Order (Required)

Before changing code:

1. `AGENTS.md` (this file)
2. `README.md`
3. `docs/SCOPE.md`
4. `docs/TDD-PRD.md`

## 3) Current Stack and Tooling

- Next.js `16.1.6` + React `19`
- TypeScript
- Tailwind CSS v4
- `@cartridge/arcade` SDK + `@starknet-react/*`
- Zustand for persisted cart state
- Vitest + React Testing Library + MSW
- Playwright for e2e and feature screenshots

Package manager notes:

- CI uses `pnpm` (`pnpm-lock.yaml` is canonical).
- Local `npm` scripts also work, but `pnpm` is preferred for parity.

## 4) Repository Map

- `src/app/*`: App Router pages, metadata, API routes
- `src/features/collections/*`: collection UX (grid, filters, market activity)
- `src/features/token/*`: token detail and listing actions
- `src/features/cart/*`: cart store/sidebar/checkout flow
- `src/features/portfolio/*`: wallet lookup flow
- `src/features/profile/*`: wallet profile holdings view
- `src/features/ops/*`: client diagnostics
- `src/components/ui/*`: shadcn primitives only
- `src/components/providers/*`: Starknet/query/marketplace provider setup
- `src/lib/marketplace/*`: config parsing, hooks, fee logic, token display
- `src/test/*`: unit/integration test setup + MSW
- `tests/e2e/*`: Playwright tests
- `scripts/ci/*`: screenshot route detection and CI helper scripts
- `.github/workflows/ci.yml`: CI pipeline

## 5) Product and Domain Invariants (Do Not Break)

### Multi-collection

- Collections come from `NEXT_PUBLIC_MARKETPLACE_COLLECTIONS` in `address|name|projectId` format.
- Route and query logic must handle collection switching without stale state leakage.

### Multi-currency marketplace behavior

- Listings/offers are multi-currency (`STRK`, `LORDS`, `SURVIVO`).
- Currency display is address-based via token symbol/icon resolvers.
- Wallet dropdown displays balances across those currencies.
- Cart checkout calldata uses each listing's currency.
- Cart intentionally enforces one-currency-per-checkout (mixed currency is rejected).

### Checkout and cart safety

- Cart row identity is `orderId`.
- Cart maximum is 25 items.
- Checkout must pre-validate listing freshness and block if any row is stale.
- Checkout executes as one transaction; no partial fallback path.
- Validation failures must remain visible inline per row.

## 6) Environment Contract

Use `.env.local`:

- `NEXT_PUBLIC_MARKETPLACE_CHAIN_ID`
- `NEXT_PUBLIC_MARKETPLACE_DEFAULT_PROJECT`
- `NEXT_PUBLIC_MARKETPLACE_COLLECTIONS`
- `NEXT_PUBLIC_SITE_URL` (recommended for canonical/OG metadata)

Collections format:

```env
NEXT_PUBLIC_MARKETPLACE_COLLECTIONS=address|name|projectId,address|name|projectId
```

After env edits, restart dev server.

## 7) Development Workflow (Required)

1. Sync branch with latest `main`.
2. Create a focused branch for one change-set.
3. Write/adjust failing tests first.
4. Implement minimal code to pass tests.
5. Refactor while preserving green tests.
6. Run quality gates before commit.

## 8) Git Workflow (Required)

Branching:

```bash
git fetch origin
git checkout main
git pull --ff-only origin main
git checkout -b feat/short-topic
```

During work:

```bash
git status
git diff
```

Commit format:

```text
type(scope): concise summary
```

Allowed types: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`, `ci`.

Examples:

- `feat(collections): sync trait filters with url`
- `fix(cart): block stale rows before checkout`
- `test(token): cover expired listing filtering`

Commit/push:

```bash
git add <paths>
git commit -m "type(scope): summary"
git push -u origin <branch>
```

Git safety rules:

- Never commit `.next`, Playwright artifacts, temp files, or secrets.
- Never force-push shared branches.
- Never revert unrelated changes you did not author.
- Keep PRs small and single-purpose.

## 9) Test Expectations by Change Type

For logic changes:

```bash
pnpm test
pnpm typecheck
pnpm lint
```

For UI/route changes:

```bash
pnpm test
pnpm test:e2e
pnpm build
```

For CI-parity preflight:

```bash
pnpm lint && pnpm typecheck && pnpm test:coverage && pnpm build && pnpm test:e2e
```

For docs-only changes, tests may be skipped, but state that explicitly in PR notes.

## 10) UI and Accessibility Standards

- Maintain minimal, readable hierarchy.
- Use semantic theme tokens (`primary`, `secondary`, `muted`, `destructive`, `chart-*`).
- Preserve keyboard navigation and visible focus states.
- Ensure responsive behavior on mobile and desktop.

## 11) API/Data Rules

- Keep query boundaries explicit: loading, empty, error, success.
- Prefer deterministic parsing/normalization for SDK payload variance.
- Do not hardcode fee results when SDK methods are available.
- Preserve URL-canonical state for filters/sort/cursor where implemented.

## 12) PR Requirements

Each PR should include:

- What changed
- Why it changed
- Risk/impact areas
- Test evidence (exact commands + result)
- Screenshots for UI changes

Checklist:

- [ ] Behavior change has tests
- [ ] Lint/typecheck/build pass
- [ ] No unrelated files modified
- [ ] Docs updated if contracts/behavior changed

## 13) Quick Commands

```bash
pnpm dev
pnpm dev:https
pnpm lint
pnpm typecheck
pnpm test
pnpm test:coverage
pnpm test:e2e
pnpm test:e2e:screenshots
pnpm ci:feature-routes
pnpm build
```

## 14) Conductor Workspace Notes

- Work inside the assigned workspace path only.
- Use `.context/` for scratch notes shared across agents.
- Target branch is `main` unless explicitly told otherwise.
