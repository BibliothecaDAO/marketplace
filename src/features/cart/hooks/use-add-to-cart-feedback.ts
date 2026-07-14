"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { type CartItem, useCartStore } from "@/features/cart/store/cart-store";
import {
  marketplaceOrderIdentityKey,
  type MarketplaceOrderIdentity,
} from "@/lib/marketplace/order-identity";

const ADDED_FEEDBACK_DURATION_MS = 1200;
type AddToCartOptions = {
  openCart?: boolean;
};

export function useAddToCartFeedback() {
  const addItem = useCartStore((state) => state.addItem);
  const setOpen = useCartStore((state) => state.setOpen);
  const [recentlyAdded, setRecentlyAdded] = useState<Record<string, boolean>>({});
  const timeoutIds = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const markAdded = useCallback((identity: MarketplaceOrderIdentity) => {
    const identityKey = marketplaceOrderIdentityKey(identity);
    setRecentlyAdded((current) => ({ ...current, [identityKey]: true }));

    const existingTimeoutId = timeoutIds.current[identityKey];
    if (existingTimeoutId) {
      clearTimeout(existingTimeoutId);
    }

    timeoutIds.current[identityKey] = setTimeout(() => {
      setRecentlyAdded((current) => {
        if (!(identityKey in current)) {
          return current;
        }

        const next = { ...current };
        delete next[identityKey];
        return next;
      });
      delete timeoutIds.current[identityKey];
    }, ADDED_FEEDBACK_DURATION_MS);
  }, []);

  useEffect(
    () => () => {
      for (const timeoutId of Object.values(timeoutIds.current)) {
        clearTimeout(timeoutId);
      }
      timeoutIds.current = {};
    },
    [],
  );

  const addListingToCart = useCallback(
    (item: CartItem, options?: AddToCartOptions) => {
      const openCart = options?.openCart ?? true;
      const result = addItem(item);
      if (result.ok) {
        if (openCart) {
          setOpen(true);
        }
        markAdded(item);
      } else {
        setOpen(true);
      }
      return result;
    },
    [addItem, markAdded, setOpen],
  );

  const isRecentlyAdded = useCallback(
    (identity: MarketplaceOrderIdentity | null | undefined) =>
      identity ? recentlyAdded[marketplaceOrderIdentityKey(identity)] === true : false,
    [recentlyAdded],
  );

  return {
    addListingToCart,
    isRecentlyAdded,
  };
}
