import type { NormalizedToken } from "@cartridge/arcade/marketplace";

function normalizeMetadata(token: NormalizedToken) {
  return token.metadata as Record<string, unknown> | null;
}

function asRecord(value: unknown) {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : null;
}

const WEI_DECIMALS = 18;
const MIN_AUTO_SCALE_DIGITS = 15;

export function tokenId(token: NormalizedToken) {
  return String(token.token_id ?? "unknown");
}

export function formatNumberish(value: unknown) {
  if (typeof value === "bigint") {
    return value.toString();
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.trunc(value).toLocaleString("fullwide", { useGrouping: false });
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

export function formatPriceForDisplay(value: unknown) {
  const normalized = formatNumberish(value);
  if (!normalized) {
    return null;
  }

  if (!/^-?\d+$/.test(normalized)) {
    return normalized;
  }

  if (normalized.replace("-", "").length < MIN_AUTO_SCALE_DIGITS) {
    return normalized;
  }

  try {
    const parsed = BigInt(normalized);
    const isNegative = parsed < BigInt(0);
    const absolute = isNegative ? -parsed : parsed;
    const divisor = BigInt(10) ** BigInt(WEI_DECIMALS);
    const whole = absolute / divisor;
    const remainder = absolute % divisor;
    const sign = isNegative ? "-" : "";

    if (remainder === BigInt(0)) {
      return `${sign}${whole.toString()}`;
    }

    const fractional = remainder
      .toString()
      .padStart(WEI_DECIMALS, "0")
      .replace(/0+$/, "");

    return `${sign}${whole.toString()}.${fractional}`;
  } catch {
    return normalized;
  }
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

export function formatAddress(address: string) {
  if (/^0x[0-9a-fA-F]{9,}$/i.test(address)) {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  }
  return address;
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

// ---------------------------------------------------------------------------
// M1: Token symbol, explorer URL, relative expiry
// ---------------------------------------------------------------------------

const KNOWN_TOKEN_SYMBOLS: Record<string, string> = {
  "0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d": "STRK",
  "0x42dd777885ad2c116be96d4d634abc90a26a790ffb5871e037dd5ae7d2ec86b": "SURVIVO",
  "0x0124aeb495b947201f5fac96fd1138e326ad86195b98df6dec9009158a533b49": "LORDS",
};

const KNOWN_TOKEN_ICONS: Record<string, string> = {
  "0x42dd777885ad2c116be96d4d634abc90a26a790ffb5871e037dd5ae7d2ec86b": "/tokens/survivo.jpg",
  "0x0124aeb495b947201f5fac96fd1138e326ad86195b98df6dec9009158a533b49": "https://coin-images.coingecko.com/coins/images/22171/small/Frame_1.png?1696521515",
};

export function getTokenSymbol(address: string): string {
  const normalized = address.toLowerCase();
  if (normalized in KNOWN_TOKEN_SYMBOLS) {
    return KNOWN_TOKEN_SYMBOLS[normalized];
  }
  return formatAddress(address);
}

export function getTokenIconUrl(address: string): string | null {
  const normalized = address.toLowerCase();
  return KNOWN_TOKEN_ICONS[normalized] ?? null;
}

export function buildExplorerTxUrl(
  chainLabel: string,
  txHash: string,
): string {
  const base =
    chainLabel === "SN_MAIN"
      ? "https://starkscan.co"
      : "https://sepolia.starkscan.co";
  return `${base}/tx/${txHash}`;
}

export function formatRelativeExpiry(epochSeconds: number): string {
  const nowSeconds = Math.floor(Date.now() / 1000);
  const diffSeconds = epochSeconds - nowSeconds;

  if (diffSeconds <= 0) return "Expired";

  const diffDays = Math.floor(diffSeconds / 86400);
  if (diffDays >= 1) {
    return diffDays === 1 ? "Expires in 1 day" : `Expires in ${diffDays} days`;
  }

  const diffHours = Math.floor(diffSeconds / 3600);
  if (diffHours >= 1) {
    return diffHours === 1 ? "Expires in 1 hour" : `Expires in ${diffHours} hours`;
  }

  return "Expires soon";
}

export function listingPriceByTokenId(listings: unknown[] | undefined) {
  const prices = new Map<string, string>();

  for (const listing of listings ?? []) {
    const fields = asRecord(listing);
    if (!fields) {
      continue;
    }

    const nestedOrder = asRecord(fields.order);
    const listingTokenId =
      formatNumberish(fields.tokenId) ??
      formatNumberish(fields.token_id) ??
      formatNumberish(nestedOrder?.tokenId) ??
      formatNumberish(nestedOrder?.token_id);
    const listingPrice =
      formatNumberish(fields.price) ??
      formatNumberish(fields.listing_price) ??
      formatNumberish(fields.listingPrice) ??
      formatNumberish(nestedOrder?.price) ??
      formatNumberish(nestedOrder?.listing_price) ??
      formatNumberish(nestedOrder?.listingPrice);
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
