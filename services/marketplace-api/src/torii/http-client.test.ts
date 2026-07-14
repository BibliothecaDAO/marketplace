import { describe, expect, it } from "vitest";
import { HttpToriiClient } from "./http-client.js";

describe("Torii HTTP client", () => {
  it("retries one transient response and posts only the server-owned SQL", async () => {
    const requests: Array<{ url: string; body: string }> = [];
    const fetchImpl: typeof fetch = async (input, init) => {
      requests.push({ url: String(input), body: String(init?.body) });
      if (requests.length === 1) {
        return new Response("temporarily unavailable", { status: 503 });
      }
      return Response.json([{ id: 2312 }]);
    };
    const client = new HttpToriiClient({
      endpoints: {
        SN_MAIN: "http://torii-main.internal:8080",
        SN_SEPOLIA: "http://torii-sepolia.internal:8080",
      },
      fetchImpl,
      timeoutMs: 2_000,
      retryDelayMs: 0,
    });

    const rows = await client.query<{ id: number }>(
      "SN_MAIN",
      'SELECT id FROM "ARCADE-Order" LIMIT 1',
    );

    expect(rows).toEqual([{ id: 2312 }]);
    expect(requests).toEqual([
      {
        url: "http://torii-main.internal:8080/sql",
        body: 'SELECT id FROM "ARCADE-Order" LIMIT 1',
      },
      {
        url: "http://torii-main.internal:8080/sql",
        body: 'SELECT id FROM "ARCADE-Order" LIMIT 1',
      },
    ]);
  });

  it("does not retry deterministic Torii query errors", async () => {
    let requests = 0;
    const client = new HttpToriiClient({
      endpoints: {
        SN_MAIN: "http://torii-main.internal:8080",
        SN_SEPOLIA: "http://torii-sepolia.internal:8080",
      },
      fetchImpl: async () => {
        requests += 1;
        return new Response("invalid SQL", { status: 400 });
      },
      timeoutMs: 2_000,
      retryDelayMs: 0,
    });

    await expect(client.query("SN_MAIN", "SELECT invalid")).rejects.toEqual(
      expect.objectContaining({ statusCode: 400, retryable: false }),
    );
    expect(requests).toBe(1);
  });
});
