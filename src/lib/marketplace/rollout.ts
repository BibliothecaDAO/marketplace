export const MARKETPLACE_READ_ROLLOUT_VALUES = [
  "off",
  "browse",
  "portfolio",
  "orders",
  "checkout",
] as const;

export type MarketplaceReadRollout =
  (typeof MARKETPLACE_READ_ROLLOUT_VALUES)[number];
export type MarketplaceReadSurface = Exclude<MarketplaceReadRollout, "off">;

const stageIndex = new Map(
  MARKETPLACE_READ_ROLLOUT_VALUES.map((stage, index) => [stage, index]),
);

export function parseMarketplaceReadRollout(
  value: string | undefined,
): MarketplaceReadRollout {
  const normalized = value?.trim().toLowerCase() || "off";
  if (!stageIndex.has(normalized as MarketplaceReadRollout)) {
    throw new Error(
      `MARKETPLACE_READ_ROLLOUT must be one of ${MARKETPLACE_READ_ROLLOUT_VALUES.join(
        "|",
      )}; received ${JSON.stringify(value)}.`,
    );
  }
  return normalized as MarketplaceReadRollout;
}

export function isOwnedReadEnabled(
  rollout: MarketplaceReadRollout,
  surface: MarketplaceReadSurface,
): boolean {
  return (stageIndex.get(rollout) ?? 0) >= (stageIndex.get(surface) ?? Infinity);
}
