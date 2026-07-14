import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseMarketplaceRegistry } from "@biblio/marketplace-registry";
import { emitEvidence, requiredEnvironment } from "./evidence-io.js";
import {
  evaluateSepoliaLifecycle,
  type SepoliaLifecycleInput,
} from "./operational-evidence.js";

const root = fileURLToPath(new URL("../../../", import.meta.url));
const registry = parseMarketplaceRegistry(JSON.parse(
  await readFile(resolve(root, "config/marketplace/chains.json"), "utf8"),
));
const sepolia = registry.chains.SN_SEPOLIA;
if (!sepolia) throw new Error("SN_SEPOLIA is absent from the marketplace registry.");
const input = JSON.parse(
  await readFile(resolve(requiredEnvironment("SEPOLIA_LIFECYCLE_INPUT_PATH")), "utf8"),
) as SepoliaLifecycleInput;
const report = evaluateSepoliaLifecycle(input, {
  worldAddress: sepolia.world.address,
  marketplaceAddress: sepolia.marketplace.address,
});
await emitEvidence(report, process.env.SEPOLIA_LIFECYCLE_REPORT_PATH);
if (!report.passed) process.exitCode = 2;
