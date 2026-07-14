import { beforeEach, describe, expect, it, vi } from "vitest";

const { getValidity, ArcadeProvider } = vi.hoisted(() => {
  const getValidity = vi.fn();
  return {
    getValidity,
    ArcadeProvider: vi.fn(function MockArcadeProvider() {
      return { marketplace: { getValidity } };
    }),
  };
});

vi.mock("@cartridge/arcade", () => ({ ArcadeProvider }));

describe("Arcade contract write adapter", () => {
  beforeEach(() => {
    getValidity.mockReset();
    ArcadeProvider.mockClear();
  });

  it("keeps the retained contract validity read behind one narrow boundary", async () => {
    getValidity.mockResolvedValue({ is_valid: "0x1" });
    const { createMarketplaceWriteAdapter } = await import("./write-adapter");
    const adapter = createMarketplaceWriteAdapter("0x534e5f4d41494e");
    await expect(adapter.isOrderValid({
      id: "7", collection: "0xabc", tokenId: "42",
    })).resolves.toBe(true);
    expect(getValidity).toHaveBeenCalledWith("7", "0xabc", "42");
  });

  it("fails closed for unknown validity response shapes", async () => {
    getValidity.mockResolvedValue({ unexpected: "value" });
    const { createMarketplaceWriteAdapter } = await import("./write-adapter");
    await expect(createMarketplaceWriteAdapter("0x1").isOrderValid({
      id: "1", collection: "0x2", tokenId: "3",
    })).resolves.toBe(false);
  });
});
