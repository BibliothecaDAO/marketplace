import { createHash } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  REQUIRED_RELEASE_ARTIFACTS,
  createReleaseEvidenceManifest,
  verifyReleaseEvidenceBundle,
  type ReleaseArtifactName,
  type ReleaseEvidenceManifest,
} from "./release-evidence.js";

const directories: string[] = [];

afterEach(async () => {
  await Promise.all(directories.splice(0).map((directory) =>
    rm(directory, { recursive: true, force: true }),
  ));
});

function hash(content: string): string {
  return `sha256:${createHash("sha256").update(content).digest("hex")}`;
}

async function createBundle() {
  const directory = await mkdtemp(join(tmpdir(), "marketplace-release-evidence-"));
  directories.push(directory);
  const reports: Partial<Record<ReleaseArtifactName, Record<string, unknown>>> = {
    seven_day_soak_complete: {
      passed: true,
      durationHours: 168,
      maximumObservedSampleGapSeconds: 300,
      availabilityPercent: 99.95,
      cachedP95Ms: 300,
      p95IndexLagBlocks: 2,
      utilization: {
        mainnet: { cpuPercent: 55, memoryPercent: 60, diskPercent: 50 },
        sepolia: { cpuPercent: 35, memoryPercent: 45, diskPercent: 30 },
      },
    },
    load_test_passed: {
      passed: true,
      totalRequests: 10_000,
      availabilityPercent: 99.99,
      p95Ms: 350,
      scenarios: {
        collections: { requests: 2_500 },
        tokens: { requests: 2_500 },
        listings: { requests: 2_500 },
        cart_lookup_25: { requests: 2_500 },
      },
    },
    restore_drill_passed: {
      passed: true,
      rpoMinutes: 4,
      rtoMinutes: 59,
      chains: [
        { chain: "SN_MAIN", passed: true },
        { chain: "SN_SEPOLIA", passed: true },
      ],
    },
    chaos_tests_passed: {
      passed: true,
      scenarios: [
        "rpc_transport_failover",
        "rpc_timeout_failover",
        "rpc_429_failover",
        "rpc_5xx_failover",
        "rpc_deterministic_error_not_failed_over",
        "torii_restart",
        "disk_pressure",
        "delayed_index",
      ].map((name) => ({
        name,
        passed: true,
        checkoutFailedClosed: ["torii_restart", "disk_pressure", "delayed_index"].includes(name),
        observedAt: "2026-07-14T00:00:00.000Z",
      })),
    },
    sepolia_lifecycle_passed: {
      passed: true,
      seller: "0x4",
      buyer: "0x5",
      listCaller: "0x4",
      purchaseCaller: "0x5",
      listTransactionHash: "0x6",
      purchaseTransactionHash: "0x7",
      listReceiptBlock: 100,
      listIndexedBlock: 100,
      listedOrderObserved: true,
      addToCartObserved: true,
      cartLookupObserved: true,
      purchaseReceiptBlock: 101,
      purchaseIndexedBlock: 101,
      executedOrderObserved: true,
      resultingOwner: "0x5",
      finality: "accepted_l2",
    },
  };
  const artifacts = {} as ReleaseEvidenceManifest["artifacts"];
  for (const name of REQUIRED_RELEASE_ARTIFACTS) {
    const content = `${JSON.stringify(reports[name] ?? { passed: true })}\n`;
    const path = `${name}.json`;
    await writeFile(join(directory, path), content);
    artifacts[name] = { path, sha256: hash(content) };
  }
  const manifest: ReleaseEvidenceManifest = {
    measuredAt: "2026-07-14T00:00:00.000Z",
    evidenceS3Uri: "s3://marketplace-evidence/releases/2026-07-14/manifest.json",
    artifacts,
  };
  return { directory, manifest };
}

describe("release evidence bundle", () => {
  it("derives Terraform launch inputs from complete hash-verified reports", async () => {
    const { directory, manifest } = await createBundle();
    await expect(createReleaseEvidenceManifest(directory, {
      measuredAt: manifest.measuredAt,
      evidenceS3Uri: manifest.evidenceS3Uri,
    })).resolves.toEqual(manifest);
    const result = await verifyReleaseEvidenceBundle(directory, manifest);

    expect(result).toEqual({
      launch_enabled: true,
      release_evidence: expect.objectContaining({
        measured_at: manifest.measuredAt,
        evidence_s3_uri: manifest.evidenceS3Uri,
        both_rpc_providers_qualified: true,
        chaos_and_load_tests_passed: true,
        p95_index_lag_blocks: 2,
        api_availability_percent: 99.95,
        api_cached_p95_ms: 350,
        mainnet_cpu_percent: 55,
        sepolia_disk_percent: 30,
        restore_rpo_minutes: 4,
        restore_rto_minutes: 59,
      }),
    });
  });

  it("rejects tampering, path traversal, and a passed report with failing metrics", async () => {
    const tampered = await createBundle();
    await writeFile(
      join(tampered.directory, "rpc_failover_passed.json"),
      '{"passed":false}\n',
    );
    await expect(verifyReleaseEvidenceBundle(tampered.directory, tampered.manifest))
      .rejects.toThrow(/digest/i);

    const traversed = await createBundle();
    traversed.manifest.artifacts.rpc_failover_passed = {
      path: "../outside.json",
      sha256: `sha256:${"0".repeat(64)}`,
    };
    await expect(verifyReleaseEvidenceBundle(traversed.directory, traversed.manifest))
      .rejects.toThrow(/inside the evidence directory/i);

    const badMetrics = await createBundle();
    const content = '{"passed":true,"rpoMinutes":5,"rtoMinutes":60,"chains":[{"chain":"SN_MAIN","passed":true},{"chain":"SN_SEPOLIA","passed":true}]}\n';
    await writeFile(join(badMetrics.directory, "restore_drill_passed.json"), content);
    badMetrics.manifest.artifacts.restore_drill_passed.sha256 = hash(content);
    await expect(verifyReleaseEvidenceBundle(badMetrics.directory, badMetrics.manifest))
      .rejects.toThrow(/RPO/i);
  });
});
