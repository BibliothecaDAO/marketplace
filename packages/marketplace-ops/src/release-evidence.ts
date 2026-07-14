import { createHash } from "node:crypto";
import { readFile, realpath, stat } from "node:fs/promises";
import { resolve, sep } from "node:path";
import { canonicalFelt } from "@biblio/marketplace-registry";
import {
  evaluateChaosScenarios,
  type ChaosScenario,
} from "./operational-evidence.js";

export const REQUIRED_RELEASE_ARTIFACTS = [
  "both_rpc_providers_qualified",
  "rpc_failover_passed",
  "deterministic_replays_match",
  "order_and_book_reconciled",
  "collections_verified",
  "historical_provenance_reconciled",
  "seven_day_soak_complete",
  "sepolia_lifecycle_passed",
  "chaos_tests_passed",
  "load_test_passed",
  "restore_drill_passed",
  "deterministic_playwright_passed",
  "zero_cartridge_read_requests",
  "arcade_import_boundary_passed",
  "contract_identity_unchanged",
  "checkout_fail_closed_passed",
  "torii_security_tests_passed",
  "infrastructure_security_checks_passed",
  "container_scans_and_sboms_passed",
] as const;

export type ReleaseArtifactName = (typeof REQUIRED_RELEASE_ARTIFACTS)[number];

export type EvidenceArtifactReference = {
  path: string;
  sha256: string;
};

export type ReleaseEvidenceManifest = {
  measuredAt: string;
  evidenceS3Uri: string;
  artifacts: Record<ReleaseArtifactName, EvidenceArtifactReference>;
};

type EvidenceReport = Record<string, unknown> & { passed: true };

export type TerraformReleaseInputs = {
  launch_enabled: true;
  release_evidence: {
    measured_at: string;
    evidence_s3_uri: string;
    both_rpc_providers_qualified: true;
    rpc_failover_passed: true;
    deterministic_replays_match: true;
    order_and_book_reconciled: true;
    collections_verified: true;
    historical_provenance_reconciled: true;
    seven_day_soak_complete: true;
    sepolia_lifecycle_passed: true;
    chaos_and_load_tests_passed: true;
    deterministic_playwright_passed: true;
    zero_cartridge_read_requests: true;
    arcade_import_boundary_passed: true;
    contract_identity_unchanged: true;
    checkout_fail_closed_passed: true;
    p95_index_lag_blocks: number;
    api_availability_percent: number;
    api_cached_p95_ms: number;
    mainnet_cpu_percent: number;
    mainnet_memory_percent: number;
    mainnet_disk_percent: number;
    sepolia_cpu_percent: number;
    sepolia_memory_percent: number;
    sepolia_disk_percent: number;
    restore_rpo_minutes: number;
    restore_rto_minutes: number;
  };
};

export async function createReleaseEvidenceManifest(
  evidenceDirectory: string,
  options: Pick<ReleaseEvidenceManifest, "measuredAt" | "evidenceS3Uri">,
): Promise<ReleaseEvidenceManifest> {
  const root = resolve(evidenceDirectory);
  // Reuse runtime validation for the non-artifact manifest fields after the
  // deterministic artifact map has been constructed.
  const artifacts = {} as ReleaseEvidenceManifest["artifacts"];
  for (const name of REQUIRED_RELEASE_ARTIFACTS) {
    const path = `${name}.json`;
    const content = await readFile(resolve(root, path));
    artifacts[name] = {
      path,
      sha256: `sha256:${createHash("sha256").update(content).digest("hex")}`,
    };
  }
  return parseManifest({ ...options, artifacts });
}

function record(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be a JSON object.`);
  }
  return value as Record<string, unknown>;
}

function stringField(value: unknown, label: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${label} is required.`);
  return value;
}

function numberField(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`${label} must be a finite number.`);
  }
  return value;
}

function parseManifest(value: unknown): ReleaseEvidenceManifest {
  const manifest = record(value, "Release evidence manifest");
  const measuredAt = stringField(manifest.measuredAt, "measuredAt");
  if (!Number.isFinite(Date.parse(measuredAt))) throw new Error("measuredAt is invalid.");
  const evidenceS3Uri = stringField(manifest.evidenceS3Uri, "evidenceS3Uri");
  if (!/^s3:\/\/[^/]+\/.+\/manifest\.json$/.test(evidenceS3Uri)) {
    throw new Error("evidenceS3Uri must identify an immutable S3 manifest.json object.");
  }
  const rawArtifacts = record(manifest.artifacts, "artifacts");
  const required = new Set<string>(REQUIRED_RELEASE_ARTIFACTS);
  for (const name of Object.keys(rawArtifacts)) {
    if (!required.has(name)) throw new Error(`Unknown release artifact ${name}.`);
  }
  const artifacts = {} as ReleaseEvidenceManifest["artifacts"];
  for (const name of REQUIRED_RELEASE_ARTIFACTS) {
    const reference = record(rawArtifacts[name], `artifacts.${name}`);
    const path = stringField(reference.path, `artifacts.${name}.path`);
    const sha256 = stringField(reference.sha256, `artifacts.${name}.sha256`);
    if (!/^sha256:[0-9a-f]{64}$/.test(sha256)) {
      throw new Error(`artifacts.${name}.sha256 is not a SHA-256 digest.`);
    }
    artifacts[name] = { path, sha256 };
  }
  return { measuredAt, evidenceS3Uri, artifacts };
}

async function readVerifiedReport(
  root: string,
  name: ReleaseArtifactName,
  reference: EvidenceArtifactReference,
): Promise<EvidenceReport> {
  const candidate = resolve(root, reference.path);
  if (candidate === root || !candidate.startsWith(`${root}${sep}`)) {
    throw new Error(`Artifact ${name} must stay inside the evidence directory.`);
  }
  const [realRoot, realCandidate] = await Promise.all([realpath(root), realpath(candidate)]);
  if (!realCandidate.startsWith(`${realRoot}${sep}`)) {
    throw new Error(`Artifact ${name} must stay inside the evidence directory.`);
  }
  const metadata = await stat(realCandidate);
  if (!metadata.isFile() || metadata.size > 10 * 1024 * 1024) {
    throw new Error(`Artifact ${name} must be a regular JSON file no larger than 10 MiB.`);
  }
  const content = await readFile(realCandidate);
  const actual = `sha256:${createHash("sha256").update(content).digest("hex")}`;
  if (actual !== reference.sha256) {
    throw new Error(`Artifact ${name} digest differs from the release manifest.`);
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(content.toString("utf8"));
  } catch {
    throw new Error(`Artifact ${name} is not valid JSON.`);
  }
  const report = record(parsed, `Artifact ${name}`);
  if (report.passed !== true) throw new Error(`Artifact ${name} did not pass.`);
  return report as EvidenceReport;
}

function validateSoakReport(report: EvidenceReport) {
  const durationHours = numberField(report.durationHours, "Soak durationHours");
  const maximumSampleGapSeconds = numberField(
    report.maximumObservedSampleGapSeconds,
    "Soak maximumObservedSampleGapSeconds",
  );
  const availabilityPercent = numberField(
    report.availabilityPercent,
    "Soak availabilityPercent",
  );
  const cachedP95Ms = numberField(report.cachedP95Ms, "Soak cachedP95Ms");
  const p95IndexLagBlocks = numberField(
    report.p95IndexLagBlocks,
    "Soak p95IndexLagBlocks",
  );
  const utilization = record(report.utilization, "Soak utilization");
  const mainnet = record(utilization.mainnet, "Soak mainnet utilization");
  const sepolia = record(utilization.sepolia, "Soak Sepolia utilization");
  const resources = {
    mainnetCpu: numberField(mainnet.cpuPercent, "Mainnet CPU"),
    mainnetMemory: numberField(mainnet.memoryPercent, "Mainnet memory"),
    mainnetDisk: numberField(mainnet.diskPercent, "Mainnet disk"),
    sepoliaCpu: numberField(sepolia.cpuPercent, "Sepolia CPU"),
    sepoliaMemory: numberField(sepolia.memoryPercent, "Sepolia memory"),
    sepoliaDisk: numberField(sepolia.diskPercent, "Sepolia disk"),
  };
  if (durationHours < 168) throw new Error("Seven-day soak evidence is incomplete.");
  if (maximumSampleGapSeconds > 300) throw new Error("Seven-day soak contains a sample gap.");
  if (availabilityPercent < 99.9) throw new Error("Soak availability is below 99.9%.");
  if (cachedP95Ms >= 500) throw new Error("Soak cached API p95 is not under 500 ms.");
  if (p95IndexLagBlocks > 2) throw new Error("Soak p95 index lag exceeds two blocks.");
  if (Object.values(resources).some((value) => value >= 70)) {
    throw new Error("Soak sustained utilization is not below 70%.");
  }
  return { availabilityPercent, cachedP95Ms, p95IndexLagBlocks, resources };
}

function validateLoadReport(report: EvidenceReport) {
  const totalRequests = numberField(report.totalRequests, "Load totalRequests");
  const availabilityPercent = numberField(
    report.availabilityPercent,
    "Load availabilityPercent",
  );
  const p95Ms = numberField(report.p95Ms, "Load p95Ms");
  const scenarios = record(report.scenarios, "Load scenarios");
  const scenarioRequests = ["collections", "tokens", "listings", "cart_lookup_25"].map(
    (name) => numberField(
      record(scenarios[name], `Load ${name} scenario`).requests,
      `Load ${name} requests`,
    ),
  );
  if (totalRequests <= 0 || scenarioRequests.some((requests) => requests <= 0)) {
    throw new Error("Load report must include browsing and 25-order cart traffic.");
  }
  if (availabilityPercent < 99.9) throw new Error("Load availability is below 99.9%.");
  if (p95Ms >= 500) throw new Error("Load cached API p95 is not under 500 ms.");
  return { availabilityPercent, p95Ms };
}

function validateRestoreReport(report: EvidenceReport) {
  const rpoMinutes = numberField(report.rpoMinutes, "Restore RPO");
  const rtoMinutes = numberField(report.rtoMinutes, "Restore RTO");
  if (rpoMinutes >= 5) throw new Error("Restore RPO is not under 5 minutes.");
  if (rtoMinutes >= 60) throw new Error("Restore RTO is not under 60 minutes.");
  if (!Array.isArray(report.chains)) throw new Error("Restore report must include both chains.");
  const passingChains = new Set(
    report.chains.flatMap((entry) => {
      const chain = record(entry, "Restore chain report");
      return chain.passed === true && (chain.chain === "SN_MAIN" || chain.chain === "SN_SEPOLIA")
        ? [chain.chain]
        : [];
    }),
  );
  if (!passingChains.has("SN_MAIN") || !passingChains.has("SN_SEPOLIA")) {
    throw new Error("Restore report must pass for Mainnet and Sepolia.");
  }
  return { rpoMinutes, rtoMinutes };
}

function validateSepoliaLifecycleReport(report: EvidenceReport): void {
  const seller = canonicalFelt(stringField(report.seller, "Lifecycle seller"));
  const buyer = canonicalFelt(stringField(report.buyer, "Lifecycle buyer"));
  const listCaller = canonicalFelt(stringField(report.listCaller, "Lifecycle listCaller"));
  const purchaseCaller = canonicalFelt(
    stringField(report.purchaseCaller, "Lifecycle purchaseCaller"),
  );
  const resultingOwner = canonicalFelt(
    stringField(report.resultingOwner, "Lifecycle resultingOwner"),
  );
  const listTransactionHash = canonicalFelt(
    stringField(report.listTransactionHash, "Lifecycle listTransactionHash"),
  );
  const purchaseTransactionHash = canonicalFelt(
    stringField(report.purchaseTransactionHash, "Lifecycle purchaseTransactionHash"),
  );
  const listReceiptBlock = numberField(report.listReceiptBlock, "Lifecycle listReceiptBlock");
  const listIndexedBlock = numberField(report.listIndexedBlock, "Lifecycle listIndexedBlock");
  const purchaseReceiptBlock = numberField(
    report.purchaseReceiptBlock,
    "Lifecycle purchaseReceiptBlock",
  );
  const purchaseIndexedBlock = numberField(
    report.purchaseIndexedBlock,
    "Lifecycle purchaseIndexedBlock",
  );
  if (
    seller === buyer ||
    listCaller !== seller ||
    purchaseCaller !== buyer ||
    resultingOwner !== buyer
  ) {
    throw new Error("Sepolia lifecycle callers or resulting owner do not match.");
  }
  if (BigInt(listTransactionHash) === 0n || BigInt(purchaseTransactionHash) === 0n) {
    throw new Error("Sepolia lifecycle transaction hashes must be non-zero.");
  }
  if (listIndexedBlock < listReceiptBlock || purchaseIndexedBlock < purchaseReceiptBlock) {
    throw new Error("Sepolia lifecycle indexer did not reach both receipt blocks.");
  }
  for (const field of [
    "listedOrderObserved",
    "addToCartObserved",
    "cartLookupObserved",
    "executedOrderObserved",
  ]) {
    if (report[field] !== true) throw new Error(`Sepolia lifecycle ${field} did not pass.`);
  }
  if (report.finality !== "accepted_l2") {
    throw new Error("Sepolia lifecycle finality must be accepted_l2.");
  }
}

export async function verifyReleaseEvidenceBundle(
  evidenceDirectory: string,
  rawManifest: unknown,
): Promise<TerraformReleaseInputs> {
  const root = resolve(evidenceDirectory);
  const manifest = parseManifest(rawManifest);
  const reports = new Map<ReleaseArtifactName, EvidenceReport>();
  const usedPaths = new Set<string>();
  for (const name of REQUIRED_RELEASE_ARTIFACTS) {
    const reference = manifest.artifacts[name];
    const normalizedPath = resolve(root, reference.path);
    if (usedPaths.has(normalizedPath)) {
      throw new Error(`Release artifact path ${reference.path} is reused by multiple gates.`);
    }
    usedPaths.add(normalizedPath);
    reports.set(name, await readVerifiedReport(root, name, reference));
  }

  const soak = validateSoakReport(reports.get("seven_day_soak_complete")!);
  const load = validateLoadReport(reports.get("load_test_passed")!);
  const restore = validateRestoreReport(reports.get("restore_drill_passed")!);
  const chaos = reports.get("chaos_tests_passed")!;
  if (!Array.isArray(chaos.scenarios)) {
    throw new Error("Chaos evidence does not contain scenarios.");
  }
  const chaosResult = evaluateChaosScenarios(chaos.scenarios as ChaosScenario[]);
  if (!chaosResult.passed) throw new Error(`Chaos evidence failed: ${chaosResult.issues.join(" ")}`);
  validateSepoliaLifecycleReport(reports.get("sepolia_lifecycle_passed")!);

  return {
    launch_enabled: true,
    release_evidence: {
      measured_at: manifest.measuredAt,
      evidence_s3_uri: manifest.evidenceS3Uri,
      both_rpc_providers_qualified: true,
      rpc_failover_passed: true,
      deterministic_replays_match: true,
      order_and_book_reconciled: true,
      collections_verified: true,
      historical_provenance_reconciled: true,
      seven_day_soak_complete: true,
      sepolia_lifecycle_passed: true,
      chaos_and_load_tests_passed: true,
      deterministic_playwright_passed: true,
      zero_cartridge_read_requests: true,
      arcade_import_boundary_passed: true,
      contract_identity_unchanged: true,
      checkout_fail_closed_passed: true,
      p95_index_lag_blocks: soak.p95IndexLagBlocks,
      api_availability_percent: Math.min(
        soak.availabilityPercent,
        load.availabilityPercent,
      ),
      api_cached_p95_ms: Math.max(soak.cachedP95Ms, load.p95Ms),
      mainnet_cpu_percent: soak.resources.mainnetCpu,
      mainnet_memory_percent: soak.resources.mainnetMemory,
      mainnet_disk_percent: soak.resources.mainnetDisk,
      sepolia_cpu_percent: soak.resources.sepoliaCpu,
      sepolia_memory_percent: soak.resources.sepoliaMemory,
      sepolia_disk_percent: soak.resources.sepoliaDisk,
      restore_rpo_minutes: restore.rpoMinutes,
      restore_rto_minutes: restore.rtoMinutes,
    },
  };
}
