import { beforeEach, describe, expect, it } from "vitest";
import {
  CART_STORAGE_KEY,
  type CartItem,
  createCartStore,
} from "@/features/cart/store/cart-store";
import { marketplaceOrderIdentityKey } from "@/lib/marketplace/order-identity";

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

  it("cart_store_keeps_same_order_id_for_distinct_collection_token_identity", () => {
    const store = createCartStore();

    store.getState().addItem(makeItem({ orderId: "101" }));
    const result = store.getState().addItem(
      makeItem({ orderId: "101", collection: "0xdef", tokenId: "2" }),
    );

    expect(result.ok).toBe(true);
    expect(store.getState().items).toHaveLength(2);
  });

  it("cart_store_reports_already_in_cart_for_duplicate", () => {
    const store = createCartStore();

    store.getState().addItem(makeItem({ orderId: "101" }));
    const result = store.getState().addItem(makeItem({ orderId: "101" }));

    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/already in cart/i);
    expect(store.getState().lastActionError).toMatch(/already in cart/i);
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

describe("cart store - mutation actions", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("remove_item_removes_correct_item", () => {
    const store = createCartStore();
    const first = makeItem({ orderId: "10", tokenId: "10" });

    store.getState().addItem(first);
    store.getState().addItem(makeItem({ orderId: "11", tokenId: "11" }));

    store.getState().removeItem(first);

    expect(store.getState().items).toHaveLength(1);
    expect(store.getState().items[0]?.orderId).toBe("11");
  });

  it("remove_item_also_removes_associated_inline_error", () => {
    const store = createCartStore();
    const item = makeItem({ orderId: "10", tokenId: "10" });
    const itemKey = marketplaceOrderIdentityKey(item);

    store.getState().addItem(item);
    store.getState().setItemError(item, "some error");

    expect(store.getState().inlineErrors[itemKey]).toBe("some error");

    store.getState().removeItem(item);

    expect(store.getState().items).toHaveLength(0);
    expect(store.getState().inlineErrors[itemKey]).toBeUndefined();
  });

  it("remove_item_leaves_other_inline_errors_intact", () => {
    const store = createCartStore();
    const first = makeItem({ orderId: "10", tokenId: "10" });
    const second = makeItem({ orderId: "11", tokenId: "11" });
    const firstKey = marketplaceOrderIdentityKey(first);
    const secondKey = marketplaceOrderIdentityKey(second);

    store.getState().addItem(first);
    store.getState().addItem(second);
    store.getState().setItemError(first, "error for 10");
    store.getState().setItemError(second, "error for 11");

    store.getState().removeItem(first);

    expect(store.getState().inlineErrors[firstKey]).toBeUndefined();
    expect(store.getState().inlineErrors[secondKey]).toBe("error for 11");
  });

  it("isolates removal and errors for rows sharing an order id", () => {
    const store = createCartStore();
    const first = makeItem({ orderId: "10", collection: "0xabc", tokenId: "1" });
    const second = makeItem({ orderId: "10", collection: "0xdef", tokenId: "2" });
    const secondKey = marketplaceOrderIdentityKey(second);

    store.getState().addItem(first);
    store.getState().addItem(second);
    store.getState().setItemError(first, "first error");
    store.getState().setItemError(second, "second error");
    store.getState().removeItem(first);

    expect(store.getState().items).toEqual([second]);
    expect(store.getState().inlineErrors).toEqual({ [secondKey]: "second error" });
  });

  it("set_open_sets_is_open_true", () => {
    const store = createCartStore();

    expect(store.getState().isOpen).toBe(false);
    store.getState().setOpen(true);
    expect(store.getState().isOpen).toBe(true);
  });

  it("set_open_sets_is_open_false", () => {
    const store = createCartStore();

    store.getState().setOpen(true);
    store.getState().setOpen(false);
    expect(store.getState().isOpen).toBe(false);
  });

  it("set_item_error_stores_error_for_order", () => {
    const store = createCartStore();
    const item = makeItem({ orderId: "20", tokenId: "20" });

    store.getState().addItem(item);
    store.getState().setItemError(item, "purchase failed");

    expect(store.getState().inlineErrors[marketplaceOrderIdentityKey(item)]).toBe(
      "purchase failed",
    );
  });

  it("set_item_error_can_overwrite_previous_error", () => {
    const store = createCartStore();
    const item = makeItem({ orderId: "20", tokenId: "20" });

    store.getState().addItem(item);
    store.getState().setItemError(item, "first error");
    store.getState().setItemError(item, "second error");

    expect(store.getState().inlineErrors[marketplaceOrderIdentityKey(item)]).toBe(
      "second error",
    );
  });

  it("clear_item_error_removes_specific_error", () => {
    const store = createCartStore();
    const first = makeItem({ orderId: "30", tokenId: "30" });
    const second = makeItem({ orderId: "31", tokenId: "31" });

    store.getState().addItem(first);
    store.getState().addItem(second);
    store.getState().setItemError(first, "err30");
    store.getState().setItemError(second, "err31");

    store.getState().clearItemError(first);

    expect(store.getState().inlineErrors[marketplaceOrderIdentityKey(first)]).toBeUndefined();
    expect(store.getState().inlineErrors[marketplaceOrderIdentityKey(second)]).toBe("err31");
  });

  it("clear_item_error_is_noop_when_order_not_in_errors", () => {
    const store = createCartStore();
    const item = makeItem({ orderId: "30", tokenId: "30" });

    store.getState().addItem(item);
    store.getState().setItemError(item, "err30");

    store.getState().clearItemError(makeItem({ orderId: "99", tokenId: "99" }));

    expect(store.getState().inlineErrors[marketplaceOrderIdentityKey(item)]).toBe("err30");
  });

  it("clear_inline_errors_removes_all_errors", () => {
    const store = createCartStore();
    const first = makeItem({ orderId: "40", tokenId: "40" });
    const second = makeItem({ orderId: "41", tokenId: "41" });

    store.getState().addItem(first);
    store.getState().addItem(second);
    store.getState().setItemError(first, "errA");
    store.getState().setItemError(second, "errB");

    store.getState().clearInlineErrors();

    expect(store.getState().inlineErrors).toEqual({});
  });

  it("clear_action_error_clears_last_action_error", () => {
    const store = createCartStore();

    // Trigger a lastActionError by adding a second item with a different currency
    store.getState().addItem(makeItem({ orderId: "50", currency: "0xaaa" }));
    store.getState().addItem(makeItem({ orderId: "51", currency: "0xbbb" }));

    expect(store.getState().lastActionError).toBeTruthy();

    store.getState().clearActionError();

    expect(store.getState().lastActionError).toBeNull();
  });

  it("clear_cart_removes_items_inline_errors_and_action_error", () => {
    const store = createCartStore();
    const item = makeItem({ orderId: "60", tokenId: "60", currency: "0xaaa" });

    store.getState().addItem(item);
    store.getState().setItemError(item, "some error");
    // Trigger lastActionError
    store.getState().addItem(makeItem({ orderId: "61", tokenId: "61", currency: "0xbbb" }));

    expect(store.getState().items).toHaveLength(1);
    expect(store.getState().inlineErrors[marketplaceOrderIdentityKey(item)]).toBe("some error");
    expect(store.getState().lastActionError).toBeTruthy();

    store.getState().clearCart();

    expect(store.getState().items).toHaveLength(0);
    expect(store.getState().inlineErrors).toEqual({});
    expect(store.getState().lastActionError).toBeNull();
  });

  it("add_candidates_returns_first_error_when_all_fail", () => {
    const store = createCartStore();

    // Fill cart to max capacity first
    for (let index = 1; index <= 25; index += 1) {
      store.getState().addItem(
        makeItem({ orderId: String(index), tokenId: String(index) }),
      );
    }

    expect(store.getState().items).toHaveLength(25);

    // Now addCandidates should fail for all items since cart is full
    const result = store.getState().addCandidates([
      makeItem({ orderId: "100", tokenId: "100", price: "50" }),
      makeItem({ orderId: "101", tokenId: "101", price: "200" }),
    ]);

    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/maximum 25/i);
  });

  it("add_candidates_still_adds_partial_items_even_when_some_fail", () => {
    const store = createCartStore();

    // Fill cart to 24 items
    for (let index = 1; index <= 24; index += 1) {
      store.getState().addItem(
        makeItem({ orderId: String(index), tokenId: String(index) }),
      );
    }

    // The lowest-price candidate (orderId 100, price 50) is added first and succeeds.
    // The second candidate (orderId 101, price 200) then hits the max-25 limit and fails.
    // addCandidates returns ok: false because firstError is set by the failing candidate,
    // even though the first candidate was successfully added.
    const result = store.getState().addCandidates([
      makeItem({ orderId: "100", tokenId: "100", price: "50" }),
      makeItem({ orderId: "101", tokenId: "101", price: "200" }),
    ]);

    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/maximum 25/i);
    // The first (cheaper) candidate was still added before the error occurred
    expect(store.getState().items).toHaveLength(25);
    expect(store.getState().items.some((item) => item.orderId === "100")).toBe(true);
  });
});
