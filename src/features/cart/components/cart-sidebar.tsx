"use client";

import { useMemo, useState } from "react";
import { ArcadeProvider, NAMESPACE } from "@cartridge/arcade";
import { useMarketplaceClient } from "@cartridge/arcade/marketplace/react";
import { useAccount } from "@starknet-react/core";
import { Button } from "@/components/ui/button";
import { formatAddress, formatPriceForDisplay } from "@/lib/marketplace/token-display";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { getMarketplaceRuntimeConfig } from "@/lib/marketplace/config";
import { useCartStore } from "@/features/cart/store/cart-store";

const CLIENT_FEE_BPS = 500;
const CLIENT_FEE_RECEIVER = "0x045c587318c9ebcf2fbe21febf288ee2e3597a21cd48676005a5770a50d433c5";
const STALE_LISTING_ERROR = "Listing is stale or unavailable.";

function sumPrices(prices: string[]) {
  return prices.reduce((total, value) => {
    try {
      return total + BigInt(value);
    } catch {
      return total;
    }
  }, BigInt(0));
}

function asRecord(value: unknown) {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : null;
}

function formatNumberish(value: unknown) {
  if (typeof value === "bigint") {
    return value.toString();
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.trunc(value).toLocaleString("fullwide", { useGrouping: false });
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    if (/^0x[0-9a-fA-F]+$/.test(trimmed)) {
      return BigInt(trimmed).toString();
    }
    return trimmed;
  }

  return null;
}

function firstNumberish(
  sources: Array<Record<string, unknown> | null>,
  keys: string[],
) {
  for (const source of sources) {
    if (!source) continue;
    for (const key of keys) {
      const formatted = formatNumberish(source[key]);
      if (formatted) {
        return formatted;
      }
    }
  }

  return null;
}

function firstString(
  sources: Array<Record<string, unknown> | null>,
  keys: string[],
) {
  for (const source of sources) {
    if (!source) continue;
    for (const key of keys) {
      const value = source[key];
      if (typeof value === "string" && value.trim().length > 0) {
        return value;
      }
    }
  }

  return null;
}

function listingMatchesCartItem(
  listing: unknown,
  item: {
    orderId: string;
    tokenId: string;
    price: string;
    quantity: string;
    currency: string;
  },
) {
  const fields = asRecord(listing);
  if (!fields) return false;

  const nestedOrder = asRecord(fields.order);
  const orderId = firstNumberish([fields, nestedOrder], ["id", "orderId", "order_id"]);
  const tokenId = firstNumberish([fields, nestedOrder], ["tokenId", "token_id"]);
  const price = firstNumberish([fields, nestedOrder], ["price", "listingPrice", "listing_price"]);
  const quantity = firstNumberish([fields, nestedOrder], ["quantity", "qty"]) ?? "1";
  const currency = firstString([fields, nestedOrder], ["currency"]);
  if (!orderId || !tokenId || !price || !currency) {
    return false;
  }

  return (
    orderId === item.orderId &&
    tokenId === item.tokenId &&
    price === item.price &&
    quantity === item.quantity &&
    currency.toLowerCase() === item.currency.toLowerCase()
  );
}

type ProviderManifest = {
  abis?: unknown[];
  contracts?: Array<{
    tag?: string;
    abi?: unknown[];
  }>;
};

function hydrateContractAbis(
  provider: ArcadeProvider,
) {
  const manifest = (provider as unknown as { manifest?: ProviderManifest })
    .manifest;
  if (!manifest?.contracts || !manifest.abis) {
    return;
  }

  manifest.contracts.forEach((contract) => {
    if (!contract.abi) {
      contract.abi = manifest.abis;
    }
  });
}

export function CartSidebar() {
  const items = useCartStore((state) => state.items);
  const isOpen = useCartStore((state) => state.isOpen);
  const inlineErrors = useCartStore((state) => state.inlineErrors);
  const lastActionError = useCartStore((state) => state.lastActionError);
  const setOpen = useCartStore((state) => state.setOpen);
  const removeItem = useCartStore((state) => state.removeItem);
  const clearCart = useCartStore((state) => state.clearCart);
  const setItemError = useCartStore((state) => state.setItemError);
  const clearInlineErrors = useCartStore((state) => state.clearInlineErrors);
  const { account, isConnected } = useAccount();
  const { client } = useMarketplaceClient();
  const { sdkConfig } = getMarketplaceRuntimeConfig();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [checkoutStatus, setCheckoutStatus] = useState<{
    tone: "idle" | "success" | "error";
    message: string;
  }>({ tone: "idle", message: "" });

  const subtotal = useMemo(
    () => sumPrices(items.map((item) => item.price)),
    [items],
  );
  const fee = BigInt(0);
  const total = subtotal + fee;
  const arcadeProvider = useMemo(
    () => new ArcadeProvider(sdkConfig.chainId),
    [sdkConfig.chainId],
  );

  const handleCheckout = async () => {
    if (!account || !isConnected) {
      setCheckoutStatus({
        tone: "error",
        message: "Connect wallet before checkout.",
      });
      return;
    }

    if (!client) {
      setCheckoutStatus({
        tone: "error",
        message: "Marketplace client is not ready.",
      });
      return;
    }

    setIsSubmitting(true);
    clearInlineErrors();
    setCheckoutStatus({ tone: "idle", message: "" });

    try {
      const validations = await Promise.all(
        items.map(async (item) => {
          try {
            const listings = await client.listCollectionListings({
              collection: item.collection,
              tokenId: item.tokenId,
              projectId: item.projectId,
              verifyOwnership: false,
            });
            const isValid = listings.some((listing) =>
              listingMatchesCartItem(listing, item),
            );
            return { item, isValid };
          } catch {
            return { item, isValid: false };
          }
        }),
      );

      const invalidRows = validations.filter((entry) => !entry.isValid);
      if (invalidRows.length > 0) {
        invalidRows.forEach(({ item }) => {
          setItemError(item.orderId, STALE_LISTING_ERROR);
        });
        setCheckoutStatus({
          tone: "error",
          message: "Checkout blocked due to stale listings.",
        });
        return;
      }

      const dojoCalls = items.map((item) =>
        arcadeProvider.marketplace.buildExecuteCalldata(
          item.orderId,
          item.collection,
          item.tokenId,
          item.currency,
          item.quantity,
          true,
          CLIENT_FEE_BPS,
          CLIENT_FEE_RECEIVER,
        ),
      );

      hydrateContractAbis(arcadeProvider);
      const result = await arcadeProvider.execute(
        account,
        dojoCalls,
        NAMESPACE,
      );
      clearCart();
      setCheckoutStatus({
        tone: "success",
        message: `Submitted checkout transaction: ${result.transaction_hash}`,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Checkout transaction failed.";
      setCheckoutStatus({
        tone: "error",
        message,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

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
            {checkoutStatus.message ? (
              <p
                className={
                  checkoutStatus.tone === "error"
                    ? "text-xs text-destructive"
                    : "text-xs text-primary"
                }
              >
                {checkoutStatus.message}
              </p>
            ) : null}

            {items.length === 0 ? (
              <p className="text-sm text-muted-foreground">Cart is empty.</p>
            ) : (
              items.map((item) => (
                <div
                  key={item.orderId}
                  className="rounded-sm border border-border/70 p-3"
                >
                  <div className="flex items-start gap-3">
                    <div className="h-14 w-14 shrink-0 overflow-hidden rounded-sm bg-muted">
                      {item.tokenImage ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          alt={item.tokenName ?? `Token #${item.tokenId}`}
                          className="h-full w-full object-cover"
                          src={item.tokenImage}
                        />
                      ) : (
                        <span className="flex h-full w-full items-center justify-center text-[10px] text-muted-foreground">
                          No img
                        </span>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {item.tokenName ?? `Token #${item.tokenId}`}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        #{item.tokenId}
                      </p>
                      <p className="text-xs text-primary font-medium">
                        {formatPriceForDisplay(item.price) ?? item.price} {formatAddress(item.currency)}
                      </p>
                    </div>
                    <Button
                      onClick={() => removeItem(item.orderId)}
                      size="sm"
                      type="button"
                      variant="ghost"
                      className="shrink-0"
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
                <span>{formatPriceForDisplay(subtotal.toString()) ?? subtotal.toString()}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Marketplace Fee</span>
                <span>{formatPriceForDisplay(fee.toString()) ?? fee.toString()}</span>
              </div>
              <div className="flex items-center justify-between font-medium">
                <span>Total</span>
                <span>{formatPriceForDisplay(total.toString()) ?? total.toString()}</span>
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
              <Button
                disabled={items.length === 0 || isSubmitting}
                onClick={() => {
                  void handleCheckout();
                }}
                type="button"
              >
                {isSubmitting ? "Processing..." : "Complete purchase"}
              </Button>
            </div>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </>
  );
}
