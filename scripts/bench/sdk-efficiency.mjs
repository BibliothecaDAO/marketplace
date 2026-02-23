#!/usr/bin/env node

import { writeFile } from "node:fs/promises";

function parseArgs(argv) {
  const args = {
    samples: 5,
    out: ".context/sdk-efficiency-report.json",
    targets: [],
  };

  for (let index = 2; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--samples") {
      args.samples = Number.parseInt(argv[index + 1] ?? "5", 10);
      index += 1;
      continue;
    }

    if (arg === "--out") {
      args.out = argv[index + 1] ?? args.out;
      index += 1;
      continue;
    }

    if (arg === "--target") {
      const value = argv[index + 1] ?? "";
      const [name, url] = value.split("=");
      if (name && url) {
        args.targets.push({ name, url });
      }
      index += 1;
      continue;
    }
  }

  return args;
}

function percentile(values, p) {
  if (values.length === 0) {
    return 0;
  }

  const sorted = [...values].sort((left, right) => left - right);
  const rank = Math.ceil((p / 100) * sorted.length) - 1;
  const index = Math.max(0, Math.min(sorted.length - 1, rank));
  return Math.round(sorted[index] ?? 0);
}

async function sampleTarget(target, samples) {
  const entries = [];

  for (let index = 0; index < samples; index += 1) {
    const startedAt = performance.now();

    try {
      const response = await fetch(target.url, {
        method: "GET",
        headers: {
          "cache-control": "no-cache",
        },
      });
      const body = await response.text();
      const endedAt = performance.now();

      entries.push({
        latencyMs: endedAt - startedAt,
        bytes: Buffer.byteLength(body, "utf8"),
        ok: response.ok,
        error: response.ok ? undefined : `${response.status} ${response.statusText}`,
      });
    } catch (error) {
      const endedAt = performance.now();
      entries.push({
        latencyMs: endedAt - startedAt,
        bytes: 0,
        ok: false,
        error: error instanceof Error ? error.message : "Unknown fetch error",
      });
    }
  }

  return entries;
}

function buildReport(targets, samplesPerTarget) {
  return {
    generatedAt: new Date().toISOString(),
    samplesPerTarget,
    targets: targets.map((target) => {
      const requestCount = target.samples.length;
      const successful = target.samples.filter((sample) => sample.ok);
      const successCount = successful.length;
      const errorCount = requestCount - successCount;
      const latencies = successful.map((sample) => sample.latencyMs);
      const totalBytes = successful.reduce((sum, sample) => sum + sample.bytes, 0);

      return {
        name: target.name,
        url: target.url,
        requestCount,
        successCount,
        errorCount,
        p50LatencyMs: percentile(latencies, 50),
        p95LatencyMs: percentile(latencies, 95),
        totalBytes,
        averageBytes: successCount > 0 ? Math.round(totalBytes / successCount) : 0,
        errors: target.samples
          .map((sample) => sample.error)
          .filter((error) => Boolean(error)),
      };
    }),
  };
}

async function main() {
  const args = parseArgs(process.argv);
  if (args.targets.length === 0) {
    console.error("No targets provided. Use --target name=url");
    process.exitCode = 1;
    return;
  }

  const targetSamples = [];
  for (const target of args.targets) {
    const samples = await sampleTarget(target, args.samples);
    targetSamples.push({
      ...target,
      samples,
    });
  }

  const report = buildReport(targetSamples, args.samples);
  await writeFile(args.out, JSON.stringify(report, null, 2), "utf8");
  console.log(`Wrote SDK efficiency report to ${args.out}`);
}

await main();
