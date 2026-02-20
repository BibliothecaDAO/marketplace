import { NextResponse } from "next/server";
import { getMarketplaceRuntimeConfig } from "@/lib/marketplace/config";
import type { TraitMetadataRow } from "@/lib/marketplace/traits";

const EDGE_CACHE_CONTROL = "public, s-maxage=300, stale-while-revalidate=900";
const DEFAULT_PROJECT_ID = "arcade-main";
const TORII_SQL_TIMEOUT_MS = 4_000;
const TRAIT_SAMPLE_ROW_LIMIT = 10_000;

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ address: string }>;
};

type TraitMetadataSqlRow = {
  trait_name?: string;
  traitName?: string;
  trait_value?: string;
  traitValue?: string;
  count?: unknown;
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

function resolveProjectId(address: string, requestedProjectId: string | undefined) {
  if (requestedProjectId) {
    return requestedProjectId;
  }

  const config = getMarketplaceRuntimeConfig();
  const fromCollection = config.collections.find(
    (collection) => collection.address.toLowerCase() === address.toLowerCase(),
  )?.projectId;
  return fromCollection || config.sdkConfig.defaultProject || DEFAULT_PROJECT_ID;
}

function padHexAddress(value: string) {
  const normalized = value.trim().toLowerCase();
  if (!/^0x[0-9a-f]+$/.test(normalized)) {
    return value;
  }

  const hex = normalized.slice(2).replace(/^0+/, "") || "0";
  if (hex.length >= 64) {
    return `0x${hex}`;
  }

  return `0x${hex.padStart(64, "0")}`;
}

function buildTraitMetadataQuery(address: string) {
  const paddedAddress = padHexAddress(address);
  // Aggregating over the full dataset frequently times out on larger collections.
  // Pull a bounded sample of raw rows, then aggregate in-process for predictable latency.
  return `SELECT trait_name, trait_value
FROM token_attributes
WHERE token_id LIKE '${paddedAddress}:%'
LIMIT ${TRAIT_SAMPLE_ROW_LIMIT}`;
}

function extractRows(payload: unknown): TraitMetadataSqlRow[] {
  if (Array.isArray(payload)) {
    return payload as TraitMetadataSqlRow[];
  }

  if (payload && typeof payload === "object") {
    const record = payload as Record<string, unknown>;
    if (Array.isArray(record.data)) {
      return record.data as TraitMetadataSqlRow[];
    }
    if (Array.isArray(record.rows)) {
      return record.rows as TraitMetadataSqlRow[];
    }
    if (Array.isArray(record.result)) {
      return record.result as TraitMetadataSqlRow[];
    }
  }

  return [];
}

function normalizeRow(row: TraitMetadataSqlRow): TraitMetadataRow | null {
  const traitName =
    typeof row.trait_name === "string"
      ? row.trait_name
      : typeof row.traitName === "string"
        ? row.traitName
        : null;
  const traitValue =
    typeof row.trait_value === "string"
      ? row.trait_value
      : typeof row.traitValue === "string"
        ? row.traitValue
        : null;
  if (!traitName || !traitValue) {
    return null;
  }

  const countRaw =
    typeof row.count === "number"
      ? row.count
      : typeof row.count === "string"
        ? Number.parseInt(row.count, 10)
        : Number(row.count ?? 1);
  const count = Number.isFinite(countRaw) ? Number(countRaw) : 0;
  return { traitName, traitValue, count };
}

function aggregateTraitMetadata(rows: TraitMetadataSqlRow[]): TraitMetadataRow[] {
  const aggregate = new Map<string, TraitMetadataRow>();

  for (const row of rows) {
    const normalized = normalizeRow(row);
    if (!normalized) {
      continue;
    }

    const key = `${normalized.traitName}::${normalized.traitValue}`;
    const existing = aggregate.get(key);
    if (existing) {
      existing.count += normalized.count;
      continue;
    }

    aggregate.set(key, normalized);
  }

  return Array.from(aggregate.values());
}

async function fetchTraitMetadata(address: string, projectId: string) {
  const query = buildTraitMetadataQuery(address);
  const response = await fetch(
    `https://api.cartridge.gg/x/${encodeURIComponent(projectId)}/torii/sql`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: query,
      signal: AbortSignal.timeout(TORII_SQL_TIMEOUT_MS),
    },
  );

  if (!response.ok) {
    const detail = (await response.text().catch(() => "")).trim();
    throw new Error(`torii sql failed (${response.status})${detail ? `: ${detail}` : ""}`);
  }

  const payload = await response.json().catch(() => []);
  return aggregateTraitMetadata(extractRows(payload));
}

export async function GET(request: Request, context: RouteContext) {
  const { address } = await context.params;
  if (!address) {
    return noStoreJson({ error: "collection address is required" }, 400);
  }

  const projectId = resolveProjectId(address, normalizedProjectId(request));

  try {
    const traitMetadata = await fetchTraitMetadata(address, projectId);
    return NextResponse.json(
      {
        traitMetadata,
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
    return noStoreJson({ traitMetadata: [] }, 200);
  }
}
