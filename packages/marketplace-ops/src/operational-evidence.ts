import {
  canonicalFelt,
  type MarketplaceChainAlias,
} from "@biblio/marketplace-registry";

export type ResourceSample = {
  cpuPercent: number;
  memoryPercent: number;
  diskPercent: number;
};

export type SoakSample = {
  observedAt: string;
  apiAvailable: boolean;
  cachedLatencyMs: number | null;
  indexLagBlocks: number;
  mainnet: ResourceSample;
  sepolia: ResourceSample;
};

export type SoakReport = {
  passed: boolean;
  startedAt: string;
  completedAt: string;
  durationHours: number;
  sampleCount: number;
  maximumObservedSampleGapSeconds: number;
  availabilityPercent: number;
  cachedP95Ms: number;
  p95IndexLagBlocks: number;
  utilization: {
    mainnet: ResourceSample;
    sepolia: ResourceSample;
  };
  issues: string[];
};

function nearestRank(values: number[], percentile: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.max(0, Math.ceil(sorted.length * percentile) - 1)] ?? 0;
}

function timestamp(value: string, label: string): number {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) throw new Error(`${label} is not an ISO timestamp.`);
  return parsed;
}

function assertPercentage(value: number, label: string): void {
  if (!Number.isFinite(value) || value < 0 || value > 100) {
    throw new Error(`${label} must be between 0 and 100.`);
  }
}

function resourceP95(samples: SoakSample[], chain: "mainnet" | "sepolia"): ResourceSample {
  return {
    cpuPercent: nearestRank(samples.map((sample) => sample[chain].cpuPercent), 0.95),
    memoryPercent: nearestRank(samples.map((sample) => sample[chain].memoryPercent), 0.95),
    diskPercent: nearestRank(samples.map((sample) => sample[chain].diskPercent), 0.95),
  };
}

export function evaluateSoakSamples(
  rawSamples: SoakSample[],
  thresholds: {
    minimumDurationHours: number;
    maximumSampleGapSeconds: number;
    minimumAvailabilityPercent: number;
    maximumCachedP95Ms: number;
    maximumP95LagBlocks: number;
    maximumSustainedUtilizationPercent: number;
  },
): SoakReport {
  if (rawSamples.length < 2) throw new Error("A soak report requires at least two samples.");
  const samples = [...rawSamples].sort(
    (left, right) => timestamp(left.observedAt, "observedAt") - timestamp(right.observedAt, "observedAt"),
  );
  for (const [index, sample] of samples.entries()) {
    if (!Number.isInteger(sample.indexLagBlocks) || sample.indexLagBlocks < 0) {
      throw new Error(`samples[${index}].indexLagBlocks is invalid.`);
    }
    if (
      sample.cachedLatencyMs !== null &&
      (!Number.isFinite(sample.cachedLatencyMs) || sample.cachedLatencyMs < 0)
    ) {
      throw new Error(`samples[${index}].cachedLatencyMs is invalid.`);
    }
    for (const chain of ["mainnet", "sepolia"] as const) {
      assertPercentage(sample[chain].cpuPercent, `samples[${index}].${chain}.cpuPercent`);
      assertPercentage(sample[chain].memoryPercent, `samples[${index}].${chain}.memoryPercent`);
      assertPercentage(sample[chain].diskPercent, `samples[${index}].${chain}.diskPercent`);
    }
  }
  const started = timestamp(samples[0]!.observedAt, "first observedAt");
  const completed = timestamp(samples.at(-1)!.observedAt, "last observedAt");
  const durationHours = (completed - started) / (60 * 60 * 1_000);
  const gaps = samples.slice(1).map((sample, index) =>
    (timestamp(sample.observedAt, "observedAt") -
      timestamp(samples[index]!.observedAt, "observedAt")) / 1_000,
  );
  const maximumObservedSampleGapSeconds = Math.max(...gaps);
  const successful = samples.filter((sample) => sample.apiAvailable);
  const availabilityPercent = (successful.length / samples.length) * 100;
  const latencies = successful.flatMap((sample) =>
    sample.cachedLatencyMs === null ? [] : [sample.cachedLatencyMs],
  );
  const cachedP95Ms = nearestRank(latencies, 0.95);
  const p95IndexLagBlocks = nearestRank(
    samples.map((sample) => sample.indexLagBlocks),
    0.95,
  );
  const utilization = {
    mainnet: resourceP95(samples, "mainnet"),
    sepolia: resourceP95(samples, "sepolia"),
  };
  const issues: string[] = [];
  if (durationHours < thresholds.minimumDurationHours) {
    issues.push(
      `Soak duration ${durationHours.toFixed(2)} hours is below ${thresholds.minimumDurationHours} hours.`,
    );
  }
  if (maximumObservedSampleGapSeconds > thresholds.maximumSampleGapSeconds) {
    issues.push(
      `Maximum sample gap ${maximumObservedSampleGapSeconds.toFixed(0)} seconds exceeds ${thresholds.maximumSampleGapSeconds} seconds.`,
    );
  }
  if (availabilityPercent < thresholds.minimumAvailabilityPercent) {
    issues.push(
      `API availability ${availabilityPercent.toFixed(3)}% is below ${thresholds.minimumAvailabilityPercent}%.`,
    );
  }
  if (latencies.length === 0 || cachedP95Ms >= thresholds.maximumCachedP95Ms) {
    issues.push(
      `Cached API p95 ${cachedP95Ms.toFixed(2)} ms does not meet the under-${thresholds.maximumCachedP95Ms} ms target.`,
    );
  }
  if (p95IndexLagBlocks > thresholds.maximumP95LagBlocks) {
    issues.push(
      `Indexer p95 lag ${p95IndexLagBlocks} blocks exceeds ${thresholds.maximumP95LagBlocks}.`,
    );
  }
  const utilizationValues = [
    utilization.mainnet.cpuPercent,
    utilization.mainnet.memoryPercent,
    utilization.mainnet.diskPercent,
    utilization.sepolia.cpuPercent,
    utilization.sepolia.memoryPercent,
    utilization.sepolia.diskPercent,
  ];
  if (utilizationValues.some((value) => value >= thresholds.maximumSustainedUtilizationPercent)) {
    issues.push(
      `Sustained p95 utilization must remain below ${thresholds.maximumSustainedUtilizationPercent}%.`,
    );
  }
  return {
    passed: issues.length === 0,
    startedAt: samples[0]!.observedAt,
    completedAt: samples.at(-1)!.observedAt,
    durationHours,
    sampleCount: samples.length,
    maximumObservedSampleGapSeconds,
    availabilityPercent,
    cachedP95Ms,
    p95IndexLagBlocks,
    utilization,
    issues,
  };
}

export type RestoreDrillInput = {
  chain: MarketplaceChainAlias;
  failureAt: string;
  latestReplicaAt: string;
  drillStartedAt: string;
  readyAt: string;
  restoredGeneration: string;
  indexedBlock: number;
  chainHead: number;
  reconciliationMatched: boolean;
};

export type RestoreDrillReport = RestoreDrillInput & {
  passed: boolean;
  rpoMinutes: number;
  rtoMinutes: number;
  issues: string[];
};

export function evaluateRestoreDrill(input: RestoreDrillInput): RestoreDrillReport {
  if (input.chain !== "SN_MAIN" && input.chain !== "SN_SEPOLIA") {
    throw new Error("Restore chain is invalid.");
  }
  if (!input.restoredGeneration.trim()) throw new Error("Restored generation is required.");
  if (!Number.isInteger(input.indexedBlock) || !Number.isInteger(input.chainHead)) {
    throw new Error("Restore block numbers must be integers.");
  }
  const failureAt = timestamp(input.failureAt, "failureAt");
  const latestReplicaAt = timestamp(input.latestReplicaAt, "latestReplicaAt");
  const drillStartedAt = timestamp(input.drillStartedAt, "drillStartedAt");
  const readyAt = timestamp(input.readyAt, "readyAt");
  if (latestReplicaAt > failureAt) throw new Error("latestReplicaAt is after failureAt.");
  if (readyAt < drillStartedAt) throw new Error("readyAt is before drillStartedAt.");
  const rpoMinutes = (failureAt - latestReplicaAt) / 60_000;
  const rtoMinutes = (readyAt - drillStartedAt) / 60_000;
  const issues: string[] = [];
  if (rpoMinutes >= 5) issues.push(`Restore RPO ${rpoMinutes} minutes is not under 5 minutes.`);
  if (rtoMinutes >= 60) issues.push(`Restore RTO ${rtoMinutes} minutes is not under 60 minutes.`);
  if (input.indexedBlock < input.chainHead) {
    issues.push(`Restored indexer is ${input.chainHead - input.indexedBlock} blocks behind head.`);
  }
  if (!input.reconciliationMatched) issues.push("Restored database reconciliation did not match.");
  return { ...input, passed: issues.length === 0, rpoMinutes, rtoMinutes, issues };
}

export type RestoreDrillsReport = {
  passed: boolean;
  chains: RestoreDrillReport[];
  rpoMinutes: number;
  rtoMinutes: number;
  issues: string[];
};

export function evaluateRestoreDrills(
  inputs: Array<RestoreDrillInput | RestoreDrillReport>,
): RestoreDrillsReport {
  const chains = inputs.map((input) => evaluateRestoreDrill(input));
  const aliases = chains.map((report) => report.chain);
  const issues: string[] = [];
  for (const chain of ["SN_MAIN", "SN_SEPOLIA"] as const) {
    const count = aliases.filter((alias) => alias === chain).length;
    if (count !== 1) issues.push(`Restore evidence requires exactly one ${chain} drill.`);
  }
  for (const report of chains) {
    issues.push(...report.issues.map((issue) => `${report.chain}: ${issue}`));
  }
  return {
    passed: issues.length === 0,
    chains,
    rpoMinutes: Math.max(...chains.map((report) => report.rpoMinutes), 0),
    rtoMinutes: Math.max(...chains.map((report) => report.rtoMinutes), 0),
    issues,
  };
}

export const REQUIRED_CHAOS_SCENARIOS = [
  "rpc_transport_failover",
  "rpc_timeout_failover",
  "rpc_429_failover",
  "rpc_5xx_failover",
  "rpc_deterministic_error_not_failed_over",
  "torii_restart",
  "disk_pressure",
  "delayed_index",
] as const;

export type ChaosScenarioName = (typeof REQUIRED_CHAOS_SCENARIOS)[number];
export type ChaosScenario = {
  name: ChaosScenarioName;
  passed: boolean;
  checkoutFailedClosed: boolean;
  observedAt: string;
  details?: unknown;
};

export type ChaosReport = {
  passed: boolean;
  scenarios: ChaosScenario[];
  issues: string[];
};

const CHECKOUT_CLOSED_CHAOS_SCENARIOS = new Set<ChaosScenarioName>([
  "torii_restart",
  "disk_pressure",
  "delayed_index",
]);

export function evaluateChaosScenarios(scenarios: ChaosScenario[]): ChaosReport {
  const issues: string[] = [];
  const byName = new Map<ChaosScenarioName, ChaosScenario>();
  for (const scenario of scenarios) {
    timestamp(scenario.observedAt, `${scenario.name}.observedAt`);
    if (byName.has(scenario.name)) issues.push(`Chaos scenario ${scenario.name} is duplicated.`);
    byName.set(scenario.name, scenario);
  }
  for (const name of REQUIRED_CHAOS_SCENARIOS) {
    const scenario = byName.get(name);
    if (!scenario) {
      issues.push(`Chaos scenario ${name} is missing.`);
      continue;
    }
    if (!scenario.passed) issues.push(`Chaos scenario ${name} failed.`);
    if (CHECKOUT_CLOSED_CHAOS_SCENARIOS.has(name) && !scenario.checkoutFailedClosed) {
      issues.push(`Checkout did not fail closed during ${name}.`);
    }
  }
  return { passed: issues.length === 0, scenarios, issues };
}

export type SepoliaLifecycleInput = {
  worldAddress: string;
  marketplaceAddress: string;
  collection: string;
  tokenId: string;
  orderId: string;
  seller: string;
  buyer: string;
  listTransactionHash: string;
  listCaller: string;
  listReceiptBlock: number;
  listIndexedBlock: number;
  listedOrderObserved: boolean;
  addToCartObserved: boolean;
  cartLookupObserved: boolean;
  purchaseTransactionHash: string;
  purchaseCaller: string;
  purchaseReceiptBlock: number;
  purchaseIndexedBlock: number;
  executedOrderObserved: boolean;
  resultingOwner: string;
  finality: string;
};

export type SepoliaLifecycleReport = SepoliaLifecycleInput & {
  passed: boolean;
  issues: string[];
};

function lifecycleDecimal(value: string, label: string): string {
  if (!/^(0|[1-9][0-9]*)$/.test(value)) {
    throw new Error(`${label} must be an unsigned decimal string.`);
  }
  return BigInt(value).toString();
}

function lifecycleBlock(value: number, label: string): number {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${label} must be a non-negative safe integer.`);
  }
  return value;
}

export function evaluateSepoliaLifecycle(
  input: SepoliaLifecycleInput,
  expected: { worldAddress: string; marketplaceAddress: string },
): SepoliaLifecycleReport {
  const normalized = {
    ...input,
    worldAddress: canonicalFelt(input.worldAddress),
    marketplaceAddress: canonicalFelt(input.marketplaceAddress),
    collection: canonicalFelt(input.collection),
    tokenId: lifecycleDecimal(input.tokenId, "tokenId"),
    orderId: lifecycleDecimal(input.orderId, "orderId"),
    seller: canonicalFelt(input.seller),
    buyer: canonicalFelt(input.buyer),
    listTransactionHash: canonicalFelt(input.listTransactionHash),
    listCaller: canonicalFelt(input.listCaller),
    listReceiptBlock: lifecycleBlock(input.listReceiptBlock, "listReceiptBlock"),
    listIndexedBlock: lifecycleBlock(input.listIndexedBlock, "listIndexedBlock"),
    purchaseTransactionHash: canonicalFelt(input.purchaseTransactionHash),
    purchaseCaller: canonicalFelt(input.purchaseCaller),
    purchaseReceiptBlock: lifecycleBlock(input.purchaseReceiptBlock, "purchaseReceiptBlock"),
    purchaseIndexedBlock: lifecycleBlock(input.purchaseIndexedBlock, "purchaseIndexedBlock"),
    resultingOwner: canonicalFelt(input.resultingOwner),
  };
  const issues: string[] = [];
  if (normalized.worldAddress !== canonicalFelt(expected.worldAddress)) {
    issues.push("Sepolia World identity differs from the retained deployment.");
  }
  if (normalized.marketplaceAddress !== canonicalFelt(expected.marketplaceAddress)) {
    issues.push("Sepolia Marketplace identity differs from the retained deployment.");
  }
  if (normalized.seller === normalized.buyer) {
    issues.push("Lifecycle seller and buyer must be distinct accounts.");
  }
  if (normalized.listCaller !== normalized.seller) {
    issues.push("List transaction caller does not match the seller.");
  }
  if (normalized.purchaseCaller !== normalized.buyer) {
    issues.push("Purchase transaction caller does not match the buyer.");
  }
  if (BigInt(normalized.listTransactionHash) === 0n || BigInt(normalized.purchaseTransactionHash) === 0n) {
    issues.push("Lifecycle transaction hashes must be non-zero.");
  }
  if (normalized.listIndexedBlock < normalized.listReceiptBlock) {
    issues.push("Indexer did not reach the list receipt block.");
  }
  if (!normalized.listedOrderObserved) issues.push("Placed order was not read from the owned API.");
  if (!normalized.addToCartObserved) issues.push("Listed tuple was not added to the cart.");
  if (!normalized.cartLookupObserved) issues.push("Cart lookup did not observe the exact tuple order.");
  if (normalized.purchaseIndexedBlock < normalized.purchaseReceiptBlock) {
    issues.push("Indexer did not reach the purchase receipt block.");
  }
  if (!normalized.executedOrderObserved) {
    issues.push("Executed order state was not read from the owned API.");
  }
  if (normalized.resultingOwner !== normalized.buyer) {
    issues.push("Resulting owner does not match the lifecycle buyer.");
  }
  if (normalized.finality !== "accepted_l2") {
    issues.push("Lifecycle finality must be accepted_l2.");
  }
  return { ...normalized, passed: issues.length === 0, issues };
}
