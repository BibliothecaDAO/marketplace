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

  it("streams only supported sanitized image types from the private Torii asset route", async () => {
    const requests: string[] = [];
    const client = new HttpToriiClient({
      endpoints: {
        SN_MAIN: "http://torii-main.internal:8080",
        SN_SEPOLIA: "http://torii-sepolia.internal:8080",
      },
      fetchImpl: async (input) => {
        requests.push(String(input));
        return new Response("<svg xmlns=\"http://www.w3.org/2000/svg\"/>", {
          headers: {
            "content-type": "image/svg+xml",
            etag: "\"abc123\"",
          },
        });
      },
      maxAssetBytes: 1024,
    });

    const asset = await client.getImage(
      "SN_MAIN",
      `0x${"a".padStart(64, "0")}`,
      "42",
    );

    expect(requests).toEqual([
      `http://torii-main.internal:8080/static/0x${"a".padStart(64, "0")}/0x${"2a".padStart(64, "0")}/image`,
    ]);
    expect(asset).toEqual(expect.objectContaining({
      status: 200,
      contentType: "image/svg+xml",
      etag: "\"abc123\"",
    }));
    expect(new TextDecoder().decode(asset.body)).toContain("<svg");
  });

  it("retries one transient private asset response", async () => {
    let requests = 0;
    const client = new HttpToriiClient({
      endpoints: {
        SN_MAIN: "http://torii-main.internal:8080",
        SN_SEPOLIA: "http://torii-sepolia.internal:8080",
      },
      fetchImpl: async () => {
        requests += 1;
        if (requests === 1) return new Response("busy", { status: 503 });
        return new Response(new Uint8Array([1, 2, 3]), {
          headers: { "content-type": "image/png" },
        });
      },
      retryDelayMs: 0,
    });

    await expect(client.getImage("SN_MAIN", "0x1", "1")).resolves.toEqual(
      expect.objectContaining({ status: 200, contentType: "image/png" }),
    );
    expect(requests).toBe(2);
  });

  it("rejects unsupported image MIME types and streamed bodies over the cap", async () => {
    const endpoints = {
      SN_MAIN: "http://torii-main.internal:8080",
      SN_SEPOLIA: "http://torii-sepolia.internal:8080",
    } as const;
    const unsupported = new HttpToriiClient({
      endpoints,
      fetchImpl: async () => new Response("bitmap", {
        headers: { "content-type": "image/bmp" },
      }),
    });
    await expect(unsupported.getImage("SN_MAIN", "0x1", "1"))
      .rejects.toThrow(/unsupported image content type/i);

    const oversized = new HttpToriiClient({
      endpoints,
      maxAssetBytes: 4,
      fetchImpl: async () => new Response(new Uint8Array([1, 2, 3, 4, 5]), {
        headers: { "content-type": "image/png" },
      }),
    });
    await expect(oversized.getImage("SN_MAIN", "0x1", "1"))
      .rejects.toThrow(/size limit/i);
  });
});
