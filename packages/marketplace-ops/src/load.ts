import {
  canonicalFelt,
  type MarketplaceChainAlias,
} from "@biblio/marketplace-registry";

export type LoadOrderKey = {
  id: string;
  collection: string;
  tokenId: string;
};

export type LoadScenario = {
  name: string;
  method: "GET" | "POST";
  path: string;
  body?: string;
};

export type LoadSample = {
  scenario: string;
  durationMs: number;
  statusCode: number | null;
  ok: boolean;
  error?: string;
};

export type LoadScenarioSummary = {
  requests: number;
  successfulRequests: number;
  availabilityPercent: number;
  p50Ms: number;
  p95Ms: number;
  p99Ms: number;
};

export type OwnedApiLoadReport = {
  startedAt: string;
  completedAt: string;
  durationMs: number;
  totalRequests: number;
  successfulRequests: number;
  availabilityPercent: number;
  p50Ms: number;
  p95Ms: number;
  p99Ms: number;
  scenarios: Record<string, LoadScenarioSummary>;
  thresholds: {
    minimumAvailabilityPercent: number;
    maximumCachedP95Ms: number;
  };
  passed: boolean;
  issues: string[];
};

function unsignedDecimal(value: string, label: string): string {
  if (!/^(0|[1-9][0-9]*)$/.test(value)) {
    throw new Error(`${label} must be an unsigned decimal string.`);
  }
  return BigInt(value).toString();
}

export function buildOwnedApiLoadScenarios(options: {
  chain: MarketplaceChainAlias;
  collection: string;
  currency: string;
  orderKeys: LoadOrderKey[];
}): LoadScenario[] {
  if (options.orderKeys.length !== 25) {
    throw new Error("The cart load scenario requires exactly 25 order keys.");
  }
  const collection = canonicalFelt(options.collection);
  const currency = canonicalFelt(options.currency);
  const orders = options.orderKeys.map((key, index) => ({
    id: unsignedDecimal(key.id, `orderKeys[${index}].id`),
    collection: canonicalFelt(key.collection),
    tokenId: unsignedDecimal(key.tokenId, `orderKeys[${index}].tokenId`),
  }));
  const collectionPath = `/v1/chains/${options.chain}/collections/${collection}`;
  const selectedCurrency = encodeURIComponent(currency);
  return [
    {
      name: "collections",
      method: "GET",
      path: `/v1/chains/${options.chain}/collections`,
    },
    {
      name: "tokens",
      method: "GET",
      path: `${collectionPath}/tokens?limit=24&sort=recent&currency=${selectedCurrency}`,
    },
    {
      name: "listings",
      method: "GET",
      path: `${collectionPath}/listings?limit=24&currency=${selectedCurrency}`,
    },
    {
      name: "cart_lookup_25",
      method: "POST",
      path: `/v1/chains/${options.chain}/orders/lookup`,
      body: JSON.stringify({ orders }),
    },
  ];
}

function percentile(values: number[], percentileValue: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.max(0, Math.ceil(sorted.length * percentileValue) - 1);
  return sorted[index] ?? 0;
}

function summarize(samples: LoadSample[]): LoadScenarioSummary {
  const successfulRequests = samples.filter((sample) => sample.ok).length;
  const durations = samples.map((sample) => sample.durationMs);
  return {
    requests: samples.length,
    successfulRequests,
    availabilityPercent: samples.length === 0
      ? 0
      : (successfulRequests / samples.length) * 100,
    p50Ms: percentile(durations, 0.5),
    p95Ms: percentile(durations, 0.95),
    p99Ms: percentile(durations, 0.99),
  };
}

export function evaluateLoadSamples(
  samples: LoadSample[],
  options: {
    startedAt: string;
    completedAt: string;
    minimumAvailabilityPercent: number;
    maximumCachedP95Ms: number;
  },
): OwnedApiLoadReport {
  if (samples.length === 0) throw new Error("Load evidence contains no requests.");
  const started = Date.parse(options.startedAt);
  const completed = Date.parse(options.completedAt);
  if (!Number.isFinite(started) || !Number.isFinite(completed) || completed < started) {
    throw new Error("Load evidence timestamps are invalid.");
  }
  const overall = summarize(samples);
  const scenarios: Record<string, LoadScenarioSummary> = {};
  for (const name of new Set(samples.map((sample) => sample.scenario))) {
    scenarios[name] = summarize(samples.filter((sample) => sample.scenario === name));
  }
  const issues: string[] = [];
  if (overall.availabilityPercent < options.minimumAvailabilityPercent) {
    issues.push(
      `Availability ${overall.availabilityPercent.toFixed(3)}% is below ${options.minimumAvailabilityPercent}%.`,
    );
  }
  if (overall.p95Ms > options.maximumCachedP95Ms) {
    issues.push(
      `Cached API p95 ${overall.p95Ms.toFixed(2)} ms exceeds ${options.maximumCachedP95Ms} ms.`,
    );
  }
  return {
    startedAt: options.startedAt,
    completedAt: options.completedAt,
    durationMs: completed - started,
    totalRequests: overall.requests,
    successfulRequests: overall.successfulRequests,
    availabilityPercent: overall.availabilityPercent,
    p50Ms: overall.p50Ms,
    p95Ms: overall.p95Ms,
    p99Ms: overall.p99Ms,
    scenarios,
    thresholds: {
      minimumAvailabilityPercent: options.minimumAvailabilityPercent,
      maximumCachedP95Ms: options.maximumCachedP95Ms,
    },
    passed: issues.length === 0,
    issues,
  };
}

async function executeScenario(options: {
  baseUrl: string;
  scenario: LoadScenario;
  runId: string;
  timeoutMs: number;
  fetchImpl: typeof fetch;
}): Promise<LoadSample> {
  const started = performance.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs);
  try {
    const response = await options.fetchImpl(
      `${options.baseUrl}${options.scenario.path}`,
      {
        method: options.scenario.method,
        headers: {
          accept: "application/json",
          "x-marketplace-load-run": options.runId,
          ...(options.scenario.body ? { "content-type": "application/json" } : {}),
        },
        body: options.scenario.body,
        signal: controller.signal,
      },
    );
    await response.arrayBuffer();
    return {
      scenario: options.scenario.name,
      durationMs: performance.now() - started,
      statusCode: response.status,
      ok: response.ok,
      ...(response.ok ? {} : { error: `HTTP ${response.status}` }),
    };
  } catch (error) {
    return {
      scenario: options.scenario.name,
      durationMs: performance.now() - started,
      statusCode: null,
      ok: false,
      error: controller.signal.aborted
        ? "request timed out"
        : error instanceof Error ? error.message : String(error),
    };
  } finally {
    clearTimeout(timeout);
  }
}

export async function runOwnedApiLoadTest(options: {
  baseUrl: string;
  scenarios: LoadScenario[];
  concurrency: number;
  durationMs?: number;
  totalRequests?: number;
  timeoutMs: number;
  minimumAvailabilityPercent: number;
  maximumCachedP95Ms: number;
  fetchImpl?: typeof fetch;
  runId?: string;
}): Promise<OwnedApiLoadReport> {
  if (options.scenarios.length === 0) throw new Error("At least one load scenario is required.");
  if (!Number.isInteger(options.concurrency) || options.concurrency < 1 || options.concurrency > 200) {
    throw new Error("Load concurrency must be between 1 and 200.");
  }
  if (!Number.isFinite(options.timeoutMs) || options.timeoutMs <= 0) {
    throw new Error("Load request timeout must be positive.");
  }
  const hasDuration = options.durationMs !== undefined;
  const hasTotal = options.totalRequests !== undefined;
  if (hasDuration === hasTotal) {
    throw new Error("Set exactly one of durationMs or totalRequests.");
  }
  if (hasDuration && (!Number.isFinite(options.durationMs) || options.durationMs! <= 0)) {
    throw new Error("Load duration must be positive.");
  }
  if (hasTotal && (!Number.isInteger(options.totalRequests) || options.totalRequests! <= 0)) {
    throw new Error("Load request count must be a positive integer.");
  }
  const parsedBaseUrl = new URL(options.baseUrl);
  const baseUrl = parsedBaseUrl.origin;
  const fetchImpl = options.fetchImpl ?? fetch;
  const runId = options.runId ?? crypto.randomUUID();

  for (const scenario of options.scenarios) {
    const warmup = await executeScenario({
      baseUrl,
      scenario,
      runId,
      timeoutMs: options.timeoutMs,
      fetchImpl,
    });
    if (!warmup.ok) {
      throw new Error(`Warm-up failed for ${scenario.name}: ${warmup.error ?? "unknown error"}.`);
    }
  }

  const startedAt = new Date().toISOString();
  const deadline = performance.now() + (options.durationMs ?? Number.POSITIVE_INFINITY);
  const samples: LoadSample[] = [];
  let nextRequest = 0;

  const worker = async () => {
    while (true) {
      const requestIndex = nextRequest;
      if (options.totalRequests !== undefined && requestIndex >= options.totalRequests) return;
      if (options.durationMs !== undefined && performance.now() >= deadline) return;
      nextRequest += 1;
      const scenario = options.scenarios[requestIndex % options.scenarios.length];
      if (!scenario) return;
      samples.push(await executeScenario({
        baseUrl,
        scenario,
        runId,
        timeoutMs: options.timeoutMs,
        fetchImpl,
      }));
    }
  };
  await Promise.all(Array.from({ length: options.concurrency }, worker));
  const completedAt = new Date().toISOString();
  return evaluateLoadSamples(samples, {
    startedAt,
    completedAt,
    minimumAvailabilityPercent: options.minimumAvailabilityPercent,
    maximumCachedP95Ms: options.maximumCachedP95Ms,
  });
}
