import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import type { MarketplaceChainAlias } from "@biblio/marketplace-registry";
import {
  buildOwnedApiLoadScenarios,
  runOwnedApiLoadTest,
  type LoadOrderKey,
} from "./load.js";

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

function positiveNumber(name: string, fallback: number): number {
  const raw = process.env[name]?.trim();
  const value = raw ? Number(raw) : fallback;
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${name} must be a positive number.`);
  }
  return value;
}

function positiveInteger(name: string, fallback: number): number {
  const value = positiveNumber(name, fallback);
  if (!Number.isInteger(value)) throw new Error(`${name} must be an integer.`);
  return value;
}

const chain = (process.env.LOAD_CHAIN?.trim() ?? "SN_MAIN") as MarketplaceChainAlias;
if (chain !== "SN_MAIN" && chain !== "SN_SEPOLIA") {
  throw new Error("LOAD_CHAIN must be SN_MAIN or SN_SEPOLIA.");
}
const keysPayload = JSON.parse(
  await readFile(resolve(required("LOAD_ORDER_KEYS_PATH")), "utf8"),
) as unknown;
const orderKeys = (
  Array.isArray(keysPayload)
    ? keysPayload
    : keysPayload && typeof keysPayload === "object" &&
        Array.isArray((keysPayload as { orders?: unknown }).orders)
      ? (keysPayload as { orders: unknown[] }).orders
      : null
) as LoadOrderKey[] | null;
if (!orderKeys) throw new Error("LOAD_ORDER_KEYS_PATH must contain an array or { orders: [] }.");

const totalRequestsRaw = process.env.LOAD_TOTAL_REQUESTS?.trim();
const report = await runOwnedApiLoadTest({
  baseUrl: required("MARKETPLACE_API_BASE_URL"),
  scenarios: buildOwnedApiLoadScenarios({
    chain,
    collection: required("LOAD_COLLECTION"),
    currency: required("LOAD_CURRENCY"),
    orderKeys,
  }),
  concurrency: positiveInteger("LOAD_CONCURRENCY", 20),
  ...(totalRequestsRaw
    ? { totalRequests: positiveInteger("LOAD_TOTAL_REQUESTS", 1) }
    : { durationMs: positiveNumber("LOAD_DURATION_SECONDS", 300) * 1_000 }),
  timeoutMs: positiveNumber("LOAD_REQUEST_TIMEOUT_MS", 5_000),
  minimumAvailabilityPercent: positiveNumber("LOAD_MIN_AVAILABILITY_PERCENT", 99.9),
  maximumCachedP95Ms: positiveNumber("LOAD_MAX_CACHED_P95_MS", 500),
});

const output = `${JSON.stringify(report, null, 2)}\n`;
if (process.env.LOAD_REPORT_PATH?.trim()) {
  const outputPath = resolve(process.env.LOAD_REPORT_PATH.trim());
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, output, { mode: 0o600 });
}
process.stdout.write(output);
if (!report.passed) process.exitCode = 2;
