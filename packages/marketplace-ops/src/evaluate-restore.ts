import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { emitEvidence, requiredEnvironment } from "./evidence-io.js";
import {
  evaluateRestoreDrill,
  evaluateRestoreDrills,
  type RestoreDrillInput,
} from "./operational-evidence.js";

const input = JSON.parse(
  await readFile(resolve(requiredEnvironment("RESTORE_DRILL_INPUT_PATH")), "utf8"),
) as RestoreDrillInput | RestoreDrillInput[];
const report = Array.isArray(input)
  ? evaluateRestoreDrills(input)
  : evaluateRestoreDrill(input);
await emitEvidence(report, process.env.RESTORE_DRILL_REPORT_PATH);
if (!report.passed) process.exitCode = 2;
