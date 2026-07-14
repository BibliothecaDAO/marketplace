import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { MarketplaceChainAlias } from "@biblio/marketplace-registry";
import {
  canonicalReconciliationHash,
  type ReplayReport,
} from "./reconciliation.js";

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

async function query(url: string, sql: string): Promise<Record<string, unknown>[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);
  try {
    const response = await fetch(`${url.replace(/\/$/, "")}/sql`, {
      method: "POST",
      headers: { accept: "application/json", "content-type": "application/json" },
      body: sql,
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`Torii SQL returned HTTP ${response.status}.`);
    const payload = (await response.json()) as unknown;
    const rows = Array.isArray(payload)
      ? payload
      : payload && typeof payload === "object" && Array.isArray((payload as { data?: unknown }).data)
        ? (payload as { data: unknown[] }).data
        : null;
    if (!rows) throw new Error("Torii SQL returned an invalid payload.");
    return rows as Record<string, unknown>[];
  } finally {
    clearTimeout(timeout);
  }
}

const root = fileURLToPath(new URL("../../../", import.meta.url));
const chain = required("REPLAY_CHAIN") as MarketplaceChainAlias;
if (chain !== "SN_MAIN" && chain !== "SN_SEPOLIA") {
  throw new Error("REPLAY_CHAIN must be SN_MAIN or SN_SEPOLIA.");
}
const endpoint = required("TORII_URL");
const checkpoints = JSON.parse(
  await readFile(resolve(root, "config/marketplace/rpc-checkpoints.json"), "utf8"),
) as {
  chains?: Partial<Record<MarketplaceChainAlias, { blockNumber: number; blockHash: string }>>;
};
const checkpoint = checkpoints.chains?.[chain];
if (!checkpoint) throw new Error(`No checkpoint exists for ${chain}.`);

const orderRows = await query(
  endpoint,
  "SELECT entity_id,event_id,order_id,collection,token_id,royalties,category,status,expiration,quantity,price,currency,owner FROM marketplace_order_audit ORDER BY sequence",
);
const bookRows = await query(
  endpoint,
  "SELECT entity_id,event_id,book_id,version,paused,royalties,counter,fee_num,fee_receiver FROM marketplace_book_audit ORDER BY sequence",
);
const tokens = await query(
  endpoint,
  "SELECT id,contract_address,name,symbol,decimals,total_supply,token_id FROM tokens WHERE token_id IS NOT NULL ORDER BY id",
);
const balances = await query(
  endpoint,
  "SELECT id,balance,account_address,contract_address,token_id FROM token_balances ORDER BY id",
);
const attributes = await query(
  endpoint,
  "SELECT id,token_id,trait_name,trait_value FROM token_attributes ORDER BY id",
);
const activity = await query(
  endpoint,
  "SELECT raw_type,type_raw,collection,token_id,order_id,owner,from_address,to_address,category,currency,price,activity_quantity,previous_quantity,event_id,transaction_hash,block_number,event_index,transaction_index,caller FROM marketplace_token_activity_v1 ORDER BY block_number,transaction_index,event_index,event_id",
);
const indexed = await query(endpoint, "SELECT MAX(head) AS indexed_block FROM contracts");
const indexedBlock = Number(indexed[0]?.indexed_block ?? -1);
if (indexedBlock !== checkpoint.blockNumber) {
  throw new Error(
    `Replay is at block ${indexedBlock}; fixed checkpoint ${checkpoint.blockNumber} is required.`,
  );
}

const complete = { orderRows, bookRows, tokens, balances, attributes, activity };
const report: ReplayReport & { generatedAt: string; attributeCount: number } = {
  chain,
  checkpointBlock: checkpoint.blockNumber,
  checkpointHash: checkpoint.blockHash,
  orderHash: canonicalReconciliationHash(orderRows),
  bookHash: canonicalReconciliationHash(bookRows),
  completeHash: canonicalReconciliationHash(complete),
  counts: {
    orders: orderRows.length,
    book: bookRows.length,
    tokens: tokens.length,
    balances: balances.length,
    activity: activity.length,
  },
  attributeCount: attributes.length,
  generatedAt: new Date().toISOString(),
};
const output = `${JSON.stringify(report, null, 2)}\n`;
const outputPath = process.env.REPLAY_REPORT_PATH?.trim();
if (outputPath) {
  const absolute = resolve(outputPath);
  await mkdir(dirname(absolute), { recursive: true });
  await writeFile(absolute, output, { mode: 0o600 });
}
process.stdout.write(output);
