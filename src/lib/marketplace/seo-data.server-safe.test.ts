import { beforeEach, describe, expect, it, vi } from "vitest";

describe("marketplace seo data server-safe imports", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("returns fallback collection metadata when fetch fails", async () => {
    vi.doMock("@/lib/marketplace/config", () => ({
      getMarketplaceRuntimeConfig: () => ({
        chainLabel: "SN_SEPOLIA",
        warnings: [],
        sdkConfig: {
          chainId: "0x534e5f5345504f4c4941",
        },
        collections: [{ address: "0xabc", name: "Genesis", projectId: "project-a" }],
      }),
    }));

    vi.stubGlobal("fetch", vi.fn(async () => {
      throw new Error("network down");
    }));

    const { getCollectionSeoData } = await import("@/lib/marketplace/seo-data");
    const result = await getCollectionSeoData("0xabc");

    expect(result).toEqual({
      exists: false,
      name: "Genesis",
      description: null,
      image: null,
    });
  });
});
