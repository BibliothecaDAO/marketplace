import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { rankQualifiedProviders, type ProviderEvidence } from "./qualification.js";

const evidencePath = process.env.RPC_EVIDENCE_PATH?.trim();
if (!evidencePath) throw new Error("RPC_EVIDENCE_PATH is required.");
const evidence = JSON.parse(await readFile(resolve(evidencePath), "utf8")) as unknown;
if (!Array.isArray(evidence)) throw new Error("RPC evidence must be a JSON array.");
const ranking = rankQualifiedProviders(evidence as ProviderEvidence[]);
const output = `${JSON.stringify(ranking, null, 2)}\n`;
if (process.env.RPC_RANKING_REPORT) {
  await writeFile(resolve(process.env.RPC_RANKING_REPORT), output, { mode: 0o600 });
}
process.stdout.write(output);
