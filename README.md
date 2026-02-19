# Biblio Marketplace

Next.js marketplace scaffold using:
- `@cartridge/arcade` marketplace SDK
- `shadcn/ui` only for UI primitives
- Tailwind CSS theme tokens/utilities

## Quick Start

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open `http://localhost:3000`.

For wallet testing on HTTPS:

```bash
brew install mkcert nss
npm run dev:https
```

Open `https://localhost:3000`.

## Environment Variables

Configure these in `.env.local`:

- `NEXT_PUBLIC_MARKETPLACE_CHAIN_ID`
  - `SN_MAIN`, `SN_SEPOLIA`, or a `0x...` chain id
- `NEXT_PUBLIC_MARKETPLACE_DEFAULT_PROJECT`
  - optional Arcade project id
- `NEXT_PUBLIC_MARKETPLACE_COLLECTIONS`
  - comma-separated `address|name|projectId` entries
- `NEXT_PUBLIC_SITE_URL`
  - absolute app URL used for canonical links and OG/Twitter metadata URLs

Example:

```env
NEXT_PUBLIC_MARKETPLACE_CHAIN_ID=SN_SEPOLIA
NEXT_PUBLIC_MARKETPLACE_DEFAULT_PROJECT=
NEXT_PUBLIC_MARKETPLACE_COLLECTIONS=0x123...|Genesis|project-a,0x456...|Artifacts|project-b
NEXT_PUBLIC_SITE_URL=https://market.realms.world
```

## Scripts

```bash
npm run dev
npm run dev:https
npm run lint
npm run typecheck
npm run test
npm run test:coverage
npm run test:e2e:install
npm run test:e2e
npm run test:e2e:screenshots
npm run ci:feature-routes
npm run build
npm run start
```

## CI

GitHub Actions workflow: `.github/workflows/ci.yml`

Pipeline stages:
- lint
- typecheck
- unit tests
- build
- Playwright e2e
- feature screenshot capture (when frontend feature files changed)

Feature screenshots are uploaded as workflow artifacts under `feature-screenshots-*`.

## Scope

Detailed phased scope is in `docs/SCOPE.md`.
Detailed TDD product requirements are in `docs/TDD-PRD.md`.
