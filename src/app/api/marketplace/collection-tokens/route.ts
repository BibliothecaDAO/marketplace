import { NextRequest, NextResponse } from "next/server";
import type { FetchCollectionTokensOptions } from "@cartridge/arcade/marketplace";
import {
  nonEmptyParam,
  optionalBooleanParam,
  optionalNumberParam,
  parseCommaSeparated,
  parseJsonObject,
  routeError,
} from "@/lib/marketplace/api-route";
import {
  cacheControlHeader,
  getCachedCollectionTokens,
} from "@/lib/marketplace/server-read";

export async function GET(request: NextRequest) {
  const address = nonEmptyParam(request.nextUrl.searchParams.get("address"));
  if (!address) {
    return routeError("Missing address.", 400);
  }

  const rawAttributeFilters = request.nextUrl.searchParams.get("attributeFilters");
  const attributeFilters = parseJsonObject(rawAttributeFilters);
  if (rawAttributeFilters && !attributeFilters) {
    return routeError("Invalid attributeFilters.", 400);
  }

  const options = {
    address,
    project: nonEmptyParam(request.nextUrl.searchParams.get("project")) ?? undefined,
    cursor: nonEmptyParam(request.nextUrl.searchParams.get("cursor")) ?? undefined,
    limit: optionalNumberParam(request.nextUrl.searchParams.get("limit")),
    tokenIds: parseCommaSeparated(request.nextUrl.searchParams.get("tokenIds")),
    fetchImages: optionalBooleanParam(request.nextUrl.searchParams.get("fetchImages")),
    attributeFilters:
      attributeFilters as FetchCollectionTokensOptions["attributeFilters"],
  } satisfies FetchCollectionTokensOptions;

  try {
    const payload = await getCachedCollectionTokens(options);

    return NextResponse.json(payload, {
      headers: {
        "cache-control": cacheControlHeader("collectionTokens"),
      },
    });
  } catch {
    return routeError("Failed to load collection tokens.", 500);
  }
}
