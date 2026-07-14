import {
  canonicalFelt,
  parseMarketplaceRegistry,
  type MarketplaceChainAlias,
  type MarketplaceRegistry,
} from "@biblio/marketplace-registry";

export type RpcCheckpoint = {
  blockNumber: number;
  blockHash: string;
  receiptTransactionHash: string;
};

export type QualificationCheck = {
  name: string;
  passed: boolean;
  durationMs: number;
  error?: string;
};

export type RpcQualificationResult = {
  provider: string;
  chain: MarketplaceChainAlias;
  checkpointBlock: number;
  passed: boolean;
  startedAt: string;
  completedAt: string;
  p95LatencyMs: number;
  requestCount: number;
  failureCount: number;
  checks: QualificationCheck[];
};

type RpcCall = (method: string, params: unknown) => Promise<unknown>;

type QualifyOptions = {
  provider: string;
  chain: MarketplaceChainAlias;
  endpoint: string;
  registry: MarketplaceRegistry | unknown;
  checkpoint: RpcCheckpoint;
  call?: RpcCall;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
};

function parseRpcVersion(value: unknown): [number, number] {
  if (typeof value !== "string") throw new Error("RPC version was not a string.");
  const match = /^(\d+)\.(\d+)(?:\.\d+)?$/.exec(value);
  if (!match) throw new Error(`Invalid RPC version ${value}.`);
  return [Number(match[1]), Number(match[2])];
}

function assertRpcVersion(value: unknown): void {
  const [major, minor] = parseRpcVersion(value);
  if (major < 0 || (major === 0 && minor < 9)) {
    throw new Error(`RPC ${String(value)} is older than required v0.9.`);
  }
}

function percentile95(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.ceil(sorted.length * 0.95) - 1] ?? 0;
}

function createHttpRpcCall(
  endpoint: string,
  fetchImpl: typeof fetch,
  timeoutMs: number,
): RpcCall {
  let id = 0;
  return async (method, params) => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetchImpl(endpoint, {
        method: "POST",
        headers: { accept: "application/json", "content-type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: ++id, method, params }),
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const payload = (await response.json()) as {
        result?: unknown;
        error?: { code: number; message: string };
      };
      if (payload.error) {
        throw new Error(`RPC ${payload.error.code}: ${payload.error.message}`);
      }
      if (!("result" in payload)) throw new Error("RPC response omitted result.");
      return payload.result;
    } finally {
      clearTimeout(timeout);
    }
  };
}

export async function qualifyRpcEndpoint(
  options: QualifyOptions,
): Promise<RpcQualificationResult> {
  const registry = parseMarketplaceRegistry(options.registry);
  const chain = registry.chains[options.chain];
  if (!chain) throw new Error(`${options.chain} is absent from the registry.`);
  const call =
    options.call ??
    createHttpRpcCall(options.endpoint, options.fetchImpl ?? fetch, options.timeoutMs ?? 10_000);
  const startedAt = new Date().toISOString();
  const checks: QualificationCheck[] = [];

  const check = async (name: string, operation: () => Promise<void>) => {
    const started = performance.now();
    try {
      await operation();
      checks.push({ name, passed: true, durationMs: performance.now() - started });
    } catch (error) {
      checks.push({
        name,
        passed: false,
        durationMs: performance.now() - started,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  };

  await check("rpc_version", async () => {
    assertRpcVersion(await call("starknet_specVersion", {}));
  });
  await check("chain_id", async () => {
    const actual = canonicalFelt(String(await call("starknet_chainId", [])));
    const expected = canonicalFelt(chain.chainId);
    if (actual !== expected) {
      throw new Error(`Expected chain ID ${expected}, received ${actual}.`);
    }
  });
  await check("checkpoint_block", async () => {
    const block = (await call("starknet_getBlockWithTxHashes", {
      block_id: { block_number: options.checkpoint.blockNumber },
    })) as { block_number?: number; block_hash?: string };
    if (block.block_number !== options.checkpoint.blockNumber) {
      throw new Error(`Expected block ${options.checkpoint.blockNumber}.`);
    }
    if (
      !block.block_hash ||
      canonicalFelt(block.block_hash) !== canonicalFelt(options.checkpoint.blockHash)
    ) {
      throw new Error("Checkpoint block hash differs.");
    }
  });
  await check("historical_receipt", async () => {
    const receipt = (await call("starknet_getTransactionReceipt", {
      transaction_hash: canonicalFelt(options.checkpoint.receiptTransactionHash),
    })) as { transaction_hash?: string; finality_status?: string };
    if (
      !receipt.transaction_hash ||
      canonicalFelt(receipt.transaction_hash) !==
        canonicalFelt(options.checkpoint.receiptTransactionHash)
    ) {
      throw new Error("Checkpoint receipt transaction differs.");
    }
    if (
      receipt.finality_status !== "ACCEPTED_ON_L2" &&
      receipt.finality_status !== "ACCEPTED_ON_L1"
    ) {
      throw new Error(`Receipt finality is ${receipt.finality_status ?? "missing"}.`);
    }
  });

  const contracts = [
    { name: "world", ...chain.world, expectedClassHash: chain.world.classHash },
    {
      name: "marketplace",
      ...chain.marketplace,
      expectedClassHash: chain.marketplace.classHash,
    },
    ...chain.collections.map((collection) => ({
      name: `collection:${collection.address}`,
      address: collection.address,
      startBlock: collection.startBlock,
      expectedClassHash: undefined,
    })),
  ];
  for (const contract of contracts) {
    await check(`historical_start_state:${contract.name}`, async () => {
      if (contract.startBlock > options.checkpoint.blockNumber) {
        throw new Error(
          `${contract.name} start block ${contract.startBlock} is after the checkpoint.`,
        );
      }
      await call("starknet_getClassHashAt", {
        block_id: { block_number: contract.startBlock },
        contract_address: contract.address,
      });
    });
  }
  for (const contract of contracts) {
    await check(`historical_state:${contract.name}`, async () => {
      const value = await call("starknet_getClassHashAt", {
        block_id: { block_number: options.checkpoint.blockNumber },
        contract_address: contract.address,
      });
      const actual = canonicalFelt(String(value));
      if (
        contract.expectedClassHash &&
        actual !== canonicalFelt(contract.expectedClassHash)
      ) {
        throw new Error(`Class hash differs for ${contract.name}.`);
      }
    });
  }
  for (const contract of contracts) {
    await check(`historical_events:${contract.name}`, async () => {
      const result = (await call("starknet_getEvents", {
        from_block: { block_number: contract.startBlock },
        to_block: {
          block_number: Math.min(
            options.checkpoint.blockNumber,
            contract.startBlock + 50_000,
          ),
        },
        address: contract.address,
        chunk_size: 1,
      })) as { events?: unknown[] };
      if (!Array.isArray(result.events)) {
        throw new Error(`Historical event result is malformed for ${contract.name}.`);
      }
    });
  }

  const latencies = checks.map((entry) => entry.durationMs);
  return {
    provider: options.provider,
    chain: options.chain,
    checkpointBlock: options.checkpoint.blockNumber,
    passed: checks.every((entry) => entry.passed),
    startedAt,
    completedAt: new Date().toISOString(),
    p95LatencyMs: percentile95(latencies),
    requestCount: checks.length,
    failureCount: checks.filter((entry) => !entry.passed).length,
    checks,
  };
}

export type ProviderEvidence = {
  provider: string;
  archiveQualificationPassed: boolean;
  fullReplayDurationMs: number;
  requestErrorRate: number;
  p95LatencyMs: number;
  replayHash: string;
  soakHours: number;
  unrecoverableGaps: number;
};

export type ProviderRanking = {
  primary: string;
  fallback: string;
  weights: { fullReplay: 0.5; errorsAndRetries: 0.3; p95Latency: 0.2 };
  scores: Array<{ provider: string; score: number }>;
};

export function rankQualifiedProviders(
  providers: readonly ProviderEvidence[],
): ProviderRanking {
  if (providers.length !== 2 || providers.some((provider) => !provider.archiveQualificationPassed)) {
    throw new Error("Launch requires both managed providers to pass archive qualification.");
  }
  if (providers.some((provider) => provider.soakHours < 24 || provider.unrecoverableGaps > 0)) {
    throw new Error("Launch requires a complete 24-hour soak with no unrecoverable gaps.");
  }
  if (new Set(providers.map((provider) => provider.replayHash)).size !== 1) {
    throw new Error("Provider replay hashes differ.");
  }
  for (const provider of providers) {
    if (
      provider.fullReplayDurationMs <= 0 ||
      provider.p95LatencyMs <= 0 ||
      provider.requestErrorRate < 0 ||
      provider.requestErrorRate > 1
    ) {
      throw new Error(`Invalid benchmark evidence for ${provider.provider}.`);
    }
  }

  const fastestReplay = Math.min(...providers.map((provider) => provider.fullReplayDurationMs));
  const lowestLatency = Math.min(...providers.map((provider) => provider.p95LatencyMs));
  const bestReliability = Math.max(
    ...providers.map((provider) => 1 - provider.requestErrorRate),
  );
  const scores = providers
    .map((provider) => ({
      provider: provider.provider,
      score:
        (fastestReplay / provider.fullReplayDurationMs) * 50 +
        ((1 - provider.requestErrorRate) / bestReliability) * 30 +
        (lowestLatency / provider.p95LatencyMs) * 20,
    }))
    .sort((left, right) => right.score - left.score || left.provider.localeCompare(right.provider));

  return {
    primary: scores[0]!.provider,
    fallback: scores[1]!.provider,
    weights: { fullReplay: 0.5, errorsAndRetries: 0.3, p95Latency: 0.2 },
    scores,
  };
}
