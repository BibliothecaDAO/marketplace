"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useMarketplaceClient } from "@/lib/marketplace/read-client";
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
import { useListAnimation } from "@/lib/animation";
import { createMarketplaceWriteAdapter } from "@/lib/marketplace/write-adapter";
import { evaluateCheckoutPreflight } from "@/features/cart/checkout-preflight";
import { waitForIndexedBlock } from "@/lib/marketplace/index-confirmation";

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
const OWN_LISTING_ERROR = "Cannot buy your own listing.";
const CHECKOUT_LOG_PREFIX = "[cart-checkout]";

type CheckoutDiagnosticsConfig = {
  debugEnabled: boolean;
};

function parseBooleanEnvFlag(value: string | undefined, fallback: boolean) {
  if (!value) {
    return fallback;
  }

  const normalized = value.trim().toLowerCase();
  if (normalized === "1" || normalized === "true" || normalized === "yes") {
    return true;
  }
  if (normalized === "0" || normalized === "false" || normalized === "no") {
    return false;
  }

  return fallback;
}

function getCheckoutDiagnosticsConfig(): CheckoutDiagnosticsConfig {
  return {
    debugEnabled: parseBooleanEnvFlag(
      process.env.NEXT_PUBLIC_MARKETPLACE_CHECKOUT_DEBUG,
      false,
    ),
  };
}

function logCheckoutDiagnostics(
  enabled: boolean,
  event: string,
  payload: Record<string, unknown>,
) {
  if (!enabled) {
    return;
  }

  console.info(`${CHECKOUT_LOG_PREFIX} ${event}`, payload);
}

function asRecord(value: unknown) {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : null;
}

const U128_MASK = (BigInt(1) << BigInt(128)) - BigInt(1);

function toUint256Calldata(amount: bigint): [string, string] {
  const low = (amount & U128_MASK).toString();
  const high = (amount >> BigInt(128)).toString();
  return [low, high];
}

function normalizeExecuteQuantity(quantity: string): string {
  const parsed = parseBigInt(quantity);
  if (parsed === null || parsed < BigInt(0)) {
    return "0";
  }

  return parsed.toString();
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
  const itemsRef = useRef<HTMLDivElement>(null);
  useListAnimation(itemsRef, {
    enterFrom: { opacity: 0, translateX: 20 },
    staggerDelay: 0,
  });

  const { account, isConnected } = useAccount();
  const cartCurrency = items[0]?.currency;
  const { data: walletBalanceData, isLoading: isBalanceLoading } = useBalance({
    address: account?.address as `0x${string}` | undefined,
    token: cartCurrency as `0x${string}` | undefined,
    enabled: !!account?.address && !!cartCurrency && isConnected,
  });
  const { client } = useMarketplaceClient(account);
  const runtimeConfig = getMarketplaceRuntimeConfig();
  const {
    chainId,
    chainLabel,
    marketplaceAddress,
    worldAddress,
  } = runtimeConfig;
  const checkoutRolloutEnabled = runtimeConfig.isReadSurfaceEnabled?.("checkout") ?? true;
  const { debugEnabled } = useMemo(
    () => getCheckoutDiagnosticsConfig(),
    [],
  );
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
  const [checkoutSafety, setCheckoutSafety] = useState<{
    safe: boolean;
    message: string;
  }>({ safe: false, message: "Checking marketplace safety..." });

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

  const writeAdapter = useMemo(
    () => createMarketplaceWriteAdapter(chainId),
    [chainId],
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
    async function refreshCheckoutSafety() {
      if (!checkoutRolloutEnabled) {
        setCheckoutSafety({
          safe: false,
          message: "Checkout has not reached the owned-read rollout stage.",
        });
        return;
      }
      try {
        const [book, indexer] = await Promise.all([
          client.book(),
          client.indexerStatus(),
        ]);
        if (disposed) return;
        const identityMatches =
          BigInt(indexer.meta.worldAddress) === BigInt(worldAddress) &&
          BigInt(indexer.meta.marketplaceAddress) === BigInt(marketplaceAddress);
        if (!identityMatches) {
          setCheckoutSafety({ safe: false, message: "Marketplace contract identity mismatch." });
        } else if (book.data.paused) {
          setCheckoutSafety({ safe: false, message: "Marketplace Book is paused." });
        } else if (indexer.data.lagBlocks > 2 || !indexer.data.safeForCheckout) {
          setCheckoutSafety({ safe: false, message: "Marketplace indexer is outside the checkout safety window." });
        } else {
          setCheckoutSafety({ safe: true, message: "" });
        }
      } catch {
        if (!disposed) {
          setCheckoutSafety({ safe: false, message: "Marketplace read API is unavailable." });
        }
      }
    }
    void refreshCheckoutSafety();
    const intervalId = window.setInterval(() => { void refreshCheckoutSafety(); }, 15_000);
    return () => {
      disposed = true;
      window.clearInterval(intervalId);
    };
  }, [checkoutRolloutEnabled, client, marketplaceAddress, worldAddress]);

  const itemsKey = useMemo(
    () => items.map((i) => `${i.orderId}:${i.price}`).join(","),
    [items],
  );

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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client, itemsKey]);

  const handleCheckout = async () => {
    logCheckoutDiagnostics(debugEnabled, "checkout.start", {
      itemCount: items.length,
      hasClient: !!client,
      isConnected,
      walletAddress: account?.address ?? null,
    });

    if (!account || !isConnected) {
      setCheckoutStatus({
        kind: "error",
        tone: "error",
        message: "Connect wallet before checkout.",
      });
      logCheckoutDiagnostics(debugEnabled, "checkout.blocked.wallet", {
        reason: "Wallet is not connected.",
      });
      return;
    }

    if (!checkoutSafety.safe) {
      setCheckoutStatus({
        kind: "error",
        tone: "error",
        message: checkoutSafety.message,
      });
      return;
    }

    if (!client) {
      setCheckoutStatus({
        kind: "error",
        tone: "error",
        message: "Marketplace client is not ready.",
      });
      logCheckoutDiagnostics(debugEnabled, "checkout.blocked.client", {
        reason: "Marketplace client is missing.",
      });
      return;
    }

    setIsSubmitting(true);
    clearInlineErrors();
    setCheckoutStatus({ kind: "idle", tone: "idle", message: "" });

    try {
      const [lookupResponse, bookResponse, indexerResponse] = await Promise.all([
        client.lookupOrders(items.map((item) => ({
          id: item.orderId,
          collection: item.collection,
          tokenId: item.tokenId,
        }))),
        client.book(),
        client.indexerStatus(),
      ]);
      const preflight = evaluateCheckoutPreflight({
        items,
        lookup: lookupResponse.data.orders,
        lookupMeta: lookupResponse.meta,
        book: bookResponse.data,
        indexer: indexerResponse.data,
        expectedWorldAddress: worldAddress,
        expectedMarketplaceAddress: marketplaceAddress,
        accountAddress: account.address,
      });
      if (!preflight.safe) {
        Object.entries(preflight.rowErrors).forEach(([orderId, message]) => {
          setItemError(orderId, message);
        });
        const hasOwnListingError = Object.values(preflight.rowErrors).some(
          (message) => message === OWN_LISTING_ERROR,
        );
        setCheckoutStatus({
          kind: hasOwnListingError
            ? "error"
            : Object.keys(preflight.rowErrors).length > 0
              ? "stale"
              : "error",
          tone: "error",
          message: preflight.globalError ?? (hasOwnListingError
            ? "Checkout blocked: cart contains your own listing. Remove it, then retry checkout."
            : "Checkout blocked due to stale listings. Remove stale rows or refresh them, then retry checkout."),
        });
        return;
      }

      const validateOnChainValidity = async (item: (typeof items)[number]) => {
        logCheckoutDiagnostics(debugEnabled, "validate.onchain.request", {
          orderId: item.orderId,
          collection: item.collection,
          tokenId: item.tokenId,
        });
        try {
          const isValid = await writeAdapter.isOrderValid({
            id: item.orderId,
            collection: item.collection,
            tokenId: item.tokenId,
          });
          logCheckoutDiagnostics(debugEnabled, "validate.onchain.response", {
            orderId: item.orderId,
            isValid,
          });
          return isValid;
        } catch (error) {
          logCheckoutDiagnostics(debugEnabled, "validate.onchain.error", {
            orderId: item.orderId,
            message: error instanceof Error ? error.message : "Unknown error",
          });
          return false;
        }
      };

      type ValidationResult = {
        item: (typeof items)[number];
        isValid: boolean;
      };

      const validateItem = async (
        item: (typeof items)[number],
      ): Promise<ValidationResult> => {
        try {
          const isOnChainValid = await validateOnChainValidity(item);
          return {
            item,
            isValid: isOnChainValid,
          };
        } catch (error) {
          logCheckoutDiagnostics(debugEnabled, "validate.item.error", {
            orderId: item.orderId,
            message: error instanceof Error ? error.message : "Unknown error",
          });
          return { item, isValid: false };
        }
      };

      const validations: ValidationResult[] = await Promise.all(
        items.map((item) => validateItem(item)),
      );

      const invalidRows = validations.filter((entry) => !entry.isValid);
      logCheckoutDiagnostics(debugEnabled, "checkout.validation.summary", {
        validations: validations.map(({ item, isValid }) => ({
          orderId: item.orderId,
          tokenId: item.tokenId,
          isValid,
        })),
      });
      if (invalidRows.length > 0) {
        logCheckoutDiagnostics(debugEnabled, "checkout.blocked.stale", {
          invalidRows: invalidRows.map(({ item }) => ({
            orderId: item.orderId,
            reason: "stale",
          })),
        });
        invalidRows.forEach(({ item }) => {
          setItemError(item.orderId, STALE_LISTING_ERROR);
        });
        setCheckoutStatus({
          kind: "stale",
          tone: "error",
          message: "Checkout blocked due to stale listings. Remove stale rows or refresh them, then retry checkout.",
        });
        return;
      }

      const marketplaceContractAddress = marketplaceAddress;
      if (!marketplaceContractAddress) {
        setCheckoutStatus({
          kind: "error",
          tone: "error",
          message: "Marketplace contract address is unavailable for checkout.",
        });
        logCheckoutDiagnostics(debugEnabled, "checkout.blocked.approval", {
          reason: "Marketplace contract address could not be resolved.",
        });
        return;
      }

      if (!cartCurrency) {
        setCheckoutStatus({
          kind: "error",
          tone: "error",
          message: "Cart currency is unavailable for checkout.",
        });
        logCheckoutDiagnostics(debugEnabled, "checkout.blocked.approval", {
          reason: "Cart currency missing.",
        });
        return;
      }

      const executeCalls = items.map((item) => {
        const executeQuantity = normalizeExecuteQuantity(item.quantity);
        const clientReceiver =
          effectiveFeeConfig.feeReceiver ?? clientFeeReceiverForCurrency(item.currency);
        logCheckoutDiagnostics(debugEnabled, "checkout.execute.calldata", {
          orderId: item.orderId,
          collection: item.collection,
          tokenId: item.tokenId,
          currency: item.currency,
          quantity: executeQuantity,
          royalties: true,
          clientFee: effectiveFeeConfig.feeNum,
          clientReceiver,
        });
        const tokenIdBigInt = BigInt(item.tokenId);
        const [tokenIdLow, tokenIdHigh] = toUint256Calldata(tokenIdBigInt);
        return {
          contractAddress: marketplaceContractAddress,
          entrypoint: "execute",
          calldata: [
            item.orderId,
            item.collection,
            tokenIdLow, tokenIdHigh,
            tokenIdLow, tokenIdHigh,
            executeQuantity,
            "1",
            effectiveFeeConfig.feeNum.toString(),
            clientReceiver,
          ],
        };
      });
      const approvalSpenderAddress = marketplaceContractAddress;

      const approveCalls: Array<{
        contractAddress: string;
        entrypoint: string;
        calldata: string[];
      }> = [];
      const approvalAmount = total;
      if (approvalAmount > BigInt(0)) {
        const [amountLow, amountHigh] = toUint256Calldata(approvalAmount);
        logCheckoutDiagnostics(debugEnabled, "checkout.approve.calldata", {
          currency: cartCurrency,
          spender: approvalSpenderAddress,
          amount: approvalAmount.toString(),
          subtotal: subtotal.toString(),
          marketplaceFee: marketplaceFee.toString(),
          royaltyEstimate: royaltyEstimate.toString(),
          total: total.toString(),
          amountLow,
          amountHigh,
          mode: "set",
        });
        approveCalls.push({
          contractAddress: cartCurrency,
          entrypoint: "approve",
          calldata: [approvalSpenderAddress, amountLow, amountHigh],
        });
      }

      const txCalls = [...approveCalls, ...executeCalls];
      logCheckoutDiagnostics(debugEnabled, "checkout.execute.request", {
        callCount: txCalls.length,
      });
      logCheckoutDiagnostics(debugEnabled, "checkout.execute.calls", {
        calls: txCalls.map((call) => ({
          contractAddress: "contractAddress" in call ? call.contractAddress : null,
          contractName: "contractName" in call ? call.contractName : null,
          entrypoint: call.entrypoint,
          calldata: call.calldata,
        })),
      });
      const result = await account.execute(txCalls);
      logCheckoutDiagnostics(debugEnabled, "checkout.execute.success", {
        txHash: result.transaction_hash,
        callCount: txCalls.length,
      });
      const waitForTransaction = (account as unknown as {
        waitForTransaction?: (transactionHash: string) => Promise<unknown>;
      }).waitForTransaction?.bind(account);
      if (!waitForTransaction) {
        setCheckoutStatus({
          kind: "success",
          tone: "success",
          message: "Transaction submitted; waiting for onchain confirmation.",
          txHash: result.transaction_hash,
        });
        return;
      }
      let receipt: unknown;
      try {
        receipt = await waitForTransaction(result.transaction_hash);
      } catch {
        setCheckoutStatus({
          kind: "success",
          tone: "success",
          message: "Transaction submitted; confirmation is still pending.",
          txHash: result.transaction_hash,
        });
        return;
      }
      const receiptRecord = asRecord(receipt);
      const receiptBlock = Number(
        receiptRecord?.block_number ?? receiptRecord?.blockNumber,
      );
      clearCart();
      if (Number.isSafeInteger(receiptBlock) && receiptBlock >= 0) {
        const confirmation = await waitForIndexedBlock({
          receiptBlock,
          getIndexedBlock: async () => (await client.indexerStatus()).data.indexedBlock,
        });
        setCheckoutStatus({
          kind: "success",
          tone: "success",
          message: confirmation.indexed
            ? "Purchase confirmed and indexed."
            : "Confirmed onchain, still indexing.",
          txHash: result.transaction_hash,
        });
        return;
      }
      setCheckoutStatus({
        kind: "success",
        tone: "success",
        message: "Purchase confirmed onchain.",
        txHash: result.transaction_hash,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Checkout transaction failed.";
      logCheckoutDiagnostics(debugEnabled, "checkout.execute.error", {
        message,
      });
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
      const [lookupResponse, bookResponse, indexerResponse] = await Promise.all([
        client.lookupOrders([{ id: item.orderId, collection: item.collection, tokenId: item.tokenId }]),
        client.book(),
        client.indexerStatus(),
      ]);
      const preflight = evaluateCheckoutPreflight({
        items: [item],
        lookup: lookupResponse.data.orders,
        lookupMeta: lookupResponse.meta,
        book: bookResponse.data,
        indexer: indexerResponse.data,
        expectedWorldAddress: worldAddress,
        expectedMarketplaceAddress: marketplaceAddress,
        accountAddress: account?.address ?? "0x0",
      });
      const rowError = preflight.rowErrors[item.orderId];
      const isOwnListing = rowError === OWN_LISTING_ERROR;
      const hasMatchingListing = preflight.safe;
      let isOnChainValid = false;
      if (hasMatchingListing && !isOwnListing) {
        try {
          isOnChainValid = await writeAdapter.isOrderValid({
            id: item.orderId,
            collection: item.collection,
            tokenId: item.tokenId,
          });
          logCheckoutDiagnostics(debugEnabled, "refresh.onchain.response", {
            orderId: item.orderId,
            isOnChainValid,
          });
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

      setItemError(
        item.orderId,
        rowError ?? preflight.globalError ?? STALE_LISTING_ERROR,
      );
      setCheckoutStatus({
        kind: isOwnListing ? "error" : "stale",
        tone: "error",
        message: isOwnListing
          ? "This row is your own listing and cannot be purchased. Remove it, then retry checkout."
          : preflight.globalError ??
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
        className="relative px-2 hover:bg-accent hover:text-accent-foreground"
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
              <div ref={itemsRef} className="space-y-3">
              {items.map((item) => {
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
              })}
              </div>
            )}
          </div>

          <SheetFooter>
            <div
              className="w-full space-y-1 rounded-sm border border-border/70 p-3 text-xs"
              data-testid="cart-summary"
            >
              <div className="flex items-center justify-between" data-testid="cart-summary-subtotal">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="flex items-center gap-1">
                  {formatPriceForDisplay(subtotal.toString()) ?? subtotal.toString()}
                  {cartCurrency ? <TokenSymbol address={cartCurrency} className="text-muted-foreground" /> : null}
                </span>
              </div>
              <div className="flex items-center justify-between" data-testid="cart-summary-marketplace-fee">
                <span className="text-muted-foreground">Marketplace Fee</span>
                <span className="flex items-center gap-1">
                  {formatPriceForDisplay(marketplaceFee.toString()) ?? marketplaceFee.toString()}
                  {cartCurrency ? <TokenSymbol address={cartCurrency} className="text-muted-foreground" /> : null}
                </span>
              </div>
              <div className="flex items-center justify-between" data-testid="cart-summary-royalty">
                <span className="text-muted-foreground">Royalty Estimate</span>
                <span className="flex items-center gap-1">
                  {formatPriceForDisplay(royaltyEstimate.toString()) ?? royaltyEstimate.toString()}
                  {cartCurrency ? <TokenSymbol address={cartCurrency} className="text-muted-foreground" /> : null}
                </span>
              </div>
              <div className="flex items-center justify-between font-medium" data-testid="cart-summary-total">
                <span>Total</span>
                <span className="flex items-center gap-1">
                  {formatPriceForDisplay(total.toString()) ?? total.toString()}
                  {cartCurrency ? <TokenSymbol address={cartCurrency} className="text-muted-foreground" /> : null}
                </span>
              </div>
            </div>
            {hasInsufficientBalance ? (
              <p className="text-xs text-destructive text-center" data-testid="cart-insufficient-balance">
                Insufficient {cartCurrency ? getTokenSymbol(cartCurrency) : ""} balance
              </p>
            ) : null}
            {!checkoutSafety.safe && items.length > 0 ? (
              <p className="text-xs text-destructive text-center" data-testid="cart-checkout-safety">
                {checkoutSafety.message}
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
                disabled={
                  items.length === 0 ||
                  isSubmitting ||
                  hasInsufficientBalance ||
                  !checkoutSafety.safe
                }
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
