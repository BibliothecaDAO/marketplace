"use client";

import { useMemo, useState } from "react";
import type { CollectionOrdersOptions } from "@cartridge/arcade/marketplace";
import {
  useMarketplaceCollectionListings,
  useMarketplaceCollectionOrders,
} from "@cartridge/arcade/marketplace/react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type CollectionMarketPanelProps = {
  address: string;
  projectId?: string;
};

const ORDER_STATUS_VALUES = ["None", "Placed", "Canceled", "Executed"] as const;
const ORDER_CATEGORY_VALUES = ["None", "Buy", "Sell"] as const;

type OrderStatusFilter = Exclude<CollectionOrdersOptions["status"], undefined>;
type OrderCategoryFilter = Exclude<CollectionOrdersOptions["category"], undefined>;

function parseOrderStatus(value: string): OrderStatusFilter | undefined {
  const trimmed = value.trim();
  if ((ORDER_STATUS_VALUES as readonly string[]).includes(trimmed)) {
    return trimmed as OrderStatusFilter;
  }

  return undefined;
}

function parseOrderCategory(value: string): OrderCategoryFilter | undefined {
  const trimmed = value.trim();
  if ((ORDER_CATEGORY_VALUES as readonly string[]).includes(trimmed)) {
    return trimmed as OrderCategoryFilter;
  }

  return undefined;
}

function parseListingTokenId(value: string) {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return undefined;
  }

  return trimmed;
}

export function CollectionMarketPanel({
  address,
  projectId,
}: CollectionMarketPanelProps) {
  const [orderStatus, setOrderStatus] = useState("");
  const [orderCategory, setOrderCategory] = useState("");
  const [listingTokenId, setListingTokenId] = useState("");
  const [verifyOwnership, setVerifyOwnership] = useState(false);

  const parsedOrderStatus = useMemo(
    () => parseOrderStatus(orderStatus),
    [orderStatus],
  );
  const parsedOrderCategory = useMemo(
    () => parseOrderCategory(orderCategory),
    [orderCategory],
  );
  const listingTokenFilter = useMemo(
    () => parseListingTokenId(listingTokenId),
    [listingTokenId],
  );

  const orders = useMarketplaceCollectionOrders(
    {
      collection: address,
      status: parsedOrderStatus,
      category: parsedOrderCategory,
      limit: 24,
    },
    Boolean(address),
  );
  const listings = useMarketplaceCollectionListings(
    {
      collection: address,
      tokenId: listingTokenFilter,
      limit: 24,
      verifyOwnership,
      projectId,
    },
    Boolean(address),
  );

  return (
    <Card>
      <CardHeader className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <CardTitle>Market Activity</CardTitle>
          <div className="flex gap-2">
            <Badge variant="outline">Orders: {orders.status}</Badge>
            <Badge variant="outline">Listings: {listings.status}</Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="orders">
          <TabsList className="mb-4">
            <TabsTrigger value="orders">Orders</TabsTrigger>
            <TabsTrigger value="listings">Listings</TabsTrigger>
          </TabsList>

          <TabsContent value="orders">
            <section className="space-y-4" data-testid="orders-panel">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground" htmlFor="order-status">
                    Order status
                  </label>
                  <Input
                    id="order-status"
                    onChange={(event) => setOrderStatus(event.target.value)}
                    placeholder="Placed | Canceled | Executed"
                    value={orderStatus}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground" htmlFor="order-category">
                    Order category
                  </label>
                  <Input
                    id="order-category"
                    onChange={(event) => setOrderCategory(event.target.value)}
                    placeholder="Buy | Sell"
                    value={orderCategory}
                  />
                </div>
              </div>

              {orders.status === "error" ? (
                <p className="text-sm text-destructive">Orders failed to load.</p>
              ) : null}

              {orders.status === "success" ? (
                <div className="space-y-1">
                  {(orders.data ?? []).map((order) => (
                    <p key={order.id} className="text-sm">
                      Order #{order.id} · Token #{order.tokenId}
                    </p>
                  ))}
                </div>
              ) : null}
            </section>
          </TabsContent>

          <TabsContent value="listings">
            <section className="space-y-4" data-testid="listings-panel">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground" htmlFor="listing-token-id">
                    Listing token id
                  </label>
                  <Input
                    id="listing-token-id"
                    onChange={(event) => setListingTokenId(event.target.value)}
                    placeholder="Filter by token id"
                    value={listingTokenId}
                  />
                </div>
                <div className="flex items-end gap-2">
                  <Switch
                    aria-label="Verify ownership"
                    checked={verifyOwnership}
                    id="verify-ownership"
                    onCheckedChange={setVerifyOwnership}
                  />
                  <label className="text-sm" htmlFor="verify-ownership">
                    Verify ownership
                  </label>
                </div>
              </div>

              {listings.status === "error" ? (
                <p className="text-sm text-destructive">Listings failed to load.</p>
              ) : null}

              {listings.status === "success" ? (
                <div className="space-y-1">
                  {(listings.data ?? []).map((listing) => (
                    <p key={listing.id} className="text-sm">
                      Listing #{listing.id} · Token #{listing.tokenId}
                    </p>
                  ))}
                </div>
              ) : null}
            </section>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
