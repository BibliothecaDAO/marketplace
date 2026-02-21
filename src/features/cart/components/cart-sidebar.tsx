"use client";

import { useEffect, useMemo, useState } from "react";
import { ArcadeProvider, NAMESPACE } from "@cartridge/arcade";
import { useMarketplaceClient } from "@cartridge/arcade/marketplace/react";
import { useAccount, useBalance } from "@starknet-react/core";
import Link from "next/link";
import { ShoppingCart, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  formatPriceForDisplay,
  buildExplorerTxUrl,
  getTokenSymbol,
} from "@/lib/marketplace/token-display";
import { TokenSymbol } from "@/components/ui/token-symbol";
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

// Fee receiver addresses split by currency
const CLIENT_FEE_RECEIVER_LORDS = "0x045c587318c9ebcf2fbe21febf288ee2e3597a21cd48676005a5770a50d433c5";
const CLIENT_FEE_RECEIVER_DEFAULT = "0x049fb4281d13e1f5f488540cd051e1507149e99cc2e22635101041ec5e4e4557";
const LORDS_TOKEN_ADDRESS = "0x0124aeb495b947201f5fac96fd1138e326ad86195b98df6dec9009158a533b49";

function clientFeeReceiverForCurrency(currency: string): string {
  return currency.toLowerCase() === LORDS_TOKEN_ADDRESS
    ? CLIENT_FEE_RECEIVER_LORDS
    : CLIENT_FEE_RECEIVER_DEFAULT;
}

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

function normalizeStatus(value: unknown): string | null {
  if (typeof value === "string" && value.trim().length > 0) {
    return value.trim().toLowerCase();
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    if (value === 1) return "placed";
    if (value === 2) return "canceled";
    if (value === 3) return "executed";
    if (value === 0) return "none";
    return null;
  }

  if (typeof value === "bigint") {
    if (value === BigInt(1)) return "placed";
    if (value === BigInt(2)) return "canceled";
    if (value === BigInt(3)) return "executed";
    if (value === BigInt(0)) return "none";
    return null;
  }

  const record = asRecord(value);
  if (!record) {
    return null;
  }

  return normalizeStatus(record.value ?? record.status ?? record.state);
}

function parseBoolLike(value: unknown): boolean | null {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    if (value === 0) return false;
    if (value === 1) return true;
  }

  if (typeof value === "bigint") {
    if (value === BigInt(0)) return false;
    if (value === BigInt(1)) return true;
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "0" || normalized === "0x0" || normalized === "false") {
      return false;
    }
    if (normalized === "1" || normalized === "0x1" || normalized === "true") {
      return true;
    }
  }

  return null;
}

function extractValidityFlag(value: unknown): boolean | null {
  const direct = parseBoolLike(value);
  if (direct !== null) {
    return direct;
  }

  if (Array.isArray(value) && value.length > 0) {
    return parseBoolLike(value[0]);
  }

  const record = asRecord(value);
  if (!record) {
    return null;
  }

  const keyed =
    parseBoolLike(record.valid) ??
    parseBoolLike(record.isValid) ??
    parseBoolLike(record.is_valid) ??
    parseBoolLike(record.value) ??
    parseBoolLike(record.result) ??
    parseBoolLike(record["0"]);
  if (keyed !== null) {
    return keyed;
  }

  for (const candidate of Object.values(record)) {
    const parsed = parseBoolLike(candidate);
    if (parsed !== null) {
      return parsed;
    }
    if (Array.isArray(candidate) && candidate.length > 0) {
      const nested = parseBoolLike(candidate[0]);
      if (nested !== null) {
        return nested;
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
  const expiration = firstNumberish([fields, nestedOrder], [
    "expiration",
    "expiresAt",
    "expires_at",
  ]);
  const currency = firstString([fields, nestedOrder], ["currency"]);
  const status =
    normalizeStatus(fields.status) ??
    normalizeStatus(fields.state) ??
    normalizeStatus(nestedOrder?.status) ??
    normalizeStatus(nestedOrder?.state);
  if (!orderId || !tokenId || !price || !currency) {
    return false;
  }
  if (status && status !== "placed") {
    return false;
  }
  if (expiration) {
    try {
      const expiry = BigInt(expiration);
      if (expiry > BigInt(0) && expiry <= BigInt(Math.floor(Date.now() / 1000))) {
        return false;
      }
    } catch {
      // Ignore malformed expiration values.
    }
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
  const cartCurrency = items[0]?.currency;
  const { data: walletBalanceData, isLoading: isBalanceLoading } = useBalance({
    address: account?.address as `0x${string}` | undefined,
    token: cartCurrency as `0x${string}` | undefined,
    enabled: !!account?.address && !!cartCurrency && isConnected,
  });
  const { client } = useMarketplaceClient();
  const { sdkConfig, chainLabel } = getMarketplaceRuntimeConfig();
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
    txHash?: string;
  }>({ kind: "idle", tone: "idle", message: "" });

  const effectiveFeeConfig = useMemo(
    () => ({
      feeNum: CLIENT_FEE_BPS,
      feeDenominator: CLIENT_FEE_DENOMINATOR,
      feeReceiver: marketplaceFeeConfig?.feeReceiver,
    }),
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
  const walletBalance = walletBalanceData?.value ?? BigInt(0);
  const hasInsufficientBalance =
    items.length > 0 &&
    isConnected &&
    !isBalanceLoading &&
    walletBalance < total;

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
      const validateOnChainValidity = async (item: (typeof items)[number]) => {
        try {
          const validityResult = await arcadeProvider.marketplace.getValidity(
            item.orderId,
            item.collection,
            item.tokenId,
          );
          return extractValidityFlag(validityResult) === true;
        } catch {
          return false;
        }
      };

      const validateItem = async (item: (typeof items)[number]) => {
        try {
          const listings = await client.listCollectionListings({
            collection: item.collection,
            tokenId: item.tokenId,
            projectId: item.projectId,
            verifyOwnership: true,
          });
          const hasMatchingListing = listings.some((listing) => listingMatchesCartItem(listing, item));
          if (!hasMatchingListing) {
            return false;
          }

          return await validateOnChainValidity(item);
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
          effectiveFeeConfig.feeReceiver ?? clientFeeReceiverForCurrency(item.currency),
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
        message: "Purchase complete!",
        txHash: result.transaction_hash,
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
        verifyOwnership: true,
      });
      const hasMatchingListing = listings.some((listing) => listingMatchesCartItem(listing, item));
      let isOnChainValid = false;
      if (hasMatchingListing) {
        try {
          const validityResult = await arcadeProvider.marketplace.getValidity(
            item.orderId,
            item.collection,
            item.tokenId,
          );
          isOnChainValid = extractValidityFlag(validityResult) === true;
        } catch {
          isOnChainValid = false;
        }
      }
      const isValid = hasMatchingListing && isOnChainValid;
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
        className="relative px-2"
      >
        <ShoppingCart className="h-4 w-4" />
        {items.length > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] font-medium text-primary-foreground">
            {items.length}
          </span>
        )}
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
                  {checkoutStatus.txHash ? (
                    <>
                      {" "}
                      <a
                        href={buildExplorerTxUrl(chainLabel, checkoutStatus.txHash)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline"
                      >
                        View transaction →
                      </a>
                    </>
                  ) : null}
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
              <div className="space-y-2 py-4 text-center">
                <p className="text-sm text-muted-foreground">Your cart is empty.</p>
                <Link
                  href="/"
                  className="text-sm text-primary hover:underline"
                >
                  Browse collections →
                </Link>
              </div>
            ) : (
              items.map((item) => {
                const hasError = !!inlineErrors[item.orderId];
                const detailHref = `/collections/${item.collection}/${item.tokenId}`;
                return (
                  <div
                    key={item.orderId}
                    className="group/item rounded-lg border border-border/50 p-2"
                    data-testid={`cart-item-${item.orderId}`}
                  >
                    <div className="flex gap-2.5">
                      <Link
                        className="shrink-0"
                        href={detailHref}
                        onClick={() => setOpen(false)}
                      >
                        <div className="h-14 w-14 overflow-hidden rounded-md bg-muted transition-opacity hover:opacity-80">
                          {item.tokenImage ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              alt={item.tokenName ?? `Token #${item.tokenId}`}
                              className="h-full w-full object-cover"
                              src={item.tokenImage}
                            />
                          ) : (
                            <span className="flex h-full w-full items-center justify-center text-[10px] text-muted-foreground">
                              NFT
                            </span>
                          )}
                        </div>
                      </Link>
                      <div className="min-w-0 flex-1 py-0.5">
                        <Link
                          className="group/link"
                          href={detailHref}
                          onClick={() => setOpen(false)}
                        >
                          <p className="truncate text-sm font-medium group-hover/link:underline">
                            {item.tokenName ?? `Token #${item.tokenId}`}
                          </p>
                        </Link>
                        <p className="text-xs text-muted-foreground">
                          #{item.tokenId}
                        </p>
                        <p className="mt-0.5 flex items-center gap-1 text-xs font-medium text-primary">
                          {formatPriceForDisplay(item.price) ?? item.price}
                          <TokenSymbol address={item.currency} className="text-muted-foreground" />
                        </p>
                      </div>
                      <Button
                        aria-label="Remove item"
                        className={hasError
                          ? "shrink-0 text-destructive hover:text-destructive"
                          : "shrink-0 opacity-0 transition-opacity group-hover/item:opacity-100"}
                        onClick={() => removeItem(item.orderId)}
                        size="icon-xs"
                        type="button"
                        variant="ghost"
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>

                    {hasError ? (
                      <div className="mt-1.5 flex items-center gap-2 rounded-md bg-destructive/10 px-2 py-1.5">
                        <p className="flex-1 text-xs text-destructive">
                          {inlineErrors[item.orderId]}
                        </p>
                        <Button
                          className="h-6 px-2 text-[11px]"
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
                          {refreshingRows[item.orderId] ? "Refreshing..." : "Refresh"}
                        </Button>
                      </div>
                    ) : null}
                  </div>
                );
              })
            )}
          </div>

          <SheetFooter>
            <div
              className="w-full space-y-1 rounded-sm border border-border/70 p-3 text-xs"
              data-testid="cart-summary"
            >
              {(() => {
                const CurrencyBadge = cartCurrency
                  ? () => <TokenSymbol address={cartCurrency} className="text-muted-foreground" />
                  : null;
                return (
                  <>
                    <div className="flex items-center justify-between" data-testid="cart-summary-subtotal">
                      <span className="text-muted-foreground">Subtotal</span>
                      <span className="flex items-center gap-1">
                        {formatPriceForDisplay(subtotal.toString()) ?? subtotal.toString()}
                        {CurrencyBadge ? <CurrencyBadge /> : null}
                      </span>
                    </div>
                    <div className="flex items-center justify-between" data-testid="cart-summary-marketplace-fee">
                      <span className="text-muted-foreground">Marketplace Fee</span>
                      <span className="flex items-center gap-1">
                        {formatPriceForDisplay(marketplaceFee.toString()) ?? marketplaceFee.toString()}
                        {CurrencyBadge ? <CurrencyBadge /> : null}
                      </span>
                    </div>
                    <div className="flex items-center justify-between" data-testid="cart-summary-royalty">
                      <span className="text-muted-foreground">Royalty Estimate</span>
                      <span className="flex items-center gap-1">
                        {formatPriceForDisplay(royaltyEstimate.toString()) ?? royaltyEstimate.toString()}
                        {CurrencyBadge ? <CurrencyBadge /> : null}
                      </span>
                    </div>
                    <div className="flex items-center justify-between font-medium" data-testid="cart-summary-total">
                      <span>Total</span>
                      <span className="flex items-center gap-1">
                        {formatPriceForDisplay(total.toString()) ?? total.toString()}
                        {CurrencyBadge ? <CurrencyBadge /> : null}
                      </span>
                    </div>
                  </>
                );
              })()}
            </div>
            {hasInsufficientBalance ? (
              <p className="text-xs text-destructive text-center" data-testid="cart-insufficient-balance">
                Insufficient {cartCurrency ? getTokenSymbol(cartCurrency) : ""} balance
              </p>
            ) : null}
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
                disabled={items.length === 0 || isSubmitting || hasInsufficientBalance}
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
