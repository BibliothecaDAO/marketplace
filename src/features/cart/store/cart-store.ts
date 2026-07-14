import { createStore } from "zustand/vanilla";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import {
  marketplaceOrderIdentityKey,
  type MarketplaceOrderIdentity,
} from "@/lib/marketplace/order-identity";

export const CART_STORAGE_KEY = "marketplace-cart-v1";
export const CART_MAX_ITEMS = 25;

export type CartItem = {
  orderId: string;
  collection: string;
  tokenId: string;
  price: string;
  currency: string;
  quantity: string;
  projectId?: string;
  tokenName?: string;
  tokenImage?: string | null;
};

export type CartActionResult = {
  ok: boolean;
  error?: string;
};

type CartStoreState = {
  items: CartItem[];
  isOpen: boolean;
  inlineErrors: Record<string, string>;
  lastActionError: string | null;
  addItem: (item: CartItem) => CartActionResult;
  addCandidates: (candidates: CartItem[]) => CartActionResult;
  removeItem: (identity: MarketplaceOrderIdentity) => void;
  clearCart: () => void;
  setOpen: (open: boolean) => void;
  setItemError: (identity: MarketplaceOrderIdentity, error: string) => void;
  clearItemError: (identity: MarketplaceOrderIdentity) => void;
  clearInlineErrors: () => void;
  clearActionError: () => void;
};

function compareBigIntStrings(left: string, right: string) {
  try {
    const leftValue = BigInt(left);
    const rightValue = BigInt(right);
    if (leftValue === rightValue) {
      return 0;
    }

    return leftValue < rightValue ? -1 : 1;
  } catch {
    return left.localeCompare(right);
  }
}

function getCurrentCurrency(items: CartItem[]) {
  return items[0]?.currency ?? null;
}

function applyAddItem(
  state: Pick<CartStoreState, "items">,
  item: CartItem,
): CartActionResult {
  const itemKey = marketplaceOrderIdentityKey(item);
  if (state.items.some((entry) => marketplaceOrderIdentityKey(entry) === itemKey)) {
    return { ok: false, error: "Already in cart." };
  }

  if (state.items.length >= CART_MAX_ITEMS) {
    return {
      ok: false,
      error: `Cart maximum ${CART_MAX_ITEMS} items reached.`,
    };
  }

  const currency = getCurrentCurrency(state.items);
  if (currency && currency !== item.currency) {
    return {
      ok: false,
      error: "Cart only supports a single currency.",
    };
  }

  return { ok: true };
}

const createState = persist<CartStoreState>(
  (set, get) => ({
    items: [],
    isOpen: false,
    inlineErrors: {},
    lastActionError: null,
    addItem: (item) => {
      const result = applyAddItem(get(), item);
      if (!result.ok) {
        set({ lastActionError: result.error ?? "Failed to add item." });
        return result;
      }

      set((state) => ({
        items: state.items.some(
          (entry) => marketplaceOrderIdentityKey(entry) === marketplaceOrderIdentityKey(item),
        )
          ? state.items
          : [...state.items, item],
        lastActionError: null,
      }));

      return { ok: true };
    },
    addCandidates: (candidates) => {
      const ordered = [...candidates].sort((left, right) =>
        compareBigIntStrings(left.price, right.price),
      );
      let firstError: string | undefined;

      for (const candidate of ordered) {
        const result = get().addItem(candidate);
        if (!result.ok && !firstError) {
          firstError = result.error;
        }
      }

      return firstError ? { ok: false, error: firstError } : { ok: true };
    },
    removeItem: (identity) => {
      set((state) => {
        const identityKey = marketplaceOrderIdentityKey(identity);
        if (!(identityKey in state.inlineErrors)) {
          return {
            items: state.items.filter(
              (item) => marketplaceOrderIdentityKey(item) !== identityKey,
            ),
          };
        }

        const nextInlineErrors = { ...state.inlineErrors };
        delete nextInlineErrors[identityKey];

        return {
          items: state.items.filter(
            (item) => marketplaceOrderIdentityKey(item) !== identityKey,
          ),
          inlineErrors: nextInlineErrors,
        };
      });
    },
    clearCart: () => {
      set({ items: [], inlineErrors: {}, lastActionError: null });
    },
    setOpen: (open) => {
      set({ isOpen: open });
    },
    setItemError: (identity, error) => {
      set((state) => ({
        inlineErrors: {
          ...state.inlineErrors,
          [marketplaceOrderIdentityKey(identity)]: error,
        },
      }));
    },
    clearItemError: (identity) => {
      set((state) => {
        const identityKey = marketplaceOrderIdentityKey(identity);
        if (!(identityKey in state.inlineErrors)) {
          return state;
        }

        const nextInlineErrors = { ...state.inlineErrors };
        delete nextInlineErrors[identityKey];

        return { inlineErrors: nextInlineErrors };
      });
    },
    clearInlineErrors: () => {
      set({ inlineErrors: {} });
    },
    clearActionError: () => {
      set({ lastActionError: null });
    },
  }),
  {
    name: CART_STORAGE_KEY,
    storage: createJSONStorage(() => localStorage),
  },
);

export function createCartStore() {
  return createStore<CartStoreState>()(createState);
}

export const cartStore = createCartStore();

export const useCartStore = create<CartStoreState>()(createState);

export type { CartStoreState };
