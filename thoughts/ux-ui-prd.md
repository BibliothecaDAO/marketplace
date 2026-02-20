# UX/UI Improvement PRD — Realms.market
**Branch:** ponderingdemocritus/ux-ui-prd-review
**Date:** 2026-02-20
**Author:** Claude (UX Review Agent)

---

## Executive Summary

Realms.market is a functional NFT marketplace built on solid technical foundations. However, the current UI has a number of issues that create friction for non-technical Web3 users, introduce inconsistency across pages, and obscure key marketplace actions behind jargon or visual noise.

This PRD defines 5 scoped milestones of improvements, each independently shippable, ordered by user impact. Each milestone includes user stories, acceptance criteria, and TDD test cases.

---

## Audit Findings

### Critical (breaks primary flows)
1. **Currency shown as hex address** — Cart and listings display `0x04718f5a0fc34...938d` instead of "STRK". Users cannot identify what currency they are paying.
2. **"Login" label** — Non-standard for Web3. Industry convention is "Connect Wallet".
3. **Raw transaction hashes in success messages** — "Submitted list transaction: 0x1a3f..." is meaningless without a block explorer link.
4. **Cart has no icon** — Just reads "Cart (0)" as a plain text button. Not scannable.

### High (significantly degrades experience)
5. **Portfolio vs Profile confusion** — Both exist in nav, but the difference (lookup any wallet vs. your own) is not communicated.
6. **"Verify ownership" toggle exposed to all users** — A debug switch visible in production is confusing.
7. **Listing expiration shows absolute date** — "3/15/2025" is worse than "Expires in 3 days" at a glance.
8. **Empty states are inconsistent** — Mix of CLI aesthetic (`$ grep --traits -- 0 results`) and plain text.
9. **"Cancel mine" button label** — Ambiguous. "Cancel my listing" is clearer.
10. **No auto-clear for success/error messages** — Stale messages persist across subsequent actions.

### Medium (reduces discoverability or flow)
11. **Grid density controls (Compact/Standard/Comfort)** — Low-value UI clutter; most users never change this.
12. **Sort as 3 toggle buttons** — Sort is typically a dropdown in marketplace UIs, not 3 buttons.
13. **Disconnect is too prominent** — Full-weight button. Should be secondary/ghost or in a dropdown.
14. **No skeleton loading for collection stats** — Floor price / listing count shows nothing while loading.
15. **Fee estimate card is visually disconnected from the buy button** — Breaks the "price → fee → buy" mental model.
16. **Offer form and sell form are visually identical** — Same inputs, different intents need different UI cues.
17. **"Add cheapest to cart" alongside per-listing "Add to cart"** — Creates decision paralysis.

### Low (polish and consistency)
18. **Logo is a placeholder "R"** — No actual brand mark.
19. **No light mode** — Hardcoded `dark` class.
20. **Header is cluttered on mobile** — Too many top-level actions.
21. **Cart empty state is just text** — No visual illustration.
22. **Breadcrumbs truncate token name at 200px** — Can obscure long names.

---

## Milestone Map

| # | Name | Impact | Scope |
|---|------|--------|-------|
| M1 | Core Legibility Fixes | Critical | Price display, currency labels, tx links, wallet language |
| M2 | Navigation Clarity | High | Header simplification, portfolio/profile, mobile nav |
| M3 | Token Detail Flow | High | Buy flow hierarchy, fee card, form UX, listing expiry |
| M4 | Collection Browser Polish | Medium | Sort UX, grid density, trait sidebar, stats loading |
| M5 | Cart & Checkout Excellence | High | Cart icon, empty state, success flow, currency display |

---

## M1: Core Legibility Fixes

> Users must be able to understand what currency they are using and what happened after a transaction.

### User Stories

- **US1.1** As a buyer, I see "STRK" instead of a hex address whenever a currency is shown.
- **US1.2** As a new user, I see "Connect Wallet" not "Login" in the header so I understand what I'm about to do.
- **US1.3** As a seller, after listing a token I see a link to the transaction on Starkscan, not a raw hash.
- **US1.4** As a buyer, after purchasing I can click a link to verify my transaction on-chain.

### Acceptance Criteria

- [ ] All instances of `formatAddress(item.currency)` in `cart-sidebar.tsx` are replaced with a human-readable token symbol lookup (STRK for the known STRK address, otherwise truncated address).
- [ ] The "Login" button label becomes "Connect Wallet".
- [ ] Transaction hash display in `token-detail-view.tsx` and `cart-sidebar.tsx` is replaced with a clickable link: `View on Starkscan →` pointing to `https://starkscan.co/tx/{hash}` (mainnet) or `https://sepolia.starkscan.co/tx/{hash}` (testnet).
- [ ] A `getTokenSymbol(address: string): string` utility is added to `src/lib/marketplace/token-display.ts` that returns "STRK" for the STRK address and `addr.slice(0,6)+"..."` otherwise.

### TDD Test Cases

**File:** `src/lib/marketplace/token-display.test.ts`

```typescript
describe("getTokenSymbol", () => {
  it("returns STRK for the known STRK address", () => {
    expect(getTokenSymbol("0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d"))
      .toBe("STRK");
  });

  it("is case-insensitive", () => {
    expect(getTokenSymbol("0x04718F5A0FC34CC1AF16A1CDEE98FFB20C31F5CD61D6AB07201858F4287C938D"))
      .toBe("STRK");
  });

  it("returns truncated address for unknown token", () => {
    const result = getTokenSymbol("0xdeadbeef1234");
    expect(result).toMatch(/^0x.+\.\.\./);
  });
});

describe("buildExplorerTxUrl", () => {
  it("returns mainnet starkscan URL for SN_MAIN", () => {
    expect(buildExplorerTxUrl("SN_MAIN", "0xabc123"))
      .toBe("https://starkscan.co/tx/0xabc123");
  });

  it("returns sepolia starkscan URL for SN_SEPOLIA", () => {
    expect(buildExplorerTxUrl("SN_SEPOLIA", "0xabc123"))
      .toBe("https://sepolia.starkscan.co/tx/0xabc123");
  });
});
```

**File:** `src/components/layout/header.test.tsx`

```typescript
it("renders Connect Wallet button when disconnected", () => {
  render(<Header />);
  expect(screen.getByRole("button", { name: /connect wallet/i })).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /^login$/i })).not.toBeInTheDocument();
});
```

---

## M2: Navigation Clarity

> Users must be able to orient themselves in the app and understand what each nav item does.

### User Stories

- **US2.1** As a connected user, "Disconnect" is not a prominent button I might accidentally click; it lives in a dropdown under my address.
- **US2.2** As a user, I understand that "Portfolio" means browsing any wallet's holdings, and clicking my address goes to my own holdings.
- **US2.3** As a mobile user, the header doesn't feel cramped and I can access all features from the hamburger menu.
- **US2.4** As a connected user, the Portfolio page auto-populates my own address instead of showing a blank input.

### Acceptance Criteria

- [ ] When connected, the header shows: Logo | Nav links | Socials | Cart | [address badge → dropdown: Profile / Disconnect].
- [ ] The separate "Profile" and "Disconnect" buttons are removed from the top-level header and moved into a dropdown triggered by the address badge.
- [ ] The "Portfolio" button is renamed to "Explore Portfolio" to distinguish it from "your profile" and remains a top-level nav link.
- [ ] The mobile sheet includes the wallet address (if connected) and the same dropdown actions.
- [ ] `PortfolioView` — when the user is connected, their address is pre-populated in the input and their holdings are auto-fetched (no manual submission needed).
- [ ] A `DropdownMenu` (Radix) component is used for the connected wallet actions.

### TDD Test Cases

**File:** `src/components/layout/header.test.tsx`

```typescript
describe("Header — connected state", () => {
  it("does NOT render a top-level Disconnect button", () => {
    mockConnected("0x1234567890abcdef");
    render(<Header />);
    expect(screen.queryByRole("button", { name: /disconnect/i })).not.toBeInTheDocument();
  });

  it("renders wallet address as a dropdown trigger", () => {
    mockConnected("0x1234567890abcdef");
    render(<Header />);
    expect(screen.getByText(/0x1234/)).toBeInTheDocument();
  });

  it("dropdown contains Profile and Disconnect options", async () => {
    mockConnected("0x1234567890abcdef");
    render(<Header />);
    await userEvent.click(screen.getByText(/0x1234/));
    expect(screen.getByRole("menuitem", { name: /profile/i })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /disconnect/i })).toBeInTheDocument();
  });
});
```

**File:** `src/features/portfolio/portfolio-view.test.tsx`

```typescript
it("pre-populates address and auto-fetches when wallet is connected", () => {
  mockConnected("0xmyaddress");
  render(<PortfolioView />);
  expect(screen.getByRole("textbox")).toHaveValue("0xmyaddress");
  // holdings query should be triggered automatically
  expect(mockFetchPortfolio).toHaveBeenCalledWith({ address: "0xmyaddress" });
});
```

---

## M3: Token Detail Flow

> Buying, selling, and offering on a token must feel like a natural, ordered flow — not a collection of disconnected widgets.

### User Stories

- **US3.1** As a buyer, I see: token image → attributes → price + fees → buy button. Everything flows top to bottom.
- **US3.2** As a buyer, I see listing expiration as relative time ("Expires in 3 days") not an absolute date.
- **US3.3** As a seller, "Cancel my listing" is clearly labeled and clearly destructive (not ambiguously "Cancel mine").
- **US3.4** As a user, I don't see a "Verify ownership" toggle — it's removed from the UI (or moved to a dev/debug panel).
- **US3.5** As a user, status messages (success/error) auto-clear after 5 seconds so I don't see stale state.
- **US3.6** As a seller, the sell form and the offer form are visually distinct (different heading, color accent).

### Acceptance Criteria

- [ ] "Verify ownership" toggle is removed from the `token-detail-view.tsx` UI (functionality can remain but not as a user-facing control).
- [ ] `listing.expiration` is displayed as relative time using a `formatRelativeExpiry(epochSeconds: number): string` utility that returns strings like "Expires in 3 days" / "Expired".
- [ ] "Cancel mine" button label becomes "Cancel my listing".
- [ ] The sell form section has an "h2" heading "List this token" and the offer form has "Make an offer" — visually distinct titles.
- [ ] `txStatus` state auto-clears after 5000ms using a `useEffect` with `setTimeout` whenever `txStatus.tone !== "idle"`.
- [ ] The fee estimate card appears directly above the listing rows, not above the "Add cheapest to cart" button row.
- [ ] The "Add cheapest to cart" button is positioned as the primary CTA directly next to the listing price, not in a separate toolbar row.

### TDD Test Cases

**File:** `src/lib/marketplace/token-display.test.ts`

```typescript
describe("formatRelativeExpiry", () => {
  it("returns Expires in N days for future dates", () => {
    const future = Math.floor(Date.now() / 1000) + 3 * 86400;
    expect(formatRelativeExpiry(future)).toBe("Expires in 3 days");
  });

  it("returns Expires in N hours for < 24h", () => {
    const future = Math.floor(Date.now() / 1000) + 6 * 3600;
    expect(formatRelativeExpiry(future)).toBe("Expires in 6 hours");
  });

  it("returns Expired for past timestamps", () => {
    const past = Math.floor(Date.now() / 1000) - 100;
    expect(formatRelativeExpiry(past)).toBe("Expired");
  });
});
```

**File:** `src/features/token/token-detail-view.test.tsx`

```typescript
it("does not render Verify ownership switch", () => {
  renderWithToken();
  expect(screen.queryByLabelText(/verify ownership/i)).not.toBeInTheDocument();
});

it("auto-clears tx status after 5 seconds", async () => {
  jest.useFakeTimers();
  renderWithToken();
  // trigger a success message
  fireEvent.click(screen.getByRole("button", { name: /list token/i }));
  await waitFor(() => expect(screen.getByText(/submitted/i)).toBeInTheDocument());
  jest.advanceTimersByTime(5001);
  await waitFor(() => expect(screen.queryByText(/submitted/i)).not.toBeInTheDocument());
  jest.useRealTimers();
});

it("renders Cancel my listing not Cancel mine", () => {
  renderWithOwnListing();
  expect(screen.getByRole("button", { name: /cancel my listing/i })).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /^cancel mine$/i })).not.toBeInTheDocument();
});
```

---

## M4: Collection Browser Polish

> Browsing a collection must be fast and intuitive without unnecessary UI chrome.

### User Stories

- **US4.1** As a buyer, I see the floor price and item count while the token grid is loading.
- **US4.2** As a buyer, I sort by price using a select dropdown, not three competing buttons.
- **US4.3** As a buyer, I don't see a "Grid density" control by default — the grid just looks good at the standard size.
- **US4.4** As a buyer filtering by traits, I see a count of active filters so I know my results are filtered.
- **US4.5** As a buyer, the empty state for "no results" is friendly text, not a terminal command.

### Acceptance Criteria

- [ ] Collection stats row (total items, listed, floor price) shows skeleton loaders while `collection.isLoading` is true.
- [ ] Sort controls are replaced with a single `<Select>` dropdown (using the existing shadcn/ui `Select` component) with options: Recent / Price: Low to High / Price: High to Low.
- [ ] Grid density buttons (Compact/Standard/Comfort) are removed. Grid defaults to `standard` layout. (The `GridDensity` state and `GRID_DENSITY_OPTIONS` are deleted.)
- [ ] When `activeFilters` has 1+ entries, a badge "(N filters active)" appears next to the "Filters" heading in the trait sidebar.
- [ ] The empty state in `CollectionTokenGrid` changes from `$ grep --traits -- 0 results` to a human-readable message: `No tokens match your filters. Try removing some filters.`

### TDD Test Cases

**File:** `src/features/collections/collection-token-grid.test.tsx`

```typescript
it("does not render grid density buttons", () => {
  render(<CollectionTokenGrid address="0xabc" />);
  expect(screen.queryByRole("button", { name: /compact/i })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /comfort/i })).not.toBeInTheDocument();
});

it("renders sort as a select, not buttons", () => {
  render(<CollectionTokenGrid address="0xabc" />);
  expect(screen.getByRole("combobox", { name: /sort/i })).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /price low to high/i })).not.toBeInTheDocument();
});
```

**File:** `src/features/collections/trait-filter-sidebar.test.tsx`

```typescript
it("shows active filter count badge when filters are applied", () => {
  const activeFilters = { Background: new Set(["Blue"]), Weapon: new Set(["Sword"]) };
  render(<TraitFilterSidebar activeFilters={activeFilters} ... />);
  expect(screen.getByText("2 filters active")).toBeInTheDocument();
});

it("does not show filter count badge when no filters are active", () => {
  render(<TraitFilterSidebar activeFilters={{}} ... />);
  expect(screen.queryByText(/filters active/i)).not.toBeInTheDocument();
});
```

**File:** `src/features/collections/collection-route-view.test.tsx`

```typescript
it("shows skeleton for floor price while loading", () => {
  mockCollectionLoading();
  render(<CollectionRouteView address="0xabc" />);
  expect(screen.getAllByTestId("stats-skeleton").length).toBeGreaterThan(0);
});
```

---

## M5: Cart & Checkout Excellence

> The cart must feel like a first-class commerce experience, not a developer prototype.

### User Stories

- **US5.1** As a buyer, the cart button has a shopping bag icon with a count badge, not just text.
- **US5.2** As a buyer, the cart shows an empty illustration with a CTA when empty.
- **US5.3** As a buyer, each item in the cart shows "STRK" next to the price, not a hex address.
- **US5.4** As a buyer, after a successful checkout I see "Purchase complete! View transaction →" with a Starkscan link, and the success message auto-clears after 8 seconds.
- **US5.5** As a buyer, the "Complete purchase" button is always visible without scrolling (footer is sticky within the sheet).
- **US5.6** As a buyer adding a duplicate item, I see a toast-like message "Already in cart" and the item is not added again.

### Acceptance Criteria

- [ ] `CartSidebar` trigger button uses a `ShoppingCart` icon (from `lucide-react`) with an absolute-positioned count badge instead of the `Cart (N)` text pattern.
- [ ] When `items.length === 0`, a visual empty state is shown: shopping bag icon (large, muted) + "Your cart is empty" heading + "Browse collections →" link.
- [ ] Currency in each cart item row uses `getTokenSymbol(item.currency)` from M1.
- [ ] Post-checkout success message includes a clickable `<a>` to the Starkscan tx URL (using `buildExplorerTxUrl` from M1) and auto-clears after 8000ms.
- [ ] `SheetFooter` in `cart-sidebar.tsx` has `className="sticky bottom-0 bg-background"` to keep checkout visible.
- [ ] Duplicate item detection in `cart-store.ts` triggers a `lastActionError` of "Already in cart" (already deduplicated by orderId, but the error message should be user-facing).

### TDD Test Cases

**File:** `src/features/cart/components/cart-sidebar.test.tsx`

```typescript
it("renders a shopping cart icon, not Cart (N) text", () => {
  render(<CartSidebar />);
  // icon is present
  expect(document.querySelector("svg")).toBeInTheDocument();
  // old text pattern is gone
  expect(screen.queryByText(/^Cart \(/)).not.toBeInTheDocument();
});

it("shows empty state illustration when cart is empty", () => {
  render(<CartSidebar />);
  // open the cart
  fireEvent.click(screen.getByRole("button", { name: /cart/i }));
  expect(screen.getByText(/your cart is empty/i)).toBeInTheDocument();
  expect(screen.getByRole("link", { name: /browse collections/i })).toBeInTheDocument();
});

it("displays STRK symbol instead of hex address for currency", () => {
  mockCartWithItem({ currency: "0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d" });
  render(<CartSidebar />);
  fireEvent.click(screen.getByRole("button", { name: /cart/i }));
  expect(screen.getByText(/STRK/)).toBeInTheDocument();
  expect(screen.queryByText(/0x04718/)).not.toBeInTheDocument();
});

it("checkout success message includes explorer link", async () => {
  mockCheckoutSuccess("0xtxhash123");
  render(<CartSidebar />);
  fireEvent.click(screen.getByRole("button", { name: /complete purchase/i }));
  await waitFor(() => {
    expect(screen.getByRole("link", { name: /view transaction/i })).toHaveAttribute(
      "href", expect.stringContaining("0xtxhash123")
    );
  });
});
```

**File:** `src/features/cart/store/cart-store.test.ts`

```typescript
it("sets lastActionError when adding a duplicate item", () => {
  const store = createCartStore();
  const item = makeCartItem({ orderId: "order-1" });
  store.getState().addItem(item);
  store.getState().addItem(item); // duplicate
  expect(store.getState().lastActionError).toBe("Already in cart");
  expect(store.getState().items).toHaveLength(1); // not added twice
});
```

---

## Implementation Order

Each milestone is independently shippable. Recommended sequence:

```
M1 (1-2 days) → M5 (2-3 days) → M2 (2 days) → M3 (2-3 days) → M4 (1-2 days)
```

Rationale:
- M1 fixes foundational legibility issues that every other milestone builds on.
- M5 is high visibility (checkout path = money path).
- M2 and M3 are structural changes requiring more layout work.
- M4 is polish with lowest risk.

---

## Files Changed Per Milestone

### M1
- `src/lib/marketplace/token-display.ts` — add `getTokenSymbol`, `buildExplorerTxUrl`, `formatRelativeExpiry`
- `src/components/layout/header.tsx` — "Login" → "Connect Wallet"
- `src/features/cart/components/cart-sidebar.tsx` — currency display
- `src/features/token/token-detail-view.tsx` — tx hash links

### M2
- `src/components/layout/header.tsx` — wallet dropdown, remove top-level Disconnect
- `src/features/portfolio/portfolio-view.tsx` — auto-populate connected wallet

### M3
- `src/features/token/token-detail-view.tsx` — layout reorder, auto-clear status, label fixes, remove verify toggle

### M4
- `src/features/collections/collection-token-grid.tsx` — remove grid density, sort → select
- `src/features/collections/collection-route-view.tsx` — sort → select, stats skeletons
- `src/features/collections/trait-filter-sidebar.tsx` — active filter count badge
- `src/components/marketplace/marketplace-home.tsx` — empty state text

### M5
- `src/features/cart/components/cart-sidebar.tsx` — icon, empty state, currency, sticky footer, success link
- `src/features/cart/store/cart-store.ts` — duplicate error message

---

## Out of Scope (for future PRDs)
- Light mode / theme toggle
- Logo/brand design
- ENS/human-readable address support
- Infinite scroll (vs. Load more)
- Offer inbox / received offers page
- Mobile-specific native patterns (bottom sheet checkout)
