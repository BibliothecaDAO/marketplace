import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockFetch,
  mockRuntimeConfig,
} = vi.hoisted(() => ({
  mockFetch: vi.fn(),
  mockRuntimeConfig: {
    chainLabel: "SN_SEPOLIA",
    warnings: [],
    sdkConfig: {
      chainId: "0x534e5f5345504f4c4941",
    },
    collections: [
      { address: "0xabc", name: "Genesis", projectId: "project-a" },
    ],
  },
}));

vi.mock("@/lib/marketplace/config", () => ({
  getMarketplaceRuntimeConfig: () => mockRuntimeConfig,
}));

describe("marketplace seo data", () => {
  beforeEach(() => {
    vi.resetModules();
    mockFetch.mockReset();
    vi.stubGlobal("fetch", mockFetch);
  });

  it("returns_collection_name_description_and_image", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        rows: [
          {
            contract_address: "0xabc",
            metadata: JSON.stringify({
              name: "Genesis",
              description: "A flagship collection",
              image: "https://cdn.example.com/genesis.png",
            }),
            total_supply: "120",
          },
        ],
      }),
    });

    const { getCollectionSeoData } = await import("@/lib/marketplace/seo-data");
    const result = await getCollectionSeoData("0xabc");

    expect(result).toEqual({
      exists: true,
      name: "Genesis",
      description: "A flagship collection",
      image: "https://cdn.example.com/genesis.png",
    });
  });

  it("retries_token_lookup_with_alternate_id_format", async () => {
    mockFetch.mockImplementation(async (_url: string, init?: RequestInit) => {
      const body = String(init?.body ?? "");
      if (body.includes("FROM token_contracts")) {
        return {
          ok: true,
          json: async () => ({
            rows: [
              {
                contract_address: "0xabc",
                metadata: JSON.stringify({
                  name: "Genesis",
                  image: "https://cdn.example.com/genesis.png",
                }),
                total_supply: "120",
              },
            ],
          }),
        };
      }
      if (body.includes("token_id = '2357'")) {
        return { ok: true, json: async () => ({ rows: [] }) };
      }

      return {
        ok: true,
        json: async () => ({
          rows: [
            {
              contract_address: "0xabc",
              token_id: "0x935",
              metadata: JSON.stringify({
                name: "Loot Chest #2357",
                image: "https://cdn.example.com/2357.png",
              }),
            },
          ],
        }),
      };
    });

    const { getTokenSeoData } = await import("@/lib/marketplace/seo-data");
    const result = await getTokenSeoData("0xabc", "2357");

    expect(result).toEqual({
      exists: true,
      tokenName: "Loot Chest #2357",
      collectionName: "Genesis",
      description: "View listings and activity for Loot Chest #2357.",
      image: "https://cdn.example.com/2357.png",
      collectionImage: "https://cdn.example.com/genesis.png",
    });
    expect(
      mockFetch.mock.calls.some(([, init]) => String(init?.body ?? "").includes("token_id = '0x935'")),
    ).toBe(true);
  });

  it("returns_noindex_fallback_payload_when_token_not_found", async () => {
    mockFetch.mockImplementation(async (_url: string, init?: RequestInit) => {
      const body = String(init?.body ?? "");
      if (body.includes("FROM token_contracts")) {
        return {
          ok: true,
          json: async () => ({
            rows: [
              {
                contract_address: "0xabc",
                metadata: JSON.stringify({ name: "Genesis" }),
                total_supply: "120",
              },
            ],
          }),
        };
      }

      return { ok: true, json: async () => ({ rows: [] }) };
    });

    const { getTokenSeoData } = await import("@/lib/marketplace/seo-data");
    const result = await getTokenSeoData("0xabc", "999");

    expect(result).toEqual({
      exists: false,
      tokenName: "Token #999",
      collectionName: "Genesis",
      description: null,
      image: null,
      collectionImage: null,
    });
  });

  it("returns_collection_fallback_when_fetch_fails", async () => {
    mockFetch.mockRejectedValue(new Error("init failed"));

    const { getCollectionSeoData } = await import("@/lib/marketplace/seo-data");
    const result = await getCollectionSeoData("0xabc");

    expect(result).toEqual({
      exists: false,
      name: "Genesis",
      description: null,
      image: null,
    });
  });

  it("fetches_collection_and_token_in_parallel", async () => {
    const callLog: string[] = [];
    const delay = 50;

    mockFetch.mockImplementation(async (_url: string, init?: RequestInit) => {
      const body = String(init?.body ?? "");
      if (body.includes("FROM token_contracts")) {
        callLog.push("collection:start");
        await new Promise((resolve) => setTimeout(resolve, delay));
        callLog.push("collection:end");
        return {
          ok: true,
          json: async () => ({
            rows: [
              {
                contract_address: "0xabc",
                metadata: JSON.stringify({
                  name: "Genesis",
                  image: "https://cdn.example.com/genesis.png",
                }),
                total_supply: "120",
              },
            ],
          }),
        };
      }

      callLog.push("token:start");
      await new Promise((resolve) => setTimeout(resolve, delay));
      callLog.push("token:end");
      return {
        ok: true,
        json: async () => ({
          rows: [
            {
              contract_address: "0xabc",
              token_id: "1",
              metadata: JSON.stringify({
                name: "Token #1",
                image: "https://cdn.example.com/1.png",
              }),
            },
          ],
        }),
      };
    });

    const { getTokenSeoData } = await import("@/lib/marketplace/seo-data");
    const start = Date.now();
    await getTokenSeoData("0xabc", "1");
    const elapsed = Date.now() - start;

    expect(callLog[0]).toBe("collection:start");
    expect(callLog[1]).toBe("token:start");
    expect(elapsed).toBeLessThan(delay * 2 - 10);
  });

  it("returns_token_fallback_when_fetch_fails", async () => {
    mockFetch.mockRejectedValue(new Error("init failed"));

    const { getTokenSeoData } = await import("@/lib/marketplace/seo-data");
    const result = await getTokenSeoData("0xabc", "7");

    expect(result).toEqual({
      exists: false,
      tokenName: "Token #7",
      collectionName: "Genesis",
      description: null,
      image: null,
      collectionImage: null,
    });
  });

  it("reuses_cached_collection_and_token_fetches_across_calls", async () => {
    mockFetch.mockImplementation(async (_url: string, init?: RequestInit) => {
      const body = String(init?.body ?? "");
      if (body.includes("FROM token_contracts")) {
        return {
          ok: true,
          json: async () => ({
            rows: [
              {
                contract_address: "0xabc",
                metadata: JSON.stringify({
                  name: "Genesis",
                  image: "https://cdn.example.com/genesis.png",
                }),
                total_supply: "120",
              },
            ],
          }),
        };
      }

      return {
        ok: true,
        json: async () => ({
          rows: [
            {
              contract_address: "0xabc",
              token_id: "1",
              metadata: JSON.stringify({
                name: "Token #1",
                image: "https://cdn.example.com/1.png",
              }),
            },
          ],
        }),
      };
    });

    const { getTokenSeoData } = await import("@/lib/marketplace/seo-data");

    await getTokenSeoData("0xabc", "1");
    await getTokenSeoData("0xabc", "1");

    expect(mockFetch).toHaveBeenCalledTimes(2);
  });
});
