"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useAccount } from "@starknet-react/core";
import type { NormalizedToken } from "@cartridge/arcade/marketplace";
import {
  useCollectionListingsQuery,
  useTokenDetailQuery,
  useTokenHolderQuery,
  useTokenOwnershipQuery,
} from "@/lib/marketplace/hooks";
import { getMarketplaceRuntimeConfig } from "@/lib/marketplace/config";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
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
} from "@/lib/marketplace/token-display";
import type { CheapestListing } from "@/features/cart/listing-utils";
import {
  cartItemFromTokenListing,
  cheapestListingByTokenId,
} from "@/features/cart/listing-utils";
import { useCartStore } from "@/features/cart/store/cart-store";


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
  expiration?: number;
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

export function TokenDetailView({
  address,
  tokenId,
  projectId,
}: TokenDetailViewProps) {
  // Arcade Marketplace contract address (same on SN_MAIN and SN_SEPOLIA per SDK manifest)
  const MARKETPLACE_CONTRACT = "0x6bbf16b6c67b1bef27a187b499b2f3a14af31646c2c90d64f11b9087c3f527c";
  // STRK token address on Starknet mainnet / testnet
  const STRK_ADDRESS = "0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d";

  const normalizedTokenId = formatNumberish(tokenId) ?? tokenId;
  const addItem = useCartStore((state) => state.addItem);
  const { account, address: walletAddress, isConnected } = useAccount();
  const { collections } = getMarketplaceRuntimeConfig();
  const collectionName = collections.find((c) => c.address === address)?.name ?? address;
  const [verifyOwnership, setVerifyOwnership] = useState(false);
  // Human-readable price in STRK (1 STRK = 1e18 wei)
  const [priceInput, setPriceInput] = useState("1");
  const [quantityInput, setQuantityInput] = useState("1");
  const [currencyInput, setCurrencyInput] = useState(STRK_ADDRESS);
  // Expiration as a preset duration in seconds (default: 24 hours)
  const [expirationPreset, setExpirationPreset] = useState("86400");
  const [txStatus, setTxStatus] = useState<{
    tone: "idle" | "success" | "error";
    message: string;
  }>({ tone: "idle", message: "" });
  const [pendingAction, setPendingAction] = useState<
    "list" | "offer" | "cancel" | null
  >(null);
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

  const ownershipQuery = useTokenOwnershipQuery({
    collection: address,
    tokenId: normalizedTokenId,
    accountAddress: walletAddress,
  });

  const holderQuery = useTokenHolderQuery({
    collection: address,
    tokenId: normalizedTokenId,
  });

  const holderAddress = useMemo(() => {
    const balances = (holderQuery.data as { page?: { balances?: Array<{ account_address: string; balance: string }> } } | null)?.page?.balances ?? [];
    const holder = balances.find((b) => {
      try { return BigInt(b.balance) > BigInt(0); } catch { return false; }
    });
    return holder?.account_address ?? null;
  }, [holderQuery.data]);

  const isOwner = useMemo(() => {
    if (!walletAddress || !isConnected) return false;
    const balances = (ownershipQuery.data as { page?: { balances?: Array<{ balance: string }> } } | null)?.page?.balances ?? [];
    return balances.some((b) => {
      try {
        return BigInt(b.balance) > BigInt(0);
      } catch {
        return false;
      }
    });
  }, [ownershipQuery.data, walletAddress, isConnected]);

  // Use holderAddress for ownership detection when available (more reliable than token balance API).
  // Compare via BigInt to handle leading-zero padding differences in Starknet addresses.
  // Falls back to `isOwner` from ownershipQuery when holderAddress is not yet known.
  const isOwnerByHolder = useMemo(() => {
    if (holderAddress === null || walletAddress === undefined) return false;
    try {
      return BigInt(holderAddress) === BigInt(walletAddress);
    } catch {
      return holderAddress.toLowerCase() === walletAddress.toLowerCase();
    }
  }, [holderAddress, walletAddress]);
  const effectiveIsOwner = holderAddress !== null ? isOwnerByHolder : isOwner;

  const token = detailQuery.data?.token ?? null;
  const listings = useMemo(
    () => listingQuery.data ?? detailQuery.data?.listings ?? [],
    [detailQuery.data?.listings, listingQuery.data],
  );
  const listingRows = listings as ListingRow[];
  const cheapestListings = useMemo(
    () => cheapestListingByTokenId(listings as unknown[]),
    [listings],
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
  }, [listingRows]); // eslint-disable-line react-hooks/exhaustive-deps

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
        message: `Submitted ${action} transaction: ${result.transaction_hash}`,
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
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-medium tracking-widest uppercase text-muted-foreground">Listings</h2>
          <div className="flex items-center gap-2">
            <Button
              disabled={!cheapestListing}
              onClick={() => {
                if (!token || !cheapestListing) {
                  return;
                }

                addItem(
                  cartItemFromTokenListing(token, address, cheapestListing, projectId),
                );
              }}
              size="sm"
              type="button"
            >
              Add cheapest to cart
            </Button>
            <div className="flex items-center gap-2">
              <Switch
                aria-label="Verify ownership"
                checked={verifyOwnership}
                id="verify-ownership-detail"
                onCheckedChange={setVerifyOwnership}
              />
              <label htmlFor="verify-ownership-detail">Verify ownership</label>
            </div>
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

        {/* Ownership indicator */}
        {isConnected && (ownershipQuery as { isFetching?: boolean }).isFetching ? (
          <p className="text-xs text-muted-foreground">Checking ownership...</p>
        ) : null}
        {isConnected && !(ownershipQuery as { isFetching?: boolean }).isFetching && isOwner ? (
          <Badge variant="outline" className="self-start">You own this token</Badge>
        ) : null}

        {/* Sell form — shown to confirmed owners (or when ownership still unknown) */}
        {isConnected && effectiveIsOwner ? (
          <Card className="border-dashed">
            <CardContent className="space-y-3 p-3">
              <div className="grid gap-2 sm:grid-cols-2">
                <div className="flex items-center gap-1">
                  <Input
                    aria-label="Price (STRK)"
                    min="0"
                    onChange={(event) => setPriceInput(event.target.value)}
                    placeholder="Price"
                    step="any"
                    type="number"
                    value={priceInput}
                  />
                  <span className="text-sm text-muted-foreground shrink-0">STRK</span>
                </div>
                <Input
                  aria-label="Quantity"
                  onChange={(event) => setQuantityInput(event.target.value)}
                  placeholder="Quantity"
                  value={quantityInput}
                />
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-muted-foreground" htmlFor="expiration-preset">Expires in</label>
                  <Select onValueChange={setExpirationPreset} value={expirationPreset}>
                    <SelectTrigger aria-label="Expires in" id="expiration-preset">
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
                    void runTransaction("list", () => {
                      const big = BigInt(normalizedTokenId);
                      const low = (big & BigInt("0xffffffffffffffffffffffffffffffff")).toString();
                      const high = (big >> BigInt(128)).toString();
                      return account!.execute([{
                        contractAddress: MARKETPLACE_CONTRACT,
                        entrypoint: "list",
                        calldata: [address, low, high, quantityInput, priceToWei(priceInput), currencyInput, computeExpiration(), "1"],
                      }]);
                    });
                  }}
                  size="sm"
                  type="button"
                >
                  List token
                </Button>
                <Button
                  disabled={pendingAction !== null || !ownListing}
                  onClick={() => {
                    if (!ownListing) return;
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
                  Cancel mine
                </Button>
              </div>
              {txStatus.message ? (
                <p className={txStatus.tone === "error" ? "text-xs text-destructive" : "text-xs text-primary"}>
                  {txStatus.message}
                </p>
              ) : null}
            </CardContent>
          </Card>
        ) : null}

        {/* Offer form — shown to confirmed non-owners */}
        {isConnected && !effectiveIsOwner && !(ownershipQuery as { isLoading?: boolean }).isLoading ? (
          <Card className="border-dashed">
            <CardContent className="space-y-3 p-3">
              <div className="grid gap-2 sm:grid-cols-2">
                <div className="flex items-center gap-1">
                  <Input
                    aria-label="Price (STRK)"
                    min="0"
                    onChange={(event) => setPriceInput(event.target.value)}
                    placeholder="Price"
                    step="any"
                    type="number"
                    value={priceInput}
                  />
                  <span className="text-sm text-muted-foreground shrink-0">STRK</span>
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

        {listings.length === 0 ? (
          <p className="text-sm text-muted-foreground">No listings</p>
        ) : (
          <div className="space-y-2">
            {listings.map((listing: { id: number; price: number | string; owner: string; expiration?: number; currency?: string; quantity?: number | string; tokenId?: number | string }) => {
              const isCheapest = cheapestListing?.orderId === String(listing.id);
              const hasFullCartData =
                listing.id !== undefined &&
                listing.price !== undefined &&
                listing.currency !== undefined &&
                listing.quantity !== undefined;
              return (
                <Card key={listing.id}>
                  <CardContent className="flex items-center justify-between p-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-primary font-mono">
                          {formatPriceForDisplay(listing.price) ?? String(listing.price)}
                        </p>
                        {isCheapest ? (
                          <Badge variant="secondary">Best Price</Badge>
                        ) : null}
                      </div>
                      <Link
                        href={`/profile/${listing.owner}`}
                        className="text-xs text-muted-foreground hover:underline"
                      >
                        {truncateAddress(listing.owner)}
                      </Link>
                    </div>
                    <div className="flex items-center gap-2">
                      {listing.expiration ? (
                        <Badge variant="secondary">
                          {new Date(listing.expiration * 1000).toLocaleDateString()}
                        </Badge>
                      ) : null}
                      <Button
                        disabled={!hasFullCartData}
                        onClick={() => {
                          if (!token || !hasFullCartData) return;
                          addItem(
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
                        variant="outline"
                      >
                        Add to cart
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
