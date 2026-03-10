import { formatNumberish } from "@/lib/marketplace/token-display";

export type PortfolioItem = {
  collectionAddress: string;
  tokenId: string;
  balance: string;
};

function asRecord(value: unknown) {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : null;
}

export function parsePortfolioItems(data: unknown): PortfolioItem[] {
  const page = asRecord(asRecord(data)?.page);
  const balances = Array.isArray(page?.balances)
    ? (page.balances as unknown[])
    : [];

  const items: PortfolioItem[] = [];
  for (const entry of balances) {
    const record = asRecord(entry);
    if (!record) continue;

    const collectionAddress =
      (typeof record.contract_address === "string" && record.contract_address) ||
      (typeof record.contractAddress === "string" && record.contractAddress) ||
      null;
    const tokenId = formatNumberish(record.token_id ?? record.tokenId);
    const balance = formatNumberish(record.balance) ?? "0";
    if (!collectionAddress || !tokenId) continue;

    try {
      if (BigInt(balance) <= BigInt(0)) {
        continue;
      }
    } catch {
      continue;
    }

    items.push({
      collectionAddress,
      tokenId,
      balance,
    });
  }

  return items;
}

export function groupPortfolioItemsByCollection(
  items: PortfolioItem[],
): { collectionAddress: string; tokenIds: string[] }[] {
  const map = new Map<string, string[]>();
  for (const item of items) {
    const existing = map.get(item.collectionAddress) ?? [];
    existing.push(item.tokenId);
    map.set(item.collectionAddress, existing);
  }

  return Array.from(map.entries())
    .sort(([, a], [, b]) => b.length - a.length)
    .map(([collectionAddress, tokenIds]) => ({ collectionAddress, tokenIds }));
}
