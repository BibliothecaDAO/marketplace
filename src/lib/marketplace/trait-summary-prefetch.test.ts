import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";

const { traits } = vi.hoisted(() => ({ traits: vi.fn() }));
vi.mock("@/lib/marketplace/api-client", () => ({
  getMarketplaceApiClient: () => ({ traits }),
}));

describe("owned trait summary prefetch", () => {
  it("prefetches facets into the collection-address cache key", async () => {
    traits.mockResolvedValue({ data: [
      { name: "Background", kind: "string", values: [
        { value: "Blue", count: "2" }, { value: "Red", count: "1" },
      ] },
      { name: "Eyes", kind: "string", values: [
        { value: "Big", count: "3" },
      ] },
    ] });
    const { traitNamesSummaryQueryKey } = await import("./trait-summary-query");
    const { prefetchTraitNamesSummary } = await import("./trait-summary-prefetch");
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    await prefetchTraitNamesSummary(queryClient, { address: "0xabc", projectId: "ignored" });
    expect(traits).toHaveBeenCalledWith("0xabc");
    expect(queryClient.getQueryData(traitNamesSummaryQueryKey({ address: "0xabc" }))).toEqual([
      { traitName: "Background", valueCount: 2 },
      { traitName: "Eyes", valueCount: 1 },
    ]);
  });
});
