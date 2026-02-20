"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useAccount } from "@starknet-react/core";
import type { NormalizedToken } from "@cartridge/arcade/marketplace";
import { useMarketplaceClient } from "@cartridge/arcade/marketplace/react";
import {
  useCollectionListingsQuery,
  useTokenDetailQuery,
} from "@/lib/marketplace/hooks";
import { useTokenOwnership } from "@/features/token/use-token-ownership";
import { getMarketplaceRuntimeConfig } from "@/lib/marketplace/config";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  displayTokenId,
  formatNumberish,
  formatPriceForDisplay,
  buildExplorerTxUrl,
  formatRelativeExpiry,
  getTokenSymbol,
} from "@/lib/marketplace/token-display";
import { calculateMarketplaceFee, parseBigInt } from "@/lib/marketplace/fees";
import type { CheapestListing } from "@/features/cart/listing-utils";
import {
  cartItemFromTokenListing,
  cheapestListingByTokenId,
} from "@/features/cart/listing-utils";
import { useAddToCartFeedback } from "@/features/cart/hooks/use-add-to-cart-feedback";
import { TokenSymbol } from "@/components/ui/token-symbol";


type TokenDetailViewProps = {
  address: string;
  tokenId: string;
  projectId?: string;
};

type TokenAttribute = {
  trait_type: string;
  value: string;
};

type TokenMetadata = {
  name?: string;
  attributes?: TokenAttribute[];
  image?: string;
  image_url?: string;
};

type ListingRow = {
  id: number;
  tokenId?: number | string;
  quantity?: number | string;
  price: number | string;
  currency?: string;
  owner: string;
  expiration?: number | string;
};

function getTokenName(token: NormalizedToken) {
  const meta = token.metadata as TokenMetadata | null;
  const name = meta?.name;
  return typeof name === "string" && name.trim()
    ? name
    : `Token #${String(token.token_id ?? "unknown")}`;
}

function getTokenImage(token: NormalizedToken) {
  if (token.image) return token.image;
  const meta = token.metadata as TokenMetadata | null;
  const source = meta?.image ?? meta?.image_url;
  return typeof source === "string" && source.length > 0 ? source : null;
}

function getTokenAttributes(token: NormalizedToken): TokenAttribute[] {
  const meta = token.metadata as TokenMetadata | null;
  return Array.isArray(meta?.attributes) ? meta.attributes : [];
}

function truncateAddress(addr: string) {
  return addr.length > 14 ? addr.slice(0, 6) + "..." + addr.slice(-4) : addr;
}

function parseExpiration(value: ListingRow["expiration"]) {
  const normalized = formatNumberish(value);
  if (!normalized) {
    return null;
  }

  try {
    return Number(BigInt(normalized));
  } catch {
    return null;
  }
}

function isExpiredListing(listing: ListingRow, nowEpochSeconds: number) {
  const expiration = parseExpiration(listing.expiration);
  if (!expiration || expiration <= 0) {
    return false;
  }

  return expiration <= nowEpochSeconds;
}

// Arcade Marketplace contract address (same on SN_MAIN and SN_SEPOLIA per SDK manifest)
const MARKETPLACE_CONTRACT = "0x6bbf16b6c67b1bef27a187b499b2f3a14af31646c2c90d64f11b9087c3f527c";
// Supported listing currencies
const STRK_ADDRESS = "0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d";
const LORDS_ADDRESS = "0x0124aeb495b947201f5fac96fd1138e326ad86195b98df6dec9009158a533b49";
const SURVIVOR_ADDRESS = "0x42dd777885ad2c116be96d4d634abc90a26a790ffb5871e037dd5ae7d2ec86b";
const DEFAULT_MARKETPLACE_FEE_NUM = 500;
const DEFAULT_MARKETPLACE_FEE_DENOMINATOR = 10_000;

export function TokenDetailView({
  address,
  tokenId,
  projectId,
}: TokenDetailViewProps) {
  const normalizedTokenId = formatNumberish(tokenId) ?? tokenId;
  const { addListingToCart, isRecentlyAdded } = useAddToCartFeedback();
  const { account, address: walletAddress, isConnected } = useAccount();
  const { client } = useMarketplaceClient();
  const { collections, chainLabel } = getMarketplaceRuntimeConfig();
  const collectionName = collections.find((c) => c.address === address)?.name ?? address;
  const verifyOwnership = false;
  // Human-readable price in STRK (1 STRK = 1e18 wei)
  const [priceInput, setPriceInput] = useState("1");
  const [quantityInput, setQuantityInput] = useState("1");
  const [currencyInput, setCurrencyInput] = useState(LORDS_ADDRESS);
  // Expiration as a preset duration in seconds (default: 24 hours)
  const [expirationPreset, setExpirationPreset] = useState("86400");
  const [txStatus, setTxStatus] = useState<{
    tone: "idle" | "success" | "error";
    message: string;
    txHash?: string;
  }>({ tone: "idle", message: "" });
  const [pendingAction, setPendingAction] = useState<
    "list" | "offer" | "cancel" | null
  >(null);
  const [feeEstimate, setFeeEstimate] = useState<{
    status: "loading" | "empty" | "error" | "success";
    marketplaceFee: bigint;
    royaltyFee: bigint;
    total: bigint;
  }>({
    status: "empty",
    marketplaceFee: BigInt(0),
    royaltyFee: BigInt(0),
    total: BigInt(0),
  });
  const detailQuery = useTokenDetailQuery({
    collection: address,
    tokenId: normalizedTokenId,
    projectId,
    fetchImages: true,
  });
  const listingQuery = useCollectionListingsQuery({
    collection: address,
    tokenId: normalizedTokenId,
    projectId,
    verifyOwnership,
  });
  const nowEpochSeconds = Math.floor(Date.now() / 1000);

  const { holderAddress, isOwner, effectiveIsOwner, ownershipQuery } = useTokenOwnership({
    collection: address,
    tokenId: normalizedTokenId,
    walletAddress,
    isConnected: isConnected ?? false,
  });

  const token = detailQuery.data?.token ?? null;
  const rawListings = useMemo(
    () => listingQuery.data ?? detailQuery.data?.listings ?? [],
    [detailQuery.data?.listings, listingQuery.data],
  );
  const listingRows = useMemo(
    () =>
      (rawListings as ListingRow[]).filter(
        (listing) => !isExpiredListing(listing, nowEpochSeconds),
      ),
    [nowEpochSeconds, rawListings],
  );
  const cheapestListings = useMemo(
    () => cheapestListingByTokenId(listingRows as unknown[]),
    [listingRows],
  );
  const cheapestListing = useMemo(() => {
    if (!token) {
      return null;
    }

    return cheapestListings.get(displayTokenId(token)) ?? null;
  }, [cheapestListings, token]);
  const ownListing = useMemo(() => {
    if (!walletAddress) return null;
    return (
      listingRows.find(
        (listing) => listing.owner.toLowerCase() === walletAddress.toLowerCase(),
      ) ?? null
    );
  }, [listingRows, walletAddress]);
  const isCheapestAdded = isRecentlyAdded(cheapestListing?.orderId);
  // True when the user's own listing happens to be the cheapest
  const isOwnCheapest = !!(ownListing && cheapestListing?.orderId === String(ownListing.id));

  useEffect(() => {
    let disposed = false;

    async function loadFeeEstimate() {
      if (!cheapestListing || !token) {
        setFeeEstimate({
          status: "empty",
          marketplaceFee: BigInt(0),
          royaltyFee: BigInt(0),
          total: BigInt(0),
        });
        return;
      }

      const listingPrice = parseBigInt(cheapestListing.price);
      if (listingPrice === null) {
        setFeeEstimate({
          status: "error",
          marketplaceFee: BigInt(0),
          royaltyFee: BigInt(0),
          total: BigInt(0),
        });
        return;
      }

      setFeeEstimate((current) => ({
        ...current,
        status: "loading",
      }));

      try {
        const fees =
          client && typeof client.getFees === "function"
            ? await client.getFees()
            : null;
        const marketplaceFee = calculateMarketplaceFee(listingPrice, {
          feeNum: fees?.feeNum ?? DEFAULT_MARKETPLACE_FEE_NUM,
          feeDenominator: fees?.feeDenominator ?? DEFAULT_MARKETPLACE_FEE_DENOMINATOR,
        });

        let royaltyResponse = null;
        if (client && typeof client.getRoyaltyFee === "function") {
          try {
            royaltyResponse = await client.getRoyaltyFee({
              collection: address,
              tokenId: formatNumberish(token.token_id) ?? String(token.token_id),
              amount: listingPrice,
            });
          } catch {
            // royalties not configured for this collection — treat as 0
          }
        }

        if (disposed) {
          return;
        }

        const royaltyFee = royaltyResponse?.amount ?? BigInt(0);
        setFeeEstimate({
          status: "success",
          marketplaceFee,
          royaltyFee,
          total: listingPrice + royaltyFee,
        });
      } catch {
        if (!disposed) {
          setFeeEstimate({
            status: "error",
            marketplaceFee: BigInt(0),
            royaltyFee: BigInt(0),
            total: BigInt(0),
          });
        }
      }
    }

    void loadFeeEstimate();

    return () => {
      disposed = true;
    };
  }, [address, cheapestListing, client, token]);

  // If existing listings use a specific currency, adopt it (otherwise keep STRK default).
  useEffect(() => {
    const listedCurrency = listingRows.find(
      (listing) =>
        typeof listing.currency === "string" &&
        listing.currency.trim().length > 0 &&
        listing.currency !== "0x0",
    )?.currency;
    if (listedCurrency) {
      setCurrencyInput(listedCurrency);
    }
  }, [listingRows]);

  // Convert human-readable STRK price to wei string
  function priceToWei(humanPrice: string): string {
    return String(BigInt(Math.round(parseFloat(humanPrice) * 1e18)));
  }

  // Compute expiration unix timestamp from preset duration
  function computeExpiration(): string {
    return String(Math.floor(Date.now() / 1000) + parseInt(expirationPreset));
  }

  async function runTransaction(
    action: "list" | "offer" | "cancel",
    executor: () => Promise<{ transaction_hash: string }>,
  ) {
    if (!account) {
      setTxStatus({
        tone: "error",
        message: "Connect wallet before submitting transactions.",
      });
      return;
    }

    setPendingAction(action);
    setTxStatus({ tone: "idle", message: "" });

    try {
      const result = await executor();
      setTxStatus({
        tone: "success",
        message: `Transaction submitted`,
        txHash: result.transaction_hash,
      });
      await Promise.all([listingQuery.refetch(), detailQuery.refetch()]);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Transaction failed.";
      setTxStatus({ tone: "error", message });
    } finally {
      setPendingAction(null);
    }
  }

  // Auto-clear tx status messages after 5 seconds
  useEffect(() => {
    if (txStatus.tone === "idle") return;
    const id = window.setTimeout(
      () => setTxStatus({ tone: "idle", message: "" }),
      5000,
    );
    return () => window.clearTimeout(id);
  }, [txStatus.tone, txStatus.message]);

  if (detailQuery.isLoading) {
    return (
      <div className="grid gap-6 lg:grid-cols-2">
        <Skeleton
          className="aspect-square w-full"
          data-testid="token-detail-skeleton"
        />
        <div className="space-y-4">
          <Skeleton
            className="h-8 w-2/3"
            data-testid="token-detail-skeleton"
          />
          <Skeleton
            className="h-4 w-1/3"
            data-testid="token-detail-skeleton"
          />
        </div>
      </div>
    );
  }

  if (!token) {
    return (
      <Card className="border-dashed">
        <CardContent className="pt-6 text-sm text-muted-foreground">
          Token not found.
        </CardContent>
      </Card>
    );
  }

  const name = getTokenName(token);
  const image = getTokenImage(token);
  const attributes = getTokenAttributes(token);

  return (
    <div className="space-y-8">
      {/* Breadcrumbs */}
      <nav aria-label="breadcrumb">
        <ol className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <li>
            <Link href="/" className="hover:text-foreground transition-colors">Home</Link>
          </li>
          <li aria-hidden>/</li>
          <li>
            <Link href={`/collections/${address}`} className="hover:text-foreground transition-colors">
              {collectionName}
            </Link>
          </li>
          <li aria-hidden>/</li>
          <li className="text-foreground truncate max-w-[200px]">{name}</li>
        </ol>
      </nav>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Token image */}
        <div className="flex aspect-square items-center justify-center bg-muted">
          {image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              alt={name}
              className="h-full w-full object-cover"
              src={image}
            />
          ) : (
            <span className="text-sm text-muted-foreground">No Image</span>
          )}
        </div>

        {/* Token details */}
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-bold tracking-wide">{name}</h1>
            <p className="text-sm text-primary font-mono">
              #{displayTokenId(token)}
            </p>
            {holderAddress ? (
              <Link
                href={`/profile/${holderAddress}`}
                aria-label="owner"
                className="mt-1 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <span className="uppercase tracking-wide">Owner</span>
                <span className="font-mono">{truncateAddress(holderAddress)}</span>
              </Link>
            ) : null}
          </div>

          {/* Action block — list for sale (owner) or buy (non-owner) */}
          {listingQuery.isLoading ? (
            <Skeleton className="h-16 w-full" />
          ) : isConnected && effectiveIsOwner ? (
            <div className="rounded-sm border border-border bg-muted/20 px-4 py-3 space-y-3">
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground">List for sale</p>
              {ownListing ? (
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-muted-foreground">
                    Active: {formatPriceForDisplay(String(ownListing.price)) ?? String(ownListing.price)}{" "}
                    {ownListing.currency ? getTokenSymbol(ownListing.currency) : ""}
                  </span>
                  <Button
                    className="h-6 px-2 text-xs"
                    disabled={pendingAction !== null}
                    onClick={() => {
                      void runTransaction("cancel", () => {
                        const big = BigInt(normalizedTokenId);
                        const low = (big & BigInt("0xffffffffffffffffffffffffffffffff")).toString();
                        const high = (big >> BigInt(128)).toString();
                        return account!.execute([{
                          contractAddress: MARKETPLACE_CONTRACT,
                          entrypoint: "cancel",
                          calldata: [String(ownListing.id), address, low, high],
                        }]);
                      });
                    }}
                    size="sm"
                    type="button"
                    variant="destructive"
                  >
                    {pendingAction === "cancel" ? "Cancelling..." : "Cancel"}
                  </Button>
                </div>
              ) : null}
              <div className="flex gap-2">
                <Input
                  aria-label="Price"
                  className="flex-1"
                  min="0"
                  onChange={(e) => setPriceInput(e.target.value)}
                  placeholder="Price"
                  step="any"
                  type="number"
                  value={priceInput}
                />
                <Select onValueChange={setCurrencyInput} value={currencyInput}>
                  <SelectTrigger aria-label="Currency" className="w-28">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={STRK_ADDRESS}>STRK</SelectItem>
                    <SelectItem value={LORDS_ADDRESS}>LORDS</SelectItem>
                    <SelectItem value={SURVIVOR_ADDRESS}>SURVIVO</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Select onValueChange={setExpirationPreset} value={expirationPreset}>
                <SelectTrigger aria-label="Expires in">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="3600">Expires in 1 hour</SelectItem>
                  <SelectItem value="86400">Expires in 24 hours</SelectItem>
                  <SelectItem value="604800">Expires in 7 days</SelectItem>
                  <SelectItem value="2592000">Expires in 30 days</SelectItem>
                </SelectContent>
              </Select>
              <Button
                className="w-full"
                disabled={pendingAction !== null}
                onClick={() => {
                  void runTransaction("list", () => {
                    const tokenBig = BigInt(normalizedTokenId);
                    const tokenLow = (tokenBig & BigInt("0xffffffffffffffffffffffffffffffff")).toString();
                    const tokenHigh = (tokenBig >> BigInt(128)).toString();
                    return account!.execute([
                      {
                        // Approve marketplace to transfer all tokens in this collection
                        contractAddress: address,
                        entrypoint: "set_approval_for_all",
                        calldata: [MARKETPLACE_CONTRACT, "1"],
                      },
                      {
                        contractAddress: MARKETPLACE_CONTRACT,
                        entrypoint: "list",
                        // ERC721: quantity must be 0 (contract checks value==0 for ERC721 validity)
                        // price is u128 (1 felt), token_id is u256 (2 felts), royalties is bool
                        calldata: [address, tokenLow, tokenHigh, "0", priceToWei(priceInput), currencyInput, computeExpiration(), "1"],
                      },
                    ]);
                  });
                }}
                size="sm"
                type="button"
              >
                {pendingAction === "list" ? "Listing..." : "List for sale"}
              </Button>
              {txStatus.message ? (
                <p className={txStatus.tone === "error" ? "text-xs text-destructive" : "text-xs text-primary"}>
                  {txStatus.message}
                  {txStatus.txHash ? (
                    <>{" "}<a href={buildExplorerTxUrl(chainLabel, txStatus.txHash)} target="_blank" rel="noopener noreferrer" className="underline">View on Starkscan →</a></>
                  ) : null}
                </p>
              ) : null}
            </div>
          ) : cheapestListing ? (
            <div className="flex items-center justify-between gap-4 rounded-sm border border-border bg-muted/20 px-4 py-3">
              <div>
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-0.5">Best price</p>
                <p className="text-xl font-bold flex items-center gap-1.5">
                  {formatPriceForDisplay(cheapestListing.price) ?? cheapestListing.price}
                  <TokenSymbol address={cheapestListing.currency} className="text-sm font-normal text-muted-foreground" />
                </p>
              </div>
              <Button
                onClick={() => {
                  if (!token || !cheapestListing) return;
                  addListingToCart(cartItemFromTokenListing(token, address, cheapestListing, projectId));
                }}
                size="sm"
                type="button"
                variant={isCheapestAdded ? "default" : "outline"}
              >
                {isCheapestAdded ? "Added" : "Add to cart"}
              </Button>
            </div>
          ) : null}

          {/* Attributes */}
          {attributes.length > 0 ? (
            <div className="space-y-2">
              <h2 className="text-sm font-medium tracking-widest uppercase text-muted-foreground">Attributes</h2>
              <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                {attributes.map((attr) => {
                  const params = new URLSearchParams();
                  params.append("trait", `${attr.trait_type}:${attr.value}`);
                  return (
                    <Link
                      key={`${attr.trait_type}-${attr.value}`}
                      href={`/collections/${address}?${params.toString()}`}
                      aria-label={`${attr.trait_type} ${attr.value}`}
                      className="rounded border border-border/60 bg-muted/30 px-2 py-1.5 hover:border-primary/40 hover:bg-muted/60 transition-colors"
                    >
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wide leading-none mb-0.5">
                        {attr.trait_type}
                      </p>
                      <p className="text-xs font-medium text-primary truncate">{attr.value}</p>
                    </Link>
                  );
                })}
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {/* Listings section */}
      <div className="space-y-3">
        {!effectiveIsOwner ? (
        <Card className="border-dashed" data-testid="token-fee-card">
          <CardContent className="space-y-2 p-3">
            <h2 className="text-sm font-medium tracking-widest uppercase text-muted-foreground">
              Purchase estimate
            </h2>
            {feeEstimate.status === "loading" ? (
              <p className="text-xs text-muted-foreground" data-testid="token-fee-loading">
                Loading fee estimate...
              </p>
            ) : null}
            {feeEstimate.status === "empty" ? (
              <p className="text-xs text-muted-foreground" data-testid="token-fee-empty">
                No active listing available for estimate.
              </p>
            ) : null}
            {feeEstimate.status === "error" ? (
              <p className="text-xs text-destructive" data-testid="token-fee-error">
                Fee estimate unavailable. Try refreshing listings.
              </p>
            ) : null}
            {feeEstimate.status === "success" ? (
              <div className="space-y-1 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Marketplace fee</span>
                  <span data-testid="token-fee-marketplace" className="flex items-center gap-1">
                    {formatPriceForDisplay(feeEstimate.marketplaceFee.toString()) ?? feeEstimate.marketplaceFee.toString()}
                    <span className="text-muted-foreground">{getTokenSymbol(currencyInput)}</span>
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Royalty estimate</span>
                  <span data-testid="token-fee-royalty" className="flex items-center gap-1">
                    {formatPriceForDisplay(feeEstimate.royaltyFee.toString()) ?? feeEstimate.royaltyFee.toString()}
                    <span className="text-muted-foreground">{getTokenSymbol(currencyInput)}</span>
                  </span>
                </div>
                <div className="flex items-center justify-between font-medium">
                  <span>Total estimate</span>
                  <span data-testid="token-fee-total" className="flex items-center gap-1">
                    {formatPriceForDisplay(feeEstimate.total.toString()) ?? feeEstimate.total.toString()}
                    <span className="text-muted-foreground">{getTokenSymbol(currencyInput)}</span>
                  </span>
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>
        ) : null}

        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-medium tracking-widest uppercase text-muted-foreground">Listings</h2>
          <div className="flex items-center gap-2">
            <Button
              disabled={!cheapestListing || isOwnCheapest}
              onClick={() => {
                if (!token || !cheapestListing || isOwnCheapest) {
                  return;
                }

                addListingToCart(
                  cartItemFromTokenListing(token, address, cheapestListing, projectId),
                );
              }}
              size="sm"
              type="button"
              variant={isCheapestAdded ? "default" : "outline"}
            >
              {isCheapestAdded ? "Added" : "Add cheapest to cart"}
            </Button>
            <Button
              disabled={listingQuery.isFetching}
              onClick={() => {
                void listingQuery.refetch();
              }}
              size="sm"
              type="button"
              variant="ghost"
            >
              Refresh listings
            </Button>
          </div>
        </div>


        {/* Offer form — shown to confirmed non-owners */}
        {isConnected && !effectiveIsOwner && !(ownershipQuery as { isLoading?: boolean }).isLoading ? (
          <Card className="border-dashed">
            <CardContent className="space-y-3 p-3">
              <h2 className="text-sm font-medium tracking-widest uppercase text-muted-foreground">Make an offer</h2>
              <div className="grid gap-2 sm:grid-cols-2">
                <div className="flex items-center gap-1">
                  <Input
                    aria-label={`Price (${getTokenSymbol(currencyInput)})`}
                    min="0"
                    onChange={(event) => setPriceInput(event.target.value)}
                    placeholder="Price"
                    step="any"
                    type="number"
                    value={priceInput}
                  />
                  <span className="text-sm text-muted-foreground shrink-0">{getTokenSymbol(currencyInput)}</span>
                </div>
                <Input
                  aria-label="Quantity"
                  onChange={(event) => setQuantityInput(event.target.value)}
                  placeholder="Quantity"
                  value={quantityInput}
                />
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-muted-foreground" htmlFor="offer-expiration-preset">Expires in</label>
                  <Select onValueChange={setExpirationPreset} value={expirationPreset}>
                    <SelectTrigger aria-label="Expires in" id="offer-expiration-preset">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="3600">1 hour</SelectItem>
                      <SelectItem value="86400">24 hours</SelectItem>
                      <SelectItem value="604800">7 days</SelectItem>
                      <SelectItem value="2592000">30 days</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  disabled={pendingAction !== null}
                  onClick={() => {
                    void runTransaction("offer", () => {
                      const big = BigInt(normalizedTokenId);
                      const low = (big & BigInt("0xffffffffffffffffffffffffffffffff")).toString();
                      const high = (big >> BigInt(128)).toString();
                      return account!.execute([{
                        contractAddress: MARKETPLACE_CONTRACT,
                        entrypoint: "offer",
                        calldata: [address, low, high, quantityInput, priceToWei(priceInput), currencyInput, computeExpiration()],
                      }]);
                    });
                  }}
                  size="sm"
                  type="button"
                  variant="secondary"
                >
                  Make offer
                </Button>
              </div>
              {txStatus.message ? (
                <p className={txStatus.tone === "error" ? "text-xs text-destructive" : "text-xs text-primary"}>
                  {txStatus.message}
                  {txStatus.txHash ? (
                    <>
                      {" "}
                      <a
                        href={buildExplorerTxUrl(chainLabel, txStatus.txHash)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline"
                      >
                        View on Starkscan →
                      </a>
                    </>
                  ) : null}
                </p>
              ) : null}
            </CardContent>
          </Card>
        ) : null}

        {/* Not connected prompt */}
        {!isConnected ? (
          <p className="text-xs text-muted-foreground">Connect wallet to transact.</p>
        ) : null}

        {listingQuery.isError ? (
          <p className="text-sm text-destructive">Listings failed to load.</p>
        ) : null}

        {listingQuery.isFetching ? (
          <Badge variant="outline">Refreshing...</Badge>
        ) : null}

        {listingRows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No listings</p>
        ) : (
          <div className="rounded border border-border overflow-hidden">
            {/* Table header */}
            <div className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-x-4 px-3 py-2 bg-muted/40 border-b border-border">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Price</span>
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Seller</span>
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Expires</span>
              <span />
            </div>
            {listingRows.map((listing) => {
              const isCheapest = cheapestListing?.orderId === String(listing.id);
              const rowOrderId = String(listing.id);
              const isRowAdded = isRecentlyAdded(rowOrderId);
              const isOwnRow = !!(walletAddress && listing.owner.toLowerCase() === walletAddress.toLowerCase());
              const hasFullCartData =
                listing.id !== undefined &&
                listing.price !== undefined &&
                listing.currency !== undefined &&
                listing.quantity !== undefined;
              const expiration = parseExpiration(listing.expiration);
              return (
                <div
                  key={listing.id}
                  className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-x-4 px-3 py-2.5 border-b border-border/50 last:border-b-0 hover:bg-muted/20 transition-colors"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-sm font-medium text-primary font-mono flex items-center gap-1.5">
                      {formatPriceForDisplay(listing.price) ?? String(listing.price)}
                      {listing.currency ? (
                        <span className="text-xs text-muted-foreground font-sans font-normal">
                          {getTokenSymbol(listing.currency)}
                        </span>
                      ) : null}
                    </span>
                    {isCheapest ? (
                      <Badge variant="secondary" className="shrink-0">Best Price</Badge>
                    ) : null}
                  </div>
                  <Link
                    href={`/profile/${listing.owner}`}
                    className="text-xs text-muted-foreground hover:text-foreground hover:underline font-mono transition-colors"
                  >
                    {isOwnRow ? "You" : truncateAddress(listing.owner)}
                  </Link>
                  <span className="text-xs text-muted-foreground">
                    {expiration ? formatRelativeExpiry(expiration) : "—"}
                  </span>
                  {isOwnRow ? (
                    <Badge variant="outline" className="text-[10px] px-2 py-0.5">Your listing</Badge>
                  ) : (
                    <Button
                      disabled={!hasFullCartData}
                      onClick={() => {
                        if (!token || !hasFullCartData) return;
                        addListingToCart(
                          cartItemFromTokenListing(
                            token,
                            address,
                            listing as unknown as CheapestListing,
                            projectId,
                          ),
                        );
                      }}
                      size="sm"
                      type="button"
                      variant={isRowAdded ? "default" : "outline"}
                    >
                      {isRowAdded ? "Added" : "Add to cart"}
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
