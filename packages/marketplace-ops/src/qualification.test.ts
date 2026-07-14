import { describe, expect, it, vi } from "vitest";
import {
  qualifyRpcEndpoint,
  rankQualifiedProviders,
  type ProviderEvidence,
} from "./qualification.js";

const registry = {
  schemaVersion: "1.0.0",
  chains: {
    SN_MAIN: {
      chainId: "0x534e5f4d41494e",
      world: { address: "0x1", classHash: "0x11", startBlock: 10 },
      marketplace: { address: "0x2", classHash: "0x22", startBlock: 12 },
      currencies: [{ address: "0x3", symbol: "STRK", decimals: 18, icon: "/x" }],
      collections: [
        {
          address: "0x4",
          name: "Example",
          standard: "ERC721" as const,
          startBlock: 8,
          metadata: { enabled: true },
        },
      ],
    },
  },
};

describe("RPC archive qualification", () => {
  it("checks version, checkpoint identity, receipt, state, and historical events", async () => {
    const call = vi.fn(async (method: string, params: unknown) => {
      if (method === "starknet_specVersion") return "0.9.0";
      if (method === "starknet_chainId") return "0x534e5f4d41494e";
      if (method === "starknet_getBlockWithTxHashes") {
        return { block_number: 100, block_hash: "0xaa" };
      }
      if (method === "starknet_getTransactionReceipt") {
        return { finality_status: "ACCEPTED_ON_L1", transaction_hash: "0xbb" };
      }
      if (method === "starknet_getClassHashAt") {
        const address = (params as { contract_address: string }).contract_address;
        if (address.endsWith("1")) return "0x11";
        if (address.endsWith("2")) return "0x22";
        return "0x44";
      }
      if (method === "starknet_getEvents") return { events: [], continuation_token: null };
      throw new Error(`unexpected ${method}`);
    });

    const result = await qualifyRpcEndpoint({
      provider: "quicknode",
      chain: "SN_MAIN",
      endpoint: "https://secret.invalid/key",
      registry,
      checkpoint: {
        blockNumber: 100,
        blockHash: "0xaa",
        receiptTransactionHash: "0xbb",
      },
      call,
    });

    expect(result.passed).toBe(true);
    expect(result.checks).toHaveLength(13);
    expect(result.checks).toContainEqual(
      expect.objectContaining({
        name: `historical_start_state:collection:0x${"4".padStart(64, "0")}`,
        passed: true,
      }),
    );
    expect(JSON.stringify(result)).not.toContain("secret.invalid");
    expect(call).toHaveBeenCalledWith(
      "starknet_getEvents",
      expect.objectContaining({ address: expect.stringMatching(/^0x0+4$/) }),
    );
  });

  it("fails closed when a historical identity differs", async () => {
    const call = vi.fn(async (method: string) => {
      if (method === "starknet_specVersion") return "0.9.0";
      if (method === "starknet_chainId") return "0x534e5f4d41494e";
      if (method === "starknet_getBlockWithTxHashes") {
        return { block_number: 100, block_hash: "0xdead" };
      }
      return {};
    });
    const result = await qualifyRpcEndpoint({
      provider: "alchemy",
      chain: "SN_MAIN",
      endpoint: "https://secret.invalid/key",
      registry,
      checkpoint: {
        blockNumber: 100,
        blockHash: "0xaa",
        receiptTransactionHash: "0xbb",
      },
      call,
    });

    expect(result.passed).toBe(false);
    expect(result.checks).toContainEqual(
      expect.objectContaining({ name: "checkpoint_block", passed: false }),
    );
  });

  it("rejects a valid endpoint for the wrong Starknet network", async () => {
    const call = vi.fn(async (method: string) => {
      if (method === "starknet_specVersion") return "0.9.0";
      if (method === "starknet_chainId") return "0x534e5f5345504f4c4941";
      return {};
    });

    const result = await qualifyRpcEndpoint({
      provider: "wrong-network",
      chain: "SN_MAIN",
      endpoint: "https://secret.invalid/key",
      registry,
      checkpoint: {
        blockNumber: 100,
        blockHash: "0xaa",
        receiptTransactionHash: "0xbb",
      },
      call,
    });

    expect(result.passed).toBe(false);
    expect(result.checks).toContainEqual(
      expect.objectContaining({
        name: "chain_id",
        passed: false,
        error: expect.stringMatching(/expected chain id/i),
      }),
    );
  });
});

describe("RPC provider ranking", () => {
  const evidence = (overrides: Partial<ProviderEvidence>): ProviderEvidence => ({
    provider: "quicknode",
    archiveQualificationPassed: true,
    fullReplayDurationMs: 100,
    requestErrorRate: 0.001,
    p95LatencyMs: 100,
    replayHash: "sha256:abc",
    soakHours: 24,
    unrecoverableGaps: 0,
    ...overrides,
  });

  it("weights replay, errors, and latency 50/30/20", () => {
    const ranking = rankQualifiedProviders([
      evidence({ provider: "quicknode" }),
      evidence({
        provider: "alchemy",
        fullReplayDurationMs: 200,
        requestErrorRate: 0.01,
        p95LatencyMs: 200,
      }),
    ]);

    expect(ranking.primary).toBe("quicknode");
    expect(ranking.fallback).toBe("alchemy");
    expect(ranking.scores[0]?.score).toBe(100);
    expect(ranking.scores[1]?.score).toBeCloseTo(64.73, 2);
  });

  it("blocks launch unless both providers independently pass", () => {
    expect(() =>
      rankQualifiedProviders([
        evidence({ provider: "quicknode" }),
        evidence({ provider: "alchemy", archiveQualificationPassed: false }),
      ]),
    ).toThrow(/both managed providers/i);
  });

  it("blocks launch when replay hashes differ or soak is incomplete", () => {
    expect(() =>
      rankQualifiedProviders([
        evidence({ provider: "quicknode" }),
        evidence({ provider: "alchemy", replayHash: "sha256:def" }),
      ]),
    ).toThrow(/replay hashes/i);
    expect(() =>
      rankQualifiedProviders([
        evidence({ provider: "quicknode" }),
        evidence({ provider: "alchemy", soakHours: 23.9 }),
      ]),
    ).toThrow(/24-hour/i);
  });
});
