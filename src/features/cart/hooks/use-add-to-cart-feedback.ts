"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { type CartItem, useCartStore } from "@/features/cart/store/cart-store";

const ADDED_FEEDBACK_DURATION_MS = 1200;

export function useAddToCartFeedback() {
  const addItem = useCartStore((state) => state.addItem);
  const setOpen = useCartStore((state) => state.setOpen);
  const [recentlyAdded, setRecentlyAdded] = useState<Record<string, boolean>>({});
  const timeoutIds = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const markAdded = useCallback((orderId: string) => {
    setRecentlyAdded((current) => ({ ...current, [orderId]: true }));

    const existingTimeoutId = timeoutIds.current[orderId];
    if (existingTimeoutId) {
      clearTimeout(existingTimeoutId);
    }

    timeoutIds.current[orderId] = setTimeout(() => {
      setRecentlyAdded((current) => {
        if (!(orderId in current)) {
          return current;
        }

        const next = { ...current };
        delete next[orderId];
        return next;
      });
      delete timeoutIds.current[orderId];
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
    (item: CartItem) => {
      const result = addItem(item);
      if (result.ok) {
        setOpen(true);
        markAdded(item.orderId);
      } else {
        setOpen(true);
      }
      return result;
    },
    [addItem, markAdded, setOpen],
  );

  const isRecentlyAdded = useCallback(
    (orderId: string | undefined) =>
      orderId ? recentlyAdded[orderId] === true : false,
    [recentlyAdded],
  );

  return {
    addListingToCart,
    isRecentlyAdded,
  };
}
