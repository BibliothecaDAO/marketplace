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

export class MarketplaceReadRolloutError extends Error {
  readonly code = "MARKETPLACE_READ_SURFACE_DISABLED";

  constructor(
    readonly rollout: MarketplaceReadRollout,
    readonly surface: MarketplaceReadSurface,
  ) {
    super(
      `Marketplace ${surface} reads are disabled while MARKETPLACE_READ_ROLLOUT=${rollout}.`,
    );
    this.name = "MarketplaceReadRolloutError";
  }
}

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

export function assertOwnedReadEnabled(
  rollout: MarketplaceReadRollout,
  surface: MarketplaceReadSurface,
): void {
  if (!isOwnedReadEnabled(rollout, surface)) {
    throw new MarketplaceReadRolloutError(rollout, surface);
  }
}
