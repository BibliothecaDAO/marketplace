"use client";

import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useCartStore } from "@/features/cart/store/cart-store";

function sumPrices(prices: string[]) {
  return prices.reduce((total, value) => {
    try {
      return total + BigInt(value);
    } catch {
      return total;
    }
  }, BigInt(0));
}

export function CartSidebar() {
  const items = useCartStore((state) => state.items);
  const isOpen = useCartStore((state) => state.isOpen);
  const inlineErrors = useCartStore((state) => state.inlineErrors);
  const lastActionError = useCartStore((state) => state.lastActionError);
  const setOpen = useCartStore((state) => state.setOpen);
  const removeItem = useCartStore((state) => state.removeItem);
  const clearCart = useCartStore((state) => state.clearCart);

  const subtotal = useMemo(
    () => sumPrices(items.map((item) => item.price)),
    [items],
  );
  const fee = BigInt(0);
  const total = subtotal + fee;

  return (
    <>
      <Button
        aria-label={`Cart (${items.length})`}
        onClick={() => setOpen(true)}
        size="sm"
        type="button"
        variant="outline"
      >
        Cart ({items.length})
      </Button>

      <Sheet onOpenChange={setOpen} open={isOpen}>
        <SheetContent side="right">
          <SheetHeader>
            <SheetTitle>Cart</SheetTitle>
            <SheetDescription>
              Review selected listings before checkout.
            </SheetDescription>
          </SheetHeader>

          <div className="flex-1 space-y-3 overflow-y-auto px-4 pb-4">
            {lastActionError ? (
              <p className="text-xs text-destructive">{lastActionError}</p>
            ) : null}

            {items.length === 0 ? (
              <p className="text-sm text-muted-foreground">Cart is empty.</p>
            ) : (
              items.map((item) => (
                <div
                  key={item.orderId}
                  className="rounded-sm border border-border/70 p-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium">
                        {item.tokenName ?? `Token #${item.tokenId}`}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Order #{item.orderId}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {item.price} {item.currency}
                      </p>
                    </div>
                    <Button
                      onClick={() => removeItem(item.orderId)}
                      size="sm"
                      type="button"
                      variant="ghost"
                    >
                      Remove
                    </Button>
                  </div>

                  {inlineErrors[item.orderId] ? (
                    <p className="mt-2 text-xs text-destructive">
                      {inlineErrors[item.orderId]}
                    </p>
                  ) : null}
                </div>
              ))
            )}
          </div>

          <SheetFooter>
            <div className="w-full space-y-1 rounded-sm border border-border/70 p-3 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Subtotal</span>
                <span>{subtotal.toString()}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Marketplace Fee</span>
                <span>{fee.toString()}</span>
              </div>
              <div className="flex items-center justify-between font-medium">
                <span>Total</span>
                <span>{total.toString()}</span>
              </div>
            </div>
            <div className="flex w-full gap-2">
              <Button
                disabled={items.length === 0}
                onClick={() => clearCart()}
                type="button"
                variant="secondary"
              >
                Clear
              </Button>
              <Button disabled={items.length === 0} type="button">
                Buy all
              </Button>
            </div>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </>
  );
}
