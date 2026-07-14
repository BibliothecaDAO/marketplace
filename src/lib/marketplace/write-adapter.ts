import { ArcadeProvider } from "@cartridge/arcade";

export type MarketplaceOrderKey = {
  id: string;
  collection: string;
  tokenId: string;
};

function booleanLike(value: unknown): boolean | null {
  if (typeof value === "boolean") return value;
  if (typeof value === "number" || typeof value === "bigint") {
    if (value === 0 || value === BigInt(0)) return false;
    if (value === 1 || value === BigInt(1)) return true;
    return null;
  }
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["0", "0x0", "false"].includes(normalized)) return false;
    if (["1", "0x1", "true"].includes(normalized)) return true;
    return null;
  }
  if (Array.isArray(value)) return value.length > 0 ? booleanLike(value[0]) : null;
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  for (const key of ["valid", "isValid", "is_valid", "value", "result", "0"]) {
    const parsed = booleanLike(record[key]);
    if (parsed !== null) return parsed;
  }
  return null;
}

export function createMarketplaceWriteAdapter(chainId: string) {
  const provider = new ArcadeProvider(
    chainId as ConstructorParameters<typeof ArcadeProvider>[0],
  );
  return {
    async isOrderValid(key: MarketplaceOrderKey): Promise<boolean> {
      try {
        return booleanLike(await provider.marketplace.getValidity(
          key.id,
          key.collection,
          key.tokenId,
        )) === true;
      } catch {
        return false;
      }
    },
  };
}
