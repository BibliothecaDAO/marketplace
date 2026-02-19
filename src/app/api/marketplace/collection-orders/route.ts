import { NextRequest, NextResponse } from "next/server";
import type { CollectionOrdersOptions } from "@cartridge/arcade/marketplace";
import {
  nonEmptyParam,
  optionalNumberParam,
  routeError,
} from "@/lib/marketplace/api-route";
import {
  cacheControlHeader,
  getCachedCollectionOrders,
} from "@/lib/marketplace/server-read";

export async function GET(request: NextRequest) {
  const collection = nonEmptyParam(request.nextUrl.searchParams.get("collection"));
  if (!collection) {
    return routeError("Missing collection.", 400);
  }

  const status = (nonEmptyParam(request.nextUrl.searchParams.get("status")) ??
    undefined) as CollectionOrdersOptions["status"];
  const category = (nonEmptyParam(request.nextUrl.searchParams.get("category")) ??
    undefined) as CollectionOrdersOptions["category"];
  const tokenId = nonEmptyParam(request.nextUrl.searchParams.get("tokenId")) ?? undefined;
  const limit = optionalNumberParam(request.nextUrl.searchParams.get("limit"));

  try {
    const payload = await getCachedCollectionOrders({
      collection,
      status,
      category,
      tokenId,
      limit,
    });

    return NextResponse.json(payload, {
      headers: {
        "cache-control": cacheControlHeader("collectionOrders"),
      },
    });
  } catch {
    return routeError("Failed to load collection orders.", 500);
  }
}
