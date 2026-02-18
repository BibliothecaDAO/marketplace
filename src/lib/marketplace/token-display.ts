import type { NormalizedToken } from "@cartridge/arcade/marketplace";

function normalizeMetadata(token: NormalizedToken) {
  return token.metadata as Record<string, unknown> | null;
}

export function tokenId(token: NormalizedToken) {
  return String(token.token_id ?? "unknown");
}

export function formatNumberish(value: unknown) {
  if (typeof value === "bigint") {
    return value.toString();
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.trunc(value).toString();
  }

  if (typeof value === "string") {
    const normalized = value.trim();
    if (!normalized) {
      return null;
    }

    if (/^0x[0-9a-fA-F]+$/.test(normalized)) {
      return BigInt(normalized).toString();
    }

    return normalized;
  }

  return null;
}

export function displayTokenId(token: NormalizedToken) {
  return formatNumberish(token.token_id) ?? "unknown";
}

export function tokenName(token: NormalizedToken) {
  const name = normalizeMetadata(token)?.name;
  return typeof name === "string" && name.trim()
    ? name
    : `Token #${displayTokenId(token)}`;
}

export function tokenImage(token: NormalizedToken) {
  if (token.image) {
    return token.image;
  }

  const metadata = normalizeMetadata(token);
  const source = metadata?.image ?? metadata?.image_url;
  return typeof source === "string" && source.length > 0 ? source : null;
}

export function tokenPrice(token: NormalizedToken) {
  const fields = token as unknown as Record<string, unknown>;
  const metadata = normalizeMetadata(token);

  const candidates = [
    fields.price,
    fields.listing_price,
    fields.listingPrice,
    metadata?.price,
    metadata?.listing_price,
    metadata?.listingPrice,
  ];

  for (const candidate of candidates) {
    const normalized = formatNumberish(candidate);
    if (normalized) {
      return normalized;
    }
  }

  return null;
}

export function listingPriceByTokenId(listings: unknown[] | undefined) {
  const prices = new Map<string, string>();

  for (const listing of listings ?? []) {
    if (!listing || typeof listing !== "object") {
      continue;
    }

    const fields = listing as Record<string, unknown>;
    const listingTokenId = formatNumberish(fields.tokenId);
    const listingPrice = formatNumberish(fields.price);
    if (!listingTokenId || !listingPrice) {
      continue;
    }

    const currentPrice = prices.get(listingTokenId);
    if (!currentPrice) {
      prices.set(listingTokenId, listingPrice);
      continue;
    }

    try {
      if (BigInt(listingPrice) < BigInt(currentPrice)) {
        prices.set(listingTokenId, listingPrice);
      }
    } catch {
      // Keep previous value if either price can't be safely parsed as bigint.
    }
  }

  return prices;
}
