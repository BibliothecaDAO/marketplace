import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { compareReplayReports, type ReplayReport } from "./reconciliation.js";

const paths = process.argv.slice(2);
if (paths.length !== 2) {
  throw new Error("Usage: verify-replays <first-report.json> <second-report.json>");
}
const reports = await Promise.all(
  paths.map(async (path) => JSON.parse(await readFile(resolve(path), "utf8")) as ReplayReport),
);
const comparison = compareReplayReports(reports[0]!, reports[1]!);
process.stdout.write(`${JSON.stringify(comparison, null, 2)}\n`);
if (!comparison.matched) process.exitCode = 2;
