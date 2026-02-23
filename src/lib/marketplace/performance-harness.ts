export type BenchmarkSample = {
  latencyMs: number;
  bytes: number;
  ok: boolean;
  error?: string;
};

export type BenchmarkTargetInput = {
  name: string;
  url: string;
  samples: BenchmarkSample[];
};

export type BenchmarkTargetReport = {
  name: string;
  url: string;
  requestCount: number;
  successCount: number;
  errorCount: number;
  p50LatencyMs: number;
  p95LatencyMs: number;
  totalBytes: number;
  averageBytes: number;
  errors: string[];
};

export type BenchmarkReport = {
  generatedAt: string;
  samplesPerTarget: number;
  targets: BenchmarkTargetReport[];
};

function percentile(values: number[], p: number): number {
  if (values.length === 0) {
    return 0;
  }

  const sorted = [...values].sort((left, right) => left - right);
  const rank = Math.ceil((p / 100) * sorted.length) - 1;
  const index = Math.max(0, Math.min(sorted.length - 1, rank));
  return Math.round(sorted[index] ?? 0);
}

function toTargetReport(input: BenchmarkTargetInput): BenchmarkTargetReport {
  const requestCount = input.samples.length;
  const successSamples = input.samples.filter((sample) => sample.ok);
  const successCount = successSamples.length;
  const errorCount = requestCount - successCount;
  const totalBytes = successSamples.reduce((sum, sample) => sum + sample.bytes, 0);
  const averageBytes = successCount > 0
    ? Math.round(totalBytes / successCount)
    : 0;

  return {
    name: input.name,
    url: input.url,
    requestCount,
    successCount,
    errorCount,
    p50LatencyMs: percentile(successSamples.map((sample) => sample.latencyMs), 50),
    p95LatencyMs: percentile(successSamples.map((sample) => sample.latencyMs), 95),
    totalBytes,
    averageBytes,
    errors: input.samples
      .map((sample) => sample.error?.trim())
      .filter((error): error is string => Boolean(error)),
  };
}

export function buildBenchmarkReport(
  targets: BenchmarkTargetInput[],
  samplesPerTarget: number,
  generatedAt = new Date().toISOString(),
): BenchmarkReport {
  return {
    generatedAt,
    samplesPerTarget,
    targets: targets.map((target) => toTargetReport(target)),
  };
}
