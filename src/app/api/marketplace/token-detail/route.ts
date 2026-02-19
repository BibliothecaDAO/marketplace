import { NextRequest, NextResponse } from "next/server";
import { nonEmptyParam, optionalBooleanParam, routeError } from "@/lib/marketplace/api-route";
import { cacheControlHeader, getCachedTokenDetail } from "@/lib/marketplace/server-read";

export async function GET(request: NextRequest) {
  const collection = nonEmptyParam(request.nextUrl.searchParams.get("collection"));
  const tokenId = nonEmptyParam(request.nextUrl.searchParams.get("tokenId"));
  if (!collection || !tokenId) {
    return routeError("Missing collection or tokenId.", 400);
  }

  const projectId = nonEmptyParam(request.nextUrl.searchParams.get("projectId")) ?? undefined;
  const fetchImages = optionalBooleanParam(request.nextUrl.searchParams.get("fetchImages"));

  try {
    const payload = await getCachedTokenDetail({
      collection,
      tokenId,
      projectId,
      fetchImages,
    });

    return NextResponse.json(payload, {
      headers: {
        "cache-control": cacheControlHeader("tokenDetail"),
      },
    });
  } catch {
    return routeError("Failed to load token detail.", 500);
  }
}
