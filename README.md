# Biblio Marketplace

```text
 __  __            _        _         _
|  \/  | __ _ _ __| | _____| |_ _ __ | | __ _  ___ ___
| |\/| |/ _` | '__| |/ / _ \ __| '_ \| |/ _` |/ __/ _ \\
| |  | | (_| | |  |   <  __/ |_| |_) | | (_| | (_|  __/
|_|  |_|\__,_|_|  |_|\_\___|\__| .__/|_|\__,_|\___\___|
                               |_|
```

A Next.js App Router NFT marketplace for the Realms ecosystem, powered by `@cartridge/arcade`, with a strict `shadcn/ui` + Tailwind token UI approach.

## What Is Implemented

- Multi-collection home discovery with search and collection rows.
- Collection route with trait filters, URL-synced query state, token grid, and market activity tabs.
- Token detail route with listing table, add-to-cart actions, listing/offer/cancel actions, and fee/royalty estimate card.
- Persisted cart sidebar with stale-listing validation, inline row errors, and single-transaction checkout.
- Portfolio route (`/portfolio`) for arbitrary wallet lookup.
- Wallet profile route (`/profile/[address]`) and ops diagnostics route (`/ops`).
- Dynamic SEO metadata and OpenGraph image routes for collections and tokens.

## Multi-Currency Behavior

This marketplace is multi-currency at the listing, wallet, and checkout execution layers.

- Listing/offer flows support multiple Starknet tokens: `STRK`, `LORDS`, and `SURVIVO`.
- Token and cart UI resolve currency symbol/icon from token contract addresses (`TokenSymbol` + `getTokenSymbol`).
- Connected-wallet dropdown fetches balances for STRK/LORDS/SURVIVO.
- Checkout calls are built with each listing's currency and a currency-specific fee receiver.
- Important constraint: the cart intentionally enforces **single-currency per checkout** (no mixed-currency cart execution) and a max of 25 items.

## Stack

- Next.js `16.1.6` (App Router) + React `19`
- TypeScript
- Tailwind CSS v4
- `shadcn/ui` primitives
- `@cartridge/arcade` marketplace SDK
- Zustand (cart persistence)
- TanStack Query
- Vitest + React Testing Library + MSW
- Playwright e2e + screenshot capture in CI

## Project Layout

- `src/app/*`: App Router routes + metadata + API routes
- `src/features/*`: feature modules (`collections`, `token`, `cart`, `portfolio`, `profile`, `ops`)
- `src/components/ui/*`: shadcn primitives
- `src/components/layout/*`: header + wallet UI
- `src/components/marketplace/*`: home/row/card presentation
- `src/components/providers/*`: marketplace/starknet/query provider wiring
- `src/lib/marketplace/*`: runtime config, hooks, fees, token display helpers
- `src/test/*`: Vitest setup + MSW server/handlers
- `tests/e2e/*`: Playwright flows and screenshot tests
- `scripts/ci/*`: feature-route detection and CI helper scripts

## Local Setup

Prereqs:

- Node.js `20.x`
- npm `>=10` or pnpm `10.x`

Install dependencies (CI uses pnpm):

```bash
pnpm install
# or: npm install
```

Create/update `.env.local`:

```env
NEXT_PUBLIC_MARKETPLACE_CHAIN_ID=SN_SEPOLIA
NEXT_PUBLIC_MARKETPLACE_DEFAULT_PROJECT=
NEXT_PUBLIC_MARKETPLACE_COLLECTIONS=0x123...|Genesis|project-a,0x456...|Artifacts|project-b
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

Notes:

- `NEXT_PUBLIC_MARKETPLACE_COLLECTIONS` format is `address|name|projectId` (comma-separated).
- `address` and `name` are required; `projectId` is optional.
- Restart dev server after env changes.

Run:

```bash
pnpm dev
# or: npm run dev
```

Default URL: `http://localhost:3000`

If you need HTTPS for wallet testing:

```bash
brew install mkcert nss
pnpm dev:https
# or: npm run dev:https
```

## Scripts

```bash
pnpm dev
pnpm dev:https
pnpm lint
pnpm typecheck
pnpm test
pnpm test:coverage
pnpm test:e2e:install
pnpm test:e2e
pnpm test:e2e:screenshots
pnpm ci:feature-routes
pnpm build
pnpm start
```

## Testing and CI

- Unit/integration: Vitest + RTL + MSW (`src/test/setup.ts`)
- E2E: Playwright (`tests/e2e/*`) on `http://127.0.0.1:3400`
- CI workflow: `.github/workflows/ci.yml`

CI verifies:

1. install
2. lint
3. typecheck
4. unit tests with coverage
5. build
6. e2e
7. feature screenshots

Feature screenshots:

- Route selection: `scripts/ci/feature-screenshot-routes.mjs`
- Spec: `tests/e2e/feature-screenshots.spec.ts`
- Artifacts: `feature-screenshots-*`, `playwright-artifacts-*`

## Route Map

- `/`: marketplace home
- `/collections/[address]`: collection view + filters + activity
- `/collections/[address]/[tokenId]`: token detail + purchase actions
- `/portfolio`: wallet holdings lookup
- `/profile/[address]`: wallet profile
- `/ops`: client diagnostics

## Reference Docs

- Scope: `docs/SCOPE.md`
- TDD PRD: `docs/TDD-PRD.md`
- TDD implementation plan: `docs/TDD-IMPLEMENTATION-PLAN.md`
