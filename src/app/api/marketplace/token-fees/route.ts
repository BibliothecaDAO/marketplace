import { NextRequest, NextResponse } from "next/server";
import { nonEmptyParam, routeError } from "@/lib/marketplace/api-route";
import { cacheControlHeader, getCachedTokenFees } from "@/lib/marketplace/server-read";

export async function GET(request: NextRequest) {
  const collection = nonEmptyParam(request.nextUrl.searchParams.get("collection"));
  const tokenId = nonEmptyParam(request.nextUrl.searchParams.get("tokenId"));
  const amount = nonEmptyParam(request.nextUrl.searchParams.get("amount"));
  if (!collection || !tokenId || !amount) {
    return routeError("Missing collection, tokenId, or amount.", 400);
  }

  try {
    const payload = await getCachedTokenFees({
      collection,
      tokenId,
      amount,
    });

    return NextResponse.json(payload, {
      headers: {
        "cache-control": cacheControlHeader("tokenFees"),
      },
    });
  } catch {
    return routeError("Failed to load token fees.", 500);
  }
}
