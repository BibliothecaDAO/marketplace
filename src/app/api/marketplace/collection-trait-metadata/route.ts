import { NextRequest, NextResponse } from "next/server";
import { nonEmptyParam, routeError } from "@/lib/marketplace/api-route";
import {
  cacheControlHeader,
  getCachedCollectionTraitMetadata,
} from "@/lib/marketplace/server-read";

export async function GET(request: NextRequest) {
  const address = nonEmptyParam(request.nextUrl.searchParams.get("address"));
  if (!address) {
    return routeError("Missing address.", 400);
  }

  const projectId = nonEmptyParam(request.nextUrl.searchParams.get("projectId")) ?? undefined;

  try {
    const payload = await getCachedCollectionTraitMetadata({
      address,
      projectId,
    });

    return NextResponse.json(payload, {
      headers: {
        "cache-control": cacheControlHeader("collectionTraitMetadata"),
      },
    });
  } catch {
    return routeError("Failed to load trait metadata.", 500);
  }
}
