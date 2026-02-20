import { beforeEach, describe, expect, it, vi } from "vitest";

describe("collection trait metadata api route", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("uses_node_runtime_and_sets_cache_headers", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify([
          { trait_name: "Background", trait_value: "Blue", count: 3 },
          { trait_name: "Background", trait_value: "Blue", count: 2 },
          { trait_name: "Body", trait_value: "Human", count: 4 },
        ]),
        {
          status: 200,
          headers: { "content-type": "application/json" },
        },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const route = await import("@/app/api/collections/[address]/trait-metadata/route");
    const request = new Request(
      "https://market.realms.world/api/collections/0xabc/trait-metadata?projectId=project-a",
    );

    const response = await route.GET(request, {
      params: Promise.resolve({ address: "0xabc" }),
    });

    expect(route.runtime).toBe("nodejs");
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.cartridge.gg/x/project-a/torii/sql",
      expect.objectContaining({
        method: "POST",
      }),
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe(
      "public, s-maxage=300, stale-while-revalidate=900",
    );
    expect(await response.json()).toEqual({
      traitMetadata: [
        { traitName: "Background", traitValue: "Blue", count: 5 },
        { traitName: "Body", traitValue: "Human", count: 4 },
      ],
    });
  });

  it("returns_empty_metadata_and_disables_cache_when_upstream_throws", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error("torii unavailable"));
    vi.stubGlobal("fetch", fetchMock);
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const route = await import("@/app/api/collections/[address]/trait-metadata/route");
    const request = new Request(
      "https://market.realms.world/api/collections/0xabc/trait-metadata",
    );

    const response = await route.GET(request, {
      params: Promise.resolve({ address: "0xabc" }),
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({
      traitMetadata: [],
    });
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});
