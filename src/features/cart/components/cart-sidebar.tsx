"use client";

import { useEffect, useMemo, useState } from "react";
import { ArcadeProvider, NAMESPACE } from "@cartridge/arcade";
import { useMarketplaceClient } from "@cartridge/arcade/marketplace/react";
import { useAccount } from "@starknet-react/core";
import { Button } from "@/components/ui/button";
import { formatAddress, formatPriceForDisplay } from "@/lib/marketplace/token-display";
import {
  calculateCartSummary,
  parseBigInt,
  type MarketplaceFeeConfig,
} from "@/lib/marketplace/fees";
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
const CLIENT_FEE_DENOMINATOR = 10_000;
const CLIENT_FEE_RECEIVER = "0x045c587318c9ebcf2fbe21febf288ee2e3597a21cd48676005a5770a50d433c5";
const STALE_LISTING_ERROR = "Listing is stale or unavailable.";

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
  const clearItemError = useCartStore((state) => state.clearItemError);
  const clearInlineErrors = useCartStore((state) => state.clearInlineErrors);
  const { account, isConnected } = useAccount();
  const { client } = useMarketplaceClient();
  const { sdkConfig } = getMarketplaceRuntimeConfig();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [refreshingRows, setRefreshingRows] = useState<Record<string, boolean>>(
    {},
  );
  const [marketplaceFeeConfig, setMarketplaceFeeConfig] =
    useState<MarketplaceFeeConfig | null>(null);
  const [royaltyEstimate, setRoyaltyEstimate] = useState(BigInt(0));
  const [checkoutStatus, setCheckoutStatus] = useState<{
    kind: "idle" | "stale" | "error" | "success";
    tone: "idle" | "success" | "error";
    message: string;
  }>({ kind: "idle", tone: "idle", message: "" });

  const effectiveFeeConfig = useMemo(
    () =>
      marketplaceFeeConfig ?? {
        feeNum: CLIENT_FEE_BPS,
        feeDenominator: CLIENT_FEE_DENOMINATOR,
        feeReceiver: CLIENT_FEE_RECEIVER,
      },
    [marketplaceFeeConfig],
  );
  const { subtotal, marketplaceFee, total } = useMemo(
    () =>
      calculateCartSummary({
        prices: items.map((item) => item.price),
        marketplaceFeeConfig: effectiveFeeConfig,
        royaltyEstimate,
      }),
    [effectiveFeeConfig, items, royaltyEstimate],
  );
  const arcadeProvider = useMemo(
    () => new ArcadeProvider(sdkConfig.chainId),
    [sdkConfig.chainId],
  );

  useEffect(() => {
    let disposed = false;

    async function loadMarketplaceFeeConfig() {
      if (!client || typeof client.getFees !== "function") {
        setMarketplaceFeeConfig(null);
        return;
      }

      try {
        const fees = await client.getFees();
        if (disposed) {
          return;
        }

        if (!fees) {
          setMarketplaceFeeConfig(null);
          return;
        }

        setMarketplaceFeeConfig({
          feeNum: fees.feeNum,
          feeDenominator: fees.feeDenominator,
          feeReceiver: fees.feeReceiver,
        });
      } catch {
        if (!disposed) {
          setMarketplaceFeeConfig(null);
        }
      }
    }

    void loadMarketplaceFeeConfig();

    return () => {
      disposed = true;
    };
  }, [client]);

  useEffect(() => {
    let disposed = false;

    async function loadRoyaltyEstimate() {
      if (
        !client ||
        typeof client.getRoyaltyFee !== "function" ||
        items.length === 0
      ) {
        setRoyaltyEstimate(BigInt(0));
        return;
      }

      const amounts = await Promise.all(
        items.map(async (item) => {
          const amount = parseBigInt(item.price);
          if (amount === null) {
            return BigInt(0);
          }

          try {
            const royalty = await client.getRoyaltyFee({
              collection: item.collection,
              tokenId: item.tokenId,
              amount,
            });
            return royalty?.amount ?? BigInt(0);
          } catch {
            return BigInt(0);
          }
        }),
      );

      if (disposed) {
        return;
      }

      setRoyaltyEstimate(
        amounts.reduce((sum, amount) => sum + amount, BigInt(0)),
      );
    }

    void loadRoyaltyEstimate();

    return () => {
      disposed = true;
    };
  }, [client, items]);

  const handleCheckout = async () => {
    if (!account || !isConnected) {
      setCheckoutStatus({
        kind: "error",
        tone: "error",
        message: "Connect wallet before checkout.",
      });
      return;
    }

    if (!client) {
      setCheckoutStatus({
        kind: "error",
        tone: "error",
        message: "Marketplace client is not ready.",
      });
      return;
    }

    setIsSubmitting(true);
    clearInlineErrors();
    setCheckoutStatus({ kind: "idle", tone: "idle", message: "" });

    try {
      const validateItem = async (item: (typeof items)[number]) => {
        try {
          const listings = await client.listCollectionListings({
            collection: item.collection,
            tokenId: item.tokenId,
            projectId: item.projectId,
            verifyOwnership: false,
          });
          return listings.some((listing) => listingMatchesCartItem(listing, item));
        } catch {
          return false;
        }
      };

      const validations = await Promise.all(
        items.map(async (item) => ({ item, isValid: await validateItem(item) })),
      );

      const invalidRows = validations.filter((entry) => !entry.isValid);
      if (invalidRows.length > 0) {
        invalidRows.forEach(({ item }) => {
          setItemError(item.orderId, STALE_LISTING_ERROR);
        });
        setCheckoutStatus({
          kind: "stale",
          tone: "error",
          message:
            "Checkout blocked due to stale listings. Remove stale rows or refresh them, then retry checkout.",
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
          effectiveFeeConfig.feeNum,
          effectiveFeeConfig.feeReceiver ?? CLIENT_FEE_RECEIVER,
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
        kind: "success",
        tone: "success",
        message: `Submitted checkout transaction: ${result.transaction_hash}`,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Checkout transaction failed.";
      setCheckoutStatus({
        kind: "error",
        tone: "error",
        message,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRefreshListing = async (item: (typeof items)[number]) => {
    if (!client) {
      setCheckoutStatus({
        kind: "error",
        tone: "error",
        message: "Marketplace client is not ready.",
      });
      return;
    }

    setRefreshingRows((state) => ({ ...state, [item.orderId]: true }));
    try {
      const listings = await client.listCollectionListings({
        collection: item.collection,
        tokenId: item.tokenId,
        projectId: item.projectId,
        verifyOwnership: false,
      });
      const isValid = listings.some((listing) => listingMatchesCartItem(listing, item));
      if (isValid) {
        clearItemError(item.orderId);
        setCheckoutStatus({
          kind: "success",
          tone: "success",
          message: "Listing is available again. Retry checkout.",
        });
        return;
      }

      setItemError(item.orderId, STALE_LISTING_ERROR);
      setCheckoutStatus({
        kind: "stale",
        tone: "error",
        message:
          "Listing is still stale or unavailable. Remove stale rows or refresh them, then retry checkout.",
      });
    } catch {
      setItemError(item.orderId, STALE_LISTING_ERROR);
      setCheckoutStatus({
        kind: "error",
        tone: "error",
        message: "Unable to refresh listing right now.",
      });
    } finally {
      setRefreshingRows((state) => {
        if (!(item.orderId in state)) {
          return state;
        }

        const next = { ...state };
        delete next[item.orderId];
        return next;
      });
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
              <div className="space-y-1">
                <p
                  className={
                    checkoutStatus.tone === "error"
                      ? "text-xs text-destructive"
                      : "text-xs text-primary"
                  }
                >
                  {checkoutStatus.message}
                </p>
                {checkoutStatus.kind === "stale" ? (
                  <Button
                    className="h-7 px-2 text-xs"
                    disabled={items.length === 0 || isSubmitting}
                    onClick={() => {
                      void handleCheckout();
                    }}
                    size="sm"
                    type="button"
                    variant="outline"
                  >
                    Retry checkout
                  </Button>
                ) : null}
              </div>
            ) : null}

            {items.length === 0 ? (
              <p className="text-sm text-muted-foreground">Cart is empty.</p>
            ) : (
              items.map((item) => (
                <div
                  key={item.orderId}
                  className="rounded-sm border border-border/70 p-3"
                  data-testid={`cart-item-${item.orderId}`}
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
                      {inlineErrors[item.orderId] ? "Remove stale" : "Remove"}
                    </Button>
                  </div>

                  {inlineErrors[item.orderId] ? (
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <p className="text-xs text-destructive">
                        {inlineErrors[item.orderId]}
                      </p>
                      <Button
                        className="h-7 px-2 text-xs"
                        disabled={
                          isSubmitting || refreshingRows[item.orderId] === true
                        }
                        onClick={() => {
                          void handleRefreshListing(item);
                        }}
                        size="sm"
                        type="button"
                        variant="outline"
                      >
                        {refreshingRows[item.orderId] ? "Refreshing..." : "Refresh listing"}
                      </Button>
                    </div>
                  ) : null}
                </div>
              ))
            )}
          </div>

          <SheetFooter>
            <div
              className="w-full space-y-1 rounded-sm border border-border/70 p-3 text-xs"
              data-testid="cart-summary"
            >
              <div className="flex items-center justify-between" data-testid="cart-summary-subtotal">
                <span className="text-muted-foreground">Subtotal</span>
                <span>{formatPriceForDisplay(subtotal.toString()) ?? subtotal.toString()}</span>
              </div>
              <div className="flex items-center justify-between" data-testid="cart-summary-marketplace-fee">
                <span className="text-muted-foreground">Marketplace Fee</span>
                <span>{formatPriceForDisplay(marketplaceFee.toString()) ?? marketplaceFee.toString()}</span>
              </div>
              <div className="flex items-center justify-between" data-testid="cart-summary-royalty">
                <span className="text-muted-foreground">Royalty Estimate</span>
                <span>{formatPriceForDisplay(royaltyEstimate.toString()) ?? royaltyEstimate.toString()}</span>
              </div>
              <div className="flex items-center justify-between font-medium" data-testid="cart-summary-total">
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
