import { NextRequest, NextResponse } from "next/server";
import { nonEmptyParam, optionalBooleanParam, routeError } from "@/lib/marketplace/api-route";
import { cacheControlHeader, getCachedCollection } from "@/lib/marketplace/server-read";

export async function GET(request: NextRequest) {
  const address = nonEmptyParam(request.nextUrl.searchParams.get("address"));
  if (!address) {
    return routeError("Missing address.", 400);
  }

  const projectId = nonEmptyParam(request.nextUrl.searchParams.get("projectId")) ?? undefined;
  const fetchImages = optionalBooleanParam(request.nextUrl.searchParams.get("fetchImages"));

  try {
    const payload = await getCachedCollection({
      address,
      projectId,
      fetchImages,
    });

    return NextResponse.json(payload, {
      headers: {
        "cache-control": cacheControlHeader("collection"),
      },
    });
  } catch {
    return routeError("Failed to load collection.", 500);
  }
}
