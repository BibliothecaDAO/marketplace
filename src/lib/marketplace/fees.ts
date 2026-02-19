export type MarketplaceFeeConfig = {
  feeNum: number;
  feeDenominator: number;
  feeReceiver?: string;
};

export function parseBigInt(value: unknown) {
  if (typeof value === "bigint") {
    return value;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return BigInt(Math.trunc(value));
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }

    try {
      if (/^0x[0-9a-fA-F]+$/.test(trimmed)) {
        return BigInt(trimmed);
      }

      return BigInt(trimmed);
    } catch {
      return null;
    }
  }

  return null;
}

export function sumBigIntStrings(values: string[]) {
  return values.reduce((total, value) => {
    const parsed = parseBigInt(value);
    return parsed === null ? total : total + parsed;
  }, BigInt(0));
}

export function calculateMarketplaceFee(
  subtotal: bigint,
  config: MarketplaceFeeConfig | null | undefined,
) {
  if (!config) {
    return BigInt(0);
  }

  if (!Number.isFinite(config.feeNum) || !Number.isFinite(config.feeDenominator)) {
    return BigInt(0);
  }

  if (config.feeNum <= 0 || config.feeDenominator <= 0) {
    return BigInt(0);
  }

  return (subtotal * BigInt(Math.trunc(config.feeNum))) /
    BigInt(Math.trunc(config.feeDenominator));
}

export function calculateCartSummary(options: {
  prices: string[];
  marketplaceFeeConfig?: MarketplaceFeeConfig | null;
  royaltyEstimate?: bigint;
}) {
  const subtotal = sumBigIntStrings(options.prices);
  const marketplaceFee = calculateMarketplaceFee(
    subtotal,
    options.marketplaceFeeConfig,
  );
  const royaltyEstimate = options.royaltyEstimate ?? BigInt(0);
  const total = subtotal + marketplaceFee + royaltyEstimate;

  return {
    subtotal,
    marketplaceFee,
    royaltyEstimate,
    total,
  };
}
