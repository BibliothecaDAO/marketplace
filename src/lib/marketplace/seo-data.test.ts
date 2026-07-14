import { beforeEach, describe, expect, it, vi } from "vitest";

const { api, runtimeConfig } = vi.hoisted(() => ({
  api: { collection: vi.fn(), token: vi.fn() },
  runtimeConfig: {
    chainLabel: "SN_MAIN",
    collections: [{ address: "0xabc", name: "Genesis" }],
  },
}));

vi.mock("@/lib/marketplace/api-client", () => ({
  getMarketplaceApiClient: () => api,
}));
vi.mock("@/lib/marketplace/config", () => ({
  getMarketplaceRuntimeConfig: () => runtimeConfig,
}));

describe("owned marketplace SEO data", () => {
  beforeEach(() => {
    vi.resetModules();
    api.collection.mockReset();
    api.token.mockReset();
  });

  it("returns collection metadata from the owned API", async () => {
    api.collection.mockResolvedValue({ data: {
      address: "0xabc", name: "Genesis", description: "A flagship collection",
      image: "https://cdn.example.com/genesis.png", bannerImage: null,
      standard: "ERC721", deploymentBlock: 1, verified: true,
      tokenCount: "8", listingCount: "2", floorByCurrency: [],
    }});
    const { getCollectionSeoData } = await import("./seo-data");
    await expect(getCollectionSeoData("0xabc")).resolves.toEqual({
      exists: true,
      name: "Genesis",
      description: "A flagship collection",
      image: "https://cdn.example.com/genesis.png",
    });
    expect(api.collection).toHaveBeenCalledWith("0xabc");
  });

  it("fetches collection and canonical decimal token in parallel", async () => {
    const calls: string[] = [];
    api.collection.mockImplementation(async () => {
      calls.push("collection");
      return { data: { name: "Genesis", image: null } };
    });
    api.token.mockImplementation(async () => {
      calls.push("token");
      return { data: {
        tokenId: "42", name: "Dragon #42", description: "A dragon",
        image: "https://cdn.example.com/42.png",
      }};
    });
    const { getTokenSeoData } = await import("./seo-data");
    await expect(getTokenSeoData("0xabc", "0x2a")).resolves.toEqual({
      exists: true,
      tokenName: "Dragon #42",
      collectionName: "Genesis",
      description: "A dragon",
      image: "https://cdn.example.com/42.png",
      collectionImage: null,
    });
    expect(calls).toEqual(["collection", "token"]);
    expect(api.token).toHaveBeenCalledWith("0xabc", "42");
  });

  it("returns noindex fallbacks when owned reads fail", async () => {
    api.collection.mockRejectedValue(new Error("unavailable"));
    api.token.mockRejectedValue(new Error("unavailable"));
    const { getTokenSeoData, getCollectionSeoData } = await import("./seo-data");
    await expect(getCollectionSeoData("0xabc")).resolves.toEqual({
      exists: false, name: "Genesis", description: null, image: null,
    });
    await expect(getTokenSeoData("0xabc", "999")).resolves.toEqual({
      exists: false, tokenName: "Token #999", collectionName: "Genesis",
      description: null, image: null, collectionImage: null,
    });
  });
});
