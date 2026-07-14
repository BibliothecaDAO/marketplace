import { createHash } from "node:crypto";
import type { MarketplaceChainAlias } from "@biblio/marketplace-registry";

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value
      .map(canonicalize)
      .sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right)));
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, child]) => [key, canonicalize(child)]),
    );
  }
  return value;
}

export function canonicalReconciliationHash(value: unknown): string {
  const canonical = JSON.stringify(canonicalize(value));
  return `sha256:${createHash("sha256").update(canonical).digest("hex")}`;
}

export type ReplayReport = {
  chain: MarketplaceChainAlias;
  checkpointBlock: number;
  checkpointHash: string;
  orderHash: string;
  bookHash: string;
  completeHash: string;
  counts: {
    orders: number;
    book: number;
    tokens: number;
    balances: number;
    activity: number;
  };
};

export function compareReplayReports(
  left: ReplayReport,
  right: ReplayReport,
): { matched: boolean; issues: string[] } {
  const issues: string[] = [];
  const fields = [
    "chain",
    "checkpointBlock",
    "checkpointHash",
    "orderHash",
    "bookHash",
    "completeHash",
  ] as const;
  for (const field of fields) {
    if (left[field] !== right[field]) issues.push(`${field} differs`);
  }
  for (const field of Object.keys(left.counts) as Array<keyof ReplayReport["counts"]>) {
    if (left.counts[field] !== right.counts[field]) issues.push(`counts.${field} differs`);
  }
  return { matched: issues.length === 0, issues };
}
