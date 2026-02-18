import { beforeEach, describe, expect, it } from "vitest";
import {
  CART_STORAGE_KEY,
  type CartItem,
  createCartStore,
} from "@/features/cart/store/cart-store";

function makeItem(overrides?: Partial<CartItem>): CartItem {
  return {
    orderId: "1",
    collection: "0xabc",
    tokenId: "1",
    price: "100",
    currency: "0xfee",
    quantity: "1",
    tokenName: "Token #1",
    ...overrides,
  };
}

describe("cart store", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("cart_store_dedupes_by_order_id", () => {
    const store = createCartStore();

    store.getState().addItem(makeItem({ orderId: "101" }));
    store.getState().addItem(makeItem({ orderId: "101", tokenId: "2" }));

    expect(store.getState().items).toHaveLength(1);
    expect(store.getState().items[0]?.tokenId).toBe("1");
  });

  it("cart_store_rejects_mixed_currency", () => {
    const store = createCartStore();

    const first = store.getState().addItem(makeItem({ orderId: "101", currency: "0xaaa" }));
    const second = store.getState().addItem(makeItem({ orderId: "102", currency: "0xbbb" }));

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(false);
    expect(second.error).toMatch(/single currency/i);
    expect(store.getState().items).toHaveLength(1);
  });

  it("cart_store_enforces_max_25_items", () => {
    const store = createCartStore();

    for (let index = 1; index <= 25; index += 1) {
      const result = store.getState().addItem(
        makeItem({ orderId: String(index), tokenId: String(index) }),
      );
      expect(result.ok).toBe(true);
    }

    const overflow = store.getState().addItem(
      makeItem({ orderId: "26", tokenId: "26" }),
    );

    expect(overflow.ok).toBe(false);
    expect(overflow.error).toMatch(/maximum 25/i);
    expect(store.getState().items).toHaveLength(25);
  });

  it("sweeper_candidate_intake_adds_lowest_price_first", () => {
    const store = createCartStore();

    store.getState().addCandidates([
      makeItem({ orderId: "201", price: "300" }),
      makeItem({ orderId: "202", price: "100" }),
      makeItem({ orderId: "203", price: "200" }),
    ]);

    expect(store.getState().items.map((item) => item.orderId)).toEqual([
      "202",
      "203",
      "201",
    ]);
  });

  it("cart_store_persists_and_rehydrates", () => {
    const store = createCartStore();

    store.getState().addItem(makeItem({ orderId: "401" }));

    const raw = localStorage.getItem(CART_STORAGE_KEY);
    expect(raw).toBeTruthy();

    const rehydratedStore = createCartStore();

    expect(rehydratedStore.getState().items).toHaveLength(1);
    expect(rehydratedStore.getState().items[0]?.orderId).toBe("401");
  });
});
