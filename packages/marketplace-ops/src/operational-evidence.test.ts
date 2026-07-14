import { describe, expect, it } from "vitest";
import {
  REQUIRED_CHAOS_SCENARIOS,
  evaluateChaosScenarios,
  evaluateRestoreDrill,
  evaluateRestoreDrills,
  evaluateSepoliaLifecycle,
  evaluateSoakSamples,
  type SoakSample,
} from "./operational-evidence.js";

function healthySoakSamples(): SoakSample[] {
  const start = Date.parse("2026-07-01T00:00:00.000Z");
  return Array.from({ length: 169 }, (_, hour) => ({
    observedAt: new Date(start + hour * 60 * 60 * 1_000).toISOString(),
    apiAvailable: true,
    cachedLatencyMs: 250 + (hour % 10),
    indexLagBlocks: hour % 3,
    mainnet: { cpuPercent: 50, memoryPercent: 55, diskPercent: 45 },
    sepolia: { cpuPercent: 35, memoryPercent: 40, diskPercent: 30 },
  }));
}

describe("operational release evidence", () => {
  it("accepts a complete seven-day soak and calculates SLO percentiles", () => {
    const report = evaluateSoakSamples(healthySoakSamples(), {
      minimumDurationHours: 168,
      maximumSampleGapSeconds: 3_600,
      minimumAvailabilityPercent: 99.9,
      maximumCachedP95Ms: 500,
      maximumP95LagBlocks: 2,
      maximumSustainedUtilizationPercent: 70,
    });

    expect(report).toEqual(expect.objectContaining({
      passed: true,
      durationHours: 168,
      availabilityPercent: 100,
      p95IndexLagBlocks: 2,
      cachedP95Ms: expect.any(Number),
      issues: [],
    }));
  });

  it("fails a soak with a sampling gap, excess lag, or excess utilization", () => {
    const samples = healthySoakSamples();
    samples[10] = {
      ...samples[10]!,
      indexLagBlocks: 5,
      mainnet: { cpuPercent: 90, memoryPercent: 90, diskPercent: 90 },
    };
    samples.splice(20, 1);
    const report = evaluateSoakSamples(samples, {
      minimumDurationHours: 168,
      maximumSampleGapSeconds: 3_600,
      minimumAvailabilityPercent: 99.9,
      maximumCachedP95Ms: 500,
      maximumP95LagBlocks: 0,
      maximumSustainedUtilizationPercent: 49,
    });

    expect(report.passed).toBe(false);
    expect(report.issues).toEqual(expect.arrayContaining([
      expect.stringMatching(/sample gap/i),
      expect.stringMatching(/lag/i),
      expect.stringMatching(/utilization/i),
    ]));
  });

  it("derives strict RPO and RTO from restore drill timestamps", () => {
    const passing = evaluateRestoreDrill({
      chain: "SN_MAIN",
      failureAt: "2026-07-14T00:05:00.000Z",
      latestReplicaAt: "2026-07-14T00:01:00.000Z",
      drillStartedAt: "2026-07-14T00:06:00.000Z",
      readyAt: "2026-07-14T01:05:00.000Z",
      restoredGeneration: "generation-123",
      indexedBlock: 123,
      chainHead: 123,
      reconciliationMatched: true,
    });
    expect(passing).toEqual(expect.objectContaining({
      passed: true,
      rpoMinutes: 4,
      rtoMinutes: 59,
    }));

    const failing = evaluateRestoreDrill({
      chain: "SN_MAIN",
      failureAt: "2026-07-14T00:06:00.000Z",
      latestReplicaAt: "2026-07-14T00:01:00.000Z",
      drillStartedAt: "2026-07-14T00:06:00.000Z",
      readyAt: "2026-07-14T01:06:00.000Z",
      restoredGeneration: "generation-124",
      indexedBlock: 122,
      chainHead: 123,
      reconciliationMatched: false,
    });
    expect(failing.passed).toBe(false);
    expect(failing.issues).toHaveLength(4);

    expect(evaluateRestoreDrills([
      passing,
      { ...passing, chain: "SN_SEPOLIA", restoredGeneration: "generation-456" },
    ])).toEqual(expect.objectContaining({
      passed: true,
      rpoMinutes: 4,
      rtoMinutes: 59,
      chains: [expect.objectContaining({ chain: "SN_MAIN" }), expect.objectContaining({ chain: "SN_SEPOLIA" })],
    }));
  });

  it("requires every failover, restart, pressure, and delayed-index chaos case", () => {
    const cases = REQUIRED_CHAOS_SCENARIOS.map((name) => ({
      name,
      passed: true,
      checkoutFailedClosed: ["torii_restart", "disk_pressure", "delayed_index"]
        .includes(name),
      observedAt: "2026-07-14T00:00:00.000Z",
    }));
    expect(evaluateChaosScenarios(cases)).toEqual(expect.objectContaining({
      passed: true,
      issues: [],
    }));

    expect(evaluateChaosScenarios(cases.slice(1))).toEqual(expect.objectContaining({
      passed: false,
      issues: expect.arrayContaining([expect.stringMatching(/missing/i)]),
    }));
  });

  it("validates the signed Sepolia list-to-purchase lifecycle and index convergence", () => {
    const expected = { worldAddress: "0x1", marketplaceAddress: "0x2" };
    const input = {
      worldAddress: "0x1",
      marketplaceAddress: "0x2",
      collection: "0x3",
      tokenId: "42",
      orderId: "7",
      seller: "0x4",
      buyer: "0x5",
      listTransactionHash: "0x6",
      listCaller: "0x4",
      listReceiptBlock: 100,
      listIndexedBlock: 100,
      listedOrderObserved: true,
      addToCartObserved: true,
      cartLookupObserved: true,
      purchaseTransactionHash: "0x7",
      purchaseCaller: "0x5",
      purchaseReceiptBlock: 101,
      purchaseIndexedBlock: 102,
      executedOrderObserved: true,
      resultingOwner: "0x5",
      finality: "accepted_l2" as const,
    };

    expect(evaluateSepoliaLifecycle(input, expected)).toEqual(expect.objectContaining({
      passed: true,
      issues: [],
      tokenId: "42",
    }));
    expect(evaluateSepoliaLifecycle({
      ...input,
      listIndexedBlock: 99,
      resultingOwner: "0x4",
      cartLookupObserved: false,
    }, expected)).toEqual(expect.objectContaining({
      passed: false,
      issues: expect.arrayContaining([
        expect.stringMatching(/list receipt/i),
        expect.stringMatching(/cart lookup/i),
        expect.stringMatching(/resulting owner/i),
      ]),
    }));
  });
});
