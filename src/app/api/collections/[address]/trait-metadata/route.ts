import { NextResponse } from "next/server";

const EDGE_CACHE_CONTROL = "public, s-maxage=300, stale-while-revalidate=900";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ address: string }>;
};

function noStoreJson(body: object, status: number) {
  return NextResponse.json(body, {
    status,
    headers: {
      "cache-control": "no-store",
    },
  });
}

function normalizedProjectId(request: Request) {
  const projectId = new URL(request.url).searchParams.get("projectId");
  const trimmed = projectId?.trim();
  return trimmed ? trimmed : undefined;
}

export async function GET(request: Request, context: RouteContext) {
  const { address } = await context.params;
  if (!address) {
    return noStoreJson({ error: "collection address is required" }, 400);
  }

  const projectId = normalizedProjectId(request);

  try {
    const { fetchCollectionTraitMetadata, aggregateTraitMetadata } = await import(
      "@cartridge/arcade/marketplace"
    );
    const result = await fetchCollectionTraitMetadata({
      address,
      projects: projectId ? [projectId] : undefined,
      defaultProjectId: projectId,
    });

    return NextResponse.json(
      {
        traitMetadata: aggregateTraitMetadata(result.pages),
      },
      {
        headers: {
          "cache-control": EDGE_CACHE_CONTROL,
        },
      },
    );
  } catch (error) {
    console.error("failed to fetch collection trait metadata", {
      address,
      projectId,
      error,
    });
    return noStoreJson({ error: "failed to load collection trait metadata" }, 500);
  }
}
