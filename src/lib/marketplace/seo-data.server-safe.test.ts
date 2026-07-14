import { describe, expect, it, vi } from "vitest";

describe("marketplace SEO server-safe imports", () => {
  it("does not import the browser-only Arcade read SDK", async () => {
    vi.resetModules();
    vi.doMock("@cartridge/arcade/marketplace", () => {
      throw new TypeError("browser-only SDK imported");
    });
    vi.doMock("@/lib/marketplace/config", () => ({
      getMarketplaceRuntimeConfig: () => ({
        collections: [{ address: "0xabc", name: "Genesis" }],
      }),
    }));
    vi.doMock("@/lib/marketplace/api-client", () => ({
      getMarketplaceApiClient: () => ({
        collection: async () => { throw new Error("offline"); },
      }),
    }));
    const { getCollectionSeoData } = await import("./seo-data");
    await expect(getCollectionSeoData("0xabc")).resolves.toEqual({
      exists: false, name: "Genesis", description: null, image: null,
    });
  });
});
