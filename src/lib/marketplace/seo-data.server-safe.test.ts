import { beforeEach, describe, expect, it, vi } from "vitest";

describe("marketplace seo data server-safe imports", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("returns fallback collection metadata when sdk import fails", async () => {
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

    vi.doMock("@cartridge/arcade/marketplace", () => {
      throw new TypeError("(0 , g.createContext) is not a function");
    });
    vi.doMock("@cartridge/arcade/marketplace/edge", () => ({
      createEdgeMarketplaceClient: vi.fn(async () => ({
        getCollection: vi.fn().mockResolvedValue({
          address: "0xabc",
          metadata: {
            name: "Genesis",
            description: "From edge runtime",
            image: "https://cdn.example.com/genesis.png",
          },
        }),
        getToken: vi.fn(),
      })),
    }));

    const { getCollectionSeoData } = await import("@/lib/marketplace/seo-data");
    const result = await getCollectionSeoData("0xabc");

    expect(result).toEqual({
      exists: true,
      name: "Genesis",
      description: "From edge runtime",
      image: "https://cdn.example.com/genesis.png",
    });
  });
});
