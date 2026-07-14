import { describe, expect, it } from "vitest";
import { RpcClientError, StarknetRpcClient } from "./client.js";

describe("Starknet RPC client", () => {
  it("fails over to the second managed provider for transient failures", async () => {
    const requests: string[] = [];
    const client = new StarknetRpcClient({
      providers: {
        SN_MAIN: ["https://quicknode.example", "https://alchemy.example"],
        SN_SEPOLIA: ["https://quicknode-sepolia.example", "https://alchemy-sepolia.example"],
      },
      fetchImpl: async (input) => {
        requests.push(String(input));
        if (String(input).includes("quicknode")) {
          return new Response("unavailable", { status: 503 });
        }
        return Response.json({
          jsonrpc: "2.0",
          id: 1,
          result: { block_number: 500, block_hash: `0x${"a".padStart(64, "0")}` },
        });
      },
      timeoutMs: 2_000,
    });

    await expect(client.getHead("SN_MAIN")).resolves.toEqual({
      blockNumber: 500,
      blockHash: `0x${"a".padStart(64, "0")}`,
    });
    expect(requests).toEqual(["https://quicknode.example", "https://alchemy.example"]);
  });

  it("fails over when a provider encodes a transient rate limit in HTTP 200", async () => {
    const requests: string[] = [];
    const client = new StarknetRpcClient({
      providers: {
        SN_MAIN: ["https://quicknode.example", "https://alchemy.example"],
        SN_SEPOLIA: ["https://quicknode-sepolia.example", "https://alchemy-sepolia.example"],
      },
      fetchImpl: async (input) => {
        requests.push(String(input));
        if (String(input).includes("quicknode")) {
          return Response.json({
            jsonrpc: "2.0",
            id: 1,
            error: { code: -32000, message: "Too many requests", data: { status: 429 } },
          });
        }
        return Response.json({
          jsonrpc: "2.0",
          id: 1,
          result: { block_number: 500, block_hash: `0x${"a".padStart(64, "0")}` },
        });
      },
    });

    await expect(client.getHead("SN_MAIN")).resolves.toEqual({
      blockNumber: 500,
      blockHash: `0x${"a".padStart(64, "0")}`,
    });
    expect(requests).toEqual(["https://quicknode.example", "https://alchemy.example"]);
  });

  it("does not hide deterministic JSON-RPC errors behind fallback", async () => {
    let requests = 0;
    const client = new StarknetRpcClient({
      providers: {
        SN_MAIN: ["https://quicknode.example", "https://alchemy.example"],
        SN_SEPOLIA: ["https://quicknode-sepolia.example", "https://alchemy-sepolia.example"],
      },
      fetchImpl: async () => {
        requests += 1;
        return Response.json({
          jsonrpc: "2.0",
          id: 1,
          error: { code: -32602, message: "Invalid params" },
        });
      },
      timeoutMs: 2_000,
    });

    await expect(client.getHead("SN_MAIN")).rejects.toBeInstanceOf(RpcClientError);
    expect(requests).toBe(1);
  });
});
