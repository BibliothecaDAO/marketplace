import { describe, expect, it, vi } from "vitest";
import { buildRpcProxy } from "./proxy.js";

describe("private Starknet RPC failover proxy", () => {
  it("fails over only transient transport and HTTP failures", async () => {
    const fetch = vi
      .fn<typeof globalThis.fetch>()
      .mockResolvedValueOnce(new Response("busy", { status: 503 }))
      .mockResolvedValueOnce(
        Response.json({ jsonrpc: "2.0", id: 1, result: "0x2a" }),
      );
    const app = await buildRpcProxy({
      fetch,
      providers: { SN_MAIN: ["https://primary", "https://fallback"], SN_SEPOLIA: [] },
    });

    const response = await app.inject({
      method: "POST",
      url: "/SN_MAIN",
      payload: { jsonrpc: "2.0", id: 1, method: "starknet_blockNumber", params: [] },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ jsonrpc: "2.0", id: 1, result: "0x2a" });
    expect(fetch).toHaveBeenCalledTimes(2);
    await app.close();
  });

  it("does not mask deterministic JSON-RPC errors from the primary", async () => {
    const error = {
      jsonrpc: "2.0",
      id: 1,
      error: { code: 24, message: "Block not found" },
    };
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(Response.json(error));
    const app = await buildRpcProxy({
      fetch,
      providers: { SN_MAIN: ["https://primary", "https://fallback"], SN_SEPOLIA: [] },
    });

    const response = await app.inject({
      method: "POST",
      url: "/SN_MAIN",
      payload: {
        jsonrpc: "2.0",
        id: 1,
        method: "starknet_getBlockWithTxHashes",
        params: [{ block_number: 1 }],
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual(error);
    expect(fetch).toHaveBeenCalledTimes(1);
    await app.close();
  });

  it("returns a retryable JSON-RPC server error when both providers are transiently down", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockRejectedValue(new TypeError("offline"));
    const app = await buildRpcProxy({
      fetch,
      providers: { SN_MAIN: ["https://primary", "https://fallback"], SN_SEPOLIA: [] },
    });

    const response = await app.inject({
      method: "POST",
      url: "/SN_MAIN",
      payload: { jsonrpc: "2.0", id: 7, method: "starknet_blockNumber", params: [] },
    });

    expect(response.statusCode).toBe(503);
    expect(response.json()).toEqual({
      jsonrpc: "2.0",
      id: 7,
      error: { code: -32098, message: "All qualified RPC providers are unavailable." },
    });
    expect(fetch).toHaveBeenCalledTimes(2);
    await app.close();
  });
});
