import { normalizeAttributeFilters, normalizeTokenIds } from "@/lib/marketplace/cache-keys";

type QueryParamValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | string[]
  | Record<string, unknown>;

function appendQueryParam(
  searchParams: URLSearchParams,
  key: string,
  value: QueryParamValue,
) {
  if (value === undefined || value === null || value === "") {
    return;
  }

  if (Array.isArray(value)) {
    if (value.length === 0) {
      return;
    }
    searchParams.set(key, value.join(","));
    return;
  }

  if (typeof value === "object") {
    searchParams.set(key, JSON.stringify(value));
    return;
  }

  searchParams.set(key, String(value));
}

function parseErrorPayload(payload: unknown) {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const message = (payload as { message?: unknown }).message;
  return typeof message === "string" && message.trim().length > 0
    ? message
    : null;
}

export async function marketplaceApiGet<T>(
  path: string,
  params: Record<string, QueryParamValue>,
): Promise<T> {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    appendQueryParam(searchParams, key, value);
  });

  const queryString = searchParams.toString();
  const url = queryString ? `${path}?${queryString}` : path;
  const response = await fetch(url, {
    method: "GET",
    headers: { accept: "application/json" },
  });

  if (!response.ok) {
    let message = `Marketplace read failed (${response.status})`;

    try {
      const payload = (await response.json()) as unknown;
      message = parseErrorPayload(payload) ?? message;
    } catch {
      // no-op
    }

    throw new Error(message);
  }

  return (await response.json()) as T;
}

export function marketplaceReadParams(options: {
  tokenIds?: unknown;
  attributeFilters?: unknown;
}) {
  return {
    tokenIds: normalizeTokenIds(options.tokenIds),
    attributeFilters: normalizeAttributeFilters(options.attributeFilters),
  };
}
