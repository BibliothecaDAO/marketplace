import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { MarketplaceChainAlias } from "@biblio/marketplace-registry";
import { qualifyRpcEndpoint, type RpcCheckpoint } from "./qualification.js";

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

const root = fileURLToPath(new URL("../../../", import.meta.url));
const provider = required("RPC_PROVIDER_NAME");
const chain = required("RPC_CHAIN") as MarketplaceChainAlias;
if (chain !== "SN_MAIN" && chain !== "SN_SEPOLIA") {
  throw new Error("RPC_CHAIN must be SN_MAIN or SN_SEPOLIA.");
}
const registry = JSON.parse(
  await readFile(resolve(root, "config/marketplace/chains.json"), "utf8"),
) as unknown;
const checkpoints = JSON.parse(
  await readFile(resolve(root, "config/marketplace/rpc-checkpoints.json"), "utf8"),
) as { chains?: Partial<Record<MarketplaceChainAlias, RpcCheckpoint>> };
const checkpoint = checkpoints.chains?.[chain];
if (!checkpoint) throw new Error(`No fixed checkpoint exists for ${chain}.`);

const result = await qualifyRpcEndpoint({
  provider,
  chain,
  endpoint: required("RPC_URL"),
  registry,
  checkpoint,
});
const output = `${JSON.stringify(result, null, 2)}\n`;
if (process.env.RPC_QUALIFICATION_REPORT) {
  const reportPath = resolve(process.env.RPC_QUALIFICATION_REPORT);
  await mkdir(dirname(reportPath), { recursive: true });
  await writeFile(reportPath, output, { mode: 0o600 });
}
process.stdout.write(output);
if (!result.passed) process.exitCode = 2;
