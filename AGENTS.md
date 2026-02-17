# AGENTS.md

This file is the contributor and coding-agent playbook for the `biblio/marketplace` repo.

## 1) Repository Overview

`biblio/marketplace` is a Next.js App Router marketplace scaffold built around the Arcade Marketplace SDK.

Core goals:
- Multi-collection marketplace UX
- Minimal, clean UI using only `shadcn/ui` + Tailwind tokens
- TDD-first implementation and reliable CI

Primary docs:
- Scope: `docs/SCOPE.md`
- TDD PRD: `docs/TDD-PRD.md`

## 2) Tech Stack

- Next.js `16.1.6` + React `19`
- TypeScript
- Tailwind CSS v4
- `shadcn/ui` components only
- `@cartridge/arcade` marketplace SDK
- Vitest + React Testing Library + MSW
- Playwright for e2e and visual snapshots in CI

## 3) Repository Structure

- `src/app/*` App Router routes
- `src/features/*` feature modules (`collections`, `ops`)
- `src/components/ui/*` shadcn primitives
- `src/components/marketplace/*` marketplace shells/presentation
- `src/components/providers/*` provider wiring
- `src/lib/marketplace/*` config and marketplace utilities
- `src/test/*` test setup + MSW handlers
- `tests/e2e/*` Playwright tests
- `scripts/ci/*` CI helper scripts
- `.github/workflows/ci.yml` CI pipeline

## 4) Local Setup

Prerequisites:
- Node.js `20.x`
- npm `>=10`

Install and run:

```bash
npm install
cp .env.example .env.local
npm run dev
```

Default dev URL:
- `http://localhost:3000`
- If occupied, Next.js will pick another port (for example `3001`).

## 5) Environment Variables

Configure in `.env.local`:

- `NEXT_PUBLIC_MARKETPLACE_CHAIN_ID`
- `NEXT_PUBLIC_MARKETPLACE_DEFAULT_PROJECT`
- `NEXT_PUBLIC_MARKETPLACE_COLLECTIONS`

Collection format:

```env
NEXT_PUBLIC_MARKETPLACE_COLLECTIONS=address|name|projectId,address|name|projectId
```

Example:

```env
NEXT_PUBLIC_MARKETPLACE_CHAIN_ID=SN_SEPOLIA
NEXT_PUBLIC_MARKETPLACE_DEFAULT_PROJECT=
NEXT_PUBLIC_MARKETPLACE_COLLECTIONS=0x123...|Genesis|project-a,0x456...|Artifacts|project-b
```

How to add collections:
- Update `NEXT_PUBLIC_MARKETPLACE_COLLECTIONS` in `.env.local`.
- Use comma-separated entries in this format:
  - `address|name|projectId`
- `address` and `name` are required.
- `projectId` is optional.
- Restart the dev server after changes.

Example single collection:

```env
NEXT_PUBLIC_MARKETPLACE_COLLECTIONS=0xabc123...|Genesis|project-a
```

## 6) Daily Development Workflow

1. Create a branch from latest main.
2. Implement with TDD: write failing test first, then minimal code, then refactor.
3. Keep UI within shadcn + Tailwind token system.
4. Run local quality gates before committing.
5. Commit in small, reviewable chunks.

Useful commands:

```bash
npm run lint
npm run typecheck
npm test
npm run build
npm run test:e2e
```

## 7) Testing and CI

CI workflow: `.github/workflows/ci.yml`

CI stages:
1. `npm ci`
2. `npm run lint`
3. `npm run typecheck`
4. `npm test`
5. `npm run build`
6. `npm run test:e2e`
7. Conditional feature screenshot capture

Feature screenshot behavior:
- Route detection script: `scripts/ci/feature-screenshot-routes.mjs`
- Screenshot spec: `tests/e2e/feature-screenshots.spec.ts`
- Artifacts uploaded as:
  - `feature-screenshots-*`
  - `playwright-artifacts-*`

## 8) Commit Standards

Before commit, run:

```bash
npm run lint && npm run typecheck && npm test && npm run build
```

Commit message format:

```text
type(scope): concise summary
```

Examples:
- `feat(collections): add trait sidebar URL sync`
- `fix(ci): skip screenshot suite when no routes`
- `test(traits): cover filter flattening edge cases`

Recommended types:
- `feat`, `fix`, `refactor`, `test`, `docs`, `chore`, `ci`

Commit flow:

```bash
git checkout -b feat/short-name
git status
git add <paths>
git commit -m \"feat(scope): message\"
git push -u origin feat/short-name
```

## 9) Pull Request Best Practices

Include in PR description:
- What changed
- Why it changed
- Risk/impact areas
- Test evidence (commands + result)
- Screenshots for UI changes

PR checklist:
- [ ] Tests added/updated for behavior changes
- [ ] Lint/typecheck/build pass locally
- [ ] No unrelated file changes
- [ ] Updated docs when behavior/contracts changed

## 10) Code Quality Guidelines

- Favor small composable functions over large components.
- Keep business logic in `src/lib` or feature modules, not in route files.
- Preserve strict typing; avoid `any` unless unavoidable.
- Handle all async states: loading, success, empty, error.
- Keep URL state canonical for filters/search/cursor where applicable.
- Avoid introducing UI libraries beyond shadcn primitives.

## 11) Frontend UX Guidelines

- Minimal, readable layouts with strong information hierarchy.
- Use theme tokens (`primary`, `secondary`, `accent`, `muted`, `destructive`, `chart-*`).
- Maintain keyboard accessibility and visible focus states.
- Ensure responsive behavior for mobile and desktop.

## 12) Agent-Specific Guidelines

If you are an automated coding agent working in this repo:
- Read this file first, then `README.md`, `docs/SCOPE.md`, and `docs/TDD-PRD.md`.
- Do not skip tests-first workflow for feature or bugfix work.
- Do not commit generated output (`.next`, temporary artifacts, local env files).
- Prefer focused patches and avoid broad refactors unless requested.
- When making UI changes, provide route screenshots and test proof.

## 13) Quick Reference

- Start dev server: `npm run dev`
- Unit/integration tests: `npm test`
- E2E tests: `npm run test:e2e`
- Feature screenshots e2e: `npm run test:e2e:screenshots`
- CI route detection helper: `npm run ci:feature-routes`
