import { describe, expect, it, vi } from "vitest";
import {
  buildOwnedApiLoadScenarios,
  evaluateLoadSamples,
  runOwnedApiLoadTest,
  type LoadSample,
} from "./load.js";

const felt = (value: string) => `0x${value.padStart(64, "0")}`;

describe("owned API load harness", () => {
  it("builds browse traffic and a full 25-order cart lookup", () => {
    const scenarios = buildOwnedApiLoadScenarios({
      chain: "SN_MAIN",
      collection: "0x2",
      currency: "0x3",
      orderKeys: Array.from({ length: 25 }, (_, index) => ({
        id: String(index + 1),
        collection: "0x2",
        tokenId: String(index + 100),
      })),
    });

    expect(scenarios.map((scenario) => scenario.name)).toEqual([
      "collections",
      "tokens",
      "listings",
      "cart_lookup_25",
    ]);
    expect(JSON.parse(scenarios[3]?.body ?? "{}").orders).toHaveLength(25);
    expect(scenarios[1]?.path).toContain(`currency=${felt("3")}`);
  });

  it("calculates nearest-rank latency and enforces availability and p95 gates", () => {
    const samples: LoadSample[] = Array.from({ length: 1_000 }, (_, index) => ({
      scenario: index % 2 === 0 ? "tokens" : "cart_lookup_25",
      durationMs: index + 1,
      statusCode: index === 999 ? 503 : 200,
      ok: index !== 999,
    }));

    const report = evaluateLoadSamples(samples, {
      startedAt: "2026-07-14T00:00:00.000Z",
      completedAt: "2026-07-14T00:05:00.000Z",
      minimumAvailabilityPercent: 99.9,
      maximumCachedP95Ms: 950,
    });
    expect(report.availabilityPercent).toBe(99.9);
    expect(report.p95Ms).toBe(950);
    expect(report.passed).toBe(true);

    expect(evaluateLoadSamples(samples, {
      startedAt: report.startedAt,
      completedAt: report.completedAt,
      minimumAvailabilityPercent: 99.91,
      maximumCachedP95Ms: 949,
    })).toEqual(expect.objectContaining({
      passed: false,
      issues: expect.arrayContaining([
        expect.stringMatching(/availability/i),
        expect.stringMatching(/p95/i),
      ]),
    }));
  });

  it("runs all scenarios concurrently and records HTTP failures", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async (input, init) => {
      const isLookup = String(input).endsWith("/orders/lookup");
      expect(init?.method).toBe(isLookup ? "POST" : "GET");
      if (fetchImpl.mock.calls.length === 7) {
        return Response.json({ error: "busy" }, { status: 503 });
      }
      return Response.json({ data: {}, meta: {} });
    });
    const scenarios = buildOwnedApiLoadScenarios({
      chain: "SN_MAIN",
      collection: "0x2",
      currency: "0x3",
      orderKeys: Array.from({ length: 25 }, (_, index) => ({
        id: String(index + 1),
        collection: "0x2",
        tokenId: String(index + 1),
      })),
    });

    const report = await runOwnedApiLoadTest({
      baseUrl: "http://127.0.0.1:3001",
      scenarios,
      concurrency: 2,
      totalRequests: 8,
      timeoutMs: 1_000,
      minimumAvailabilityPercent: 100,
      maximumCachedP95Ms: 10_000,
      fetchImpl,
    });

    // Four warm-up calls plus eight measured calls.
    expect(fetchImpl).toHaveBeenCalledTimes(12);
    expect(report.totalRequests).toBe(8);
    expect(report.successfulRequests).toBe(7);
    expect(report.passed).toBe(false);
    expect(report.scenarios.cart_lookup_25?.requests).toBe(2);
  });
});
