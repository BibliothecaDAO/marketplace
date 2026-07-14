import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { emitEvidence, requiredEnvironment } from "./evidence-io.js";
import {
  evaluateChaosScenarios,
  type ChaosScenario,
} from "./operational-evidence.js";

const input = JSON.parse(
  await readFile(resolve(requiredEnvironment("CHAOS_SCENARIOS_PATH")), "utf8"),
) as unknown;
if (!Array.isArray(input)) throw new Error("CHAOS_SCENARIOS_PATH must contain a JSON array.");
const report = evaluateChaosScenarios(input as ChaosScenario[]);
await emitEvidence(report, process.env.CHAOS_REPORT_PATH);
if (!report.passed) process.exitCode = 2;
