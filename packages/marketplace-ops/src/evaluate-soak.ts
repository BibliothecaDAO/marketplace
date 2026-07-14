import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  emitEvidence,
  environmentNumber,
  requiredEnvironment,
} from "./evidence-io.js";
import { evaluateSoakSamples, type SoakSample } from "./operational-evidence.js";

const input = JSON.parse(
  await readFile(resolve(requiredEnvironment("SOAK_SAMPLES_PATH")), "utf8"),
) as unknown;
if (!Array.isArray(input)) throw new Error("SOAK_SAMPLES_PATH must contain a JSON array.");
const report = evaluateSoakSamples(input as SoakSample[], {
  minimumDurationHours: environmentNumber("SOAK_MINIMUM_HOURS", 168),
  maximumSampleGapSeconds: environmentNumber("SOAK_MAX_SAMPLE_GAP_SECONDS", 300),
  minimumAvailabilityPercent: environmentNumber("SOAK_MIN_AVAILABILITY_PERCENT", 99.9),
  maximumCachedP95Ms: environmentNumber("SOAK_MAX_CACHED_P95_MS", 500),
  maximumP95LagBlocks: environmentNumber("SOAK_MAX_P95_LAG_BLOCKS", 2),
  maximumSustainedUtilizationPercent: environmentNumber(
    "SOAK_MAX_SUSTAINED_UTILIZATION_PERCENT",
    70,
  ),
});
await emitEvidence(report, process.env.SOAK_REPORT_PATH);
if (!report.passed) process.exitCode = 2;
