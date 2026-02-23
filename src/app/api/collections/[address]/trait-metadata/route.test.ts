import { beforeEach, describe, expect, it, vi } from "vitest";

describe("collection trait metadata api route", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("uses_edge_runtime_and_sets_cache_headers", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify([
          { trait_name: "Background", trait_value: "Blue" },
          { trait_name: "Background", trait_value: "Blue" },
          { trait_name: "Body", trait_value: "Human" },
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

    expect(route.runtime).toBe("edge");
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.cartridge.gg/x/project-a/torii/sql",
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining("WITH scoped_tokens AS"),
      }),
    );
    expect(fetchMock.mock.calls[0]?.[1]).toEqual(expect.objectContaining({
      body: expect.stringContaining("INNER JOIN scoped_tokens"),
    }));
    expect(fetchMock.mock.calls[0]?.[1]).toEqual(expect.objectContaining({
      body: expect.stringContaining("scoped_token_id"),
    }));
    expect(fetchMock.mock.calls[0]?.[1]).toEqual(expect.objectContaining({
      body: expect.not.stringContaining("token_id LIKE"),
    }));
    expect(fetchMock.mock.calls[0]?.[1]).toEqual(expect.objectContaining({
      body: expect.not.stringContaining("scoped_tokens.token_id = token_attributes.token_id"),
    }));
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe(
      "public, s-maxage=300, stale-while-revalidate=900",
    );
    expect(await response.json()).toEqual({
      traitMetadata: [
        { traitName: "Background", traitValue: "Blue", count: 2 },
        { traitName: "Body", traitValue: "Human", count: 1 },
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

  it("retries_with_fallback_query_when_primary_query_times_out", async () => {
    const timeoutError = Object.assign(new Error("The operation was aborted due to timeout"), {
      name: "TimeoutError",
    });
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(timeoutError)
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify([
            { trait_name: "Background", trait_value: "Blue" },
            { trait_name: "Body", trait_value: "Human" },
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

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0]?.[1]).toEqual(expect.objectContaining({
      body: expect.stringContaining("WITH scoped_tokens AS"),
    }));
    expect(fetchMock.mock.calls[1]?.[1]).toEqual(expect.objectContaining({
      body: expect.stringContaining("token_id LIKE"),
    }));
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe(
      "public, s-maxage=300, stale-while-revalidate=900",
    );
    expect(await response.json()).toEqual({
      traitMetadata: [
        { traitName: "Background", traitValue: "Blue", count: 1 },
        { traitName: "Body", traitValue: "Human", count: 1 },
      ],
    });
  });
});
