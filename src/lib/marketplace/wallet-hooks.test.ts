import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockUseMarketplaceTokenBalances } = vi.hoisted(() => ({
  mockUseMarketplaceTokenBalances: vi.fn(),
}));

vi.mock("@cartridge/arcade/marketplace/react", () => ({
  useMarketplaceTokenBalances: mockUseMarketplaceTokenBalances,
}));

describe("wallet hooks", () => {
  beforeEach(() => {
    vi.resetModules();
    mockUseMarketplaceTokenBalances.mockReset();
  });

  it("useTokenOwnershipQuery_passes_alt_token_ids", async () => {
    mockUseMarketplaceTokenBalances.mockReturnValue({ status: "success", data: { page: { balances: [] } } });

    const { useTokenOwnershipQuery } = await import("@/lib/marketplace/wallet-hooks");
    renderHook(
      () => useTokenOwnershipQuery({ collection: "0xcol", tokenId: "2648", accountAddress: "0xabc" }),
    );

    expect(mockUseMarketplaceTokenBalances).toHaveBeenCalledWith(
      expect.objectContaining({
        contractAddresses: ["0xcol"],
        accountAddresses: ["0xabc"],
        tokenIds: expect.arrayContaining(["2648", "0xa58"]),
      }),
      expect.objectContaining({ enabled: true }),
    );
  });

  it("useTokenHolderQuery_passes_alt_token_ids", async () => {
    mockUseMarketplaceTokenBalances.mockReturnValue({ status: "success", data: { page: { balances: [] } } });

    const { useTokenHolderQuery } = await import("@/lib/marketplace/wallet-hooks");
    renderHook(
      () => useTokenHolderQuery({ collection: "0xcol", tokenId: "0xa58" }),
    );

    expect(mockUseMarketplaceTokenBalances).toHaveBeenCalledWith(
      expect.objectContaining({
        contractAddresses: ["0xcol"],
        tokenIds: expect.arrayContaining(["0xa58", "2648"]),
      }),
      expect.objectContaining({ enabled: true }),
    );
  });
});
