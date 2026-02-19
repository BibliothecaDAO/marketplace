import { NextRequest, NextResponse } from "next/server";
import {
  nonEmptyParam,
  optionalBooleanParam,
  optionalNumberParam,
  routeError,
} from "@/lib/marketplace/api-route";
import {
  cacheControlHeader,
  getCachedCollectionListings,
} from "@/lib/marketplace/server-read";

export async function GET(request: NextRequest) {
  const collection = nonEmptyParam(request.nextUrl.searchParams.get("collection"));
  if (!collection) {
    return routeError("Missing collection.", 400);
  }

  const tokenId = nonEmptyParam(request.nextUrl.searchParams.get("tokenId")) ?? undefined;
  const projectId = nonEmptyParam(request.nextUrl.searchParams.get("projectId")) ?? undefined;
  const verifyOwnership = optionalBooleanParam(request.nextUrl.searchParams.get("verifyOwnership"));
  const limit = optionalNumberParam(request.nextUrl.searchParams.get("limit"));

  try {
    const payload = await getCachedCollectionListings({
      collection,
      tokenId,
      projectId,
      verifyOwnership,
      limit,
    });

    return NextResponse.json(payload, {
      headers: {
        "cache-control": cacheControlHeader("collectionListings"),
      },
    });
  } catch {
    return routeError("Failed to load collection listings.", 500);
  }
}
