import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockFetchCollectionTraitMetadata, mockAggregateTraitMetadata } = vi.hoisted(() => ({
  mockFetchCollectionTraitMetadata: vi.fn(),
  mockAggregateTraitMetadata: vi.fn(),
}));

vi.mock("@cartridge/arcade/marketplace", () => ({
  fetchCollectionTraitMetadata: mockFetchCollectionTraitMetadata,
  aggregateTraitMetadata: mockAggregateTraitMetadata,
}));

describe("collection trait metadata api route", () => {
  beforeEach(() => {
    mockFetchCollectionTraitMetadata.mockReset();
    mockAggregateTraitMetadata.mockReset();
  });

  it("uses_node_runtime_and_sets_cache_headers", async () => {
    const pages = [
      {
        projectId: "project-a",
        traits: [{ traitName: "Background", traitValue: "Blue", count: 5 }],
      },
    ];
    const traitMetadata = [{ traitName: "Background", traitValue: "Blue", count: 5 }];

    mockFetchCollectionTraitMetadata.mockResolvedValue({ pages, errors: [] });
    mockAggregateTraitMetadata.mockReturnValue(traitMetadata);

    const route = await import("@/app/api/collections/[address]/trait-metadata/route");
    const request = new Request(
      "https://market.realms.world/api/collections/0xabc/trait-metadata?projectId=project-a",
    );

    const response = await route.GET(request, {
      params: Promise.resolve({ address: "0xabc" }),
    });

    expect(route.runtime).toBe("nodejs");
    expect(mockFetchCollectionTraitMetadata).toHaveBeenCalledWith({
      address: "0xabc",
      projects: ["project-a"],
      defaultProjectId: "project-a",
    });
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe(
      "public, s-maxage=300, stale-while-revalidate=900",
    );
    expect(await response.json()).toEqual({ traitMetadata });
  });

  it("returns_500_and_disables_cache_when_sdk_throws", async () => {
    mockFetchCollectionTraitMetadata.mockRejectedValue(new Error("torii unavailable"));
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const route = await import("@/app/api/collections/[address]/trait-metadata/route");
    const request = new Request(
      "https://market.realms.world/api/collections/0xabc/trait-metadata",
    );

    const response = await route.GET(request, {
      params: Promise.resolve({ address: "0xabc" }),
    });

    expect(response.status).toBe(500);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({
      error: "failed to load collection trait metadata",
    });
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});
