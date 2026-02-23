import { describe, expect, it } from "vitest";
import { buildBenchmarkReport } from "@/lib/marketplace/performance-harness";

describe("performance harness", () => {
  it("builds_benchmark_report_with_expected_schema", () => {
    const report = buildBenchmarkReport(
      [
        {
          name: "collection-route",
          url: "http://localhost:3000/collections/0xabc",
          samples: [
            { latencyMs: 100, bytes: 1000, ok: true },
            { latencyMs: 250, bytes: 900, ok: true },
            { latencyMs: 400, bytes: 1200, ok: true },
          ],
        },
      ],
      3,
      "2026-02-23T00:00:00.000Z",
    );

    expect(report).toEqual({
      generatedAt: "2026-02-23T00:00:00.000Z",
      samplesPerTarget: 3,
      targets: [
        {
          name: "collection-route",
          url: "http://localhost:3000/collections/0xabc",
          requestCount: 3,
          successCount: 3,
          errorCount: 0,
          p50LatencyMs: 250,
          p95LatencyMs: 400,
          totalBytes: 3100,
          averageBytes: 1033,
          errors: [],
        },
      ],
    });
  });
});
