import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  getValidity,
  buildCancelCalldata,
  buildExecuteCalldata,
  buildListCalldata,
  buildOfferCalldata,
  ArcadeProvider,
} = vi.hoisted(() => {
  const getValidity = vi.fn();
  const buildCancelCalldata = vi.fn(() => ({
    contractName: "Marketplace", entrypoint: "cancel", calldata: [],
  }));
  const buildExecuteCalldata = vi.fn(() => ({
    contractName: "Marketplace", entrypoint: "execute", calldata: [],
  }));
  const buildListCalldata = vi.fn(() => ({
    contractName: "Marketplace", entrypoint: "list", calldata: [],
  }));
  const buildOfferCalldata = vi.fn(() => ({
    contractName: "Marketplace", entrypoint: "offer", calldata: [],
  }));
  return {
    getValidity,
    buildCancelCalldata,
    buildExecuteCalldata,
    buildListCalldata,
    buildOfferCalldata,
    ArcadeProvider: vi.fn(function MockArcadeProvider() {
      return {
        marketplace: {
          getValidity,
          buildCancelCalldata,
          buildExecuteCalldata,
          buildListCalldata,
          buildOfferCalldata,
        },
      };
    }),
  };
});

vi.mock("@cartridge/arcade", () => ({ ArcadeProvider }));

describe("Arcade contract write adapter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("keeps retained contract validity and calldata builders behind one boundary", async () => {
    getValidity.mockResolvedValue({ is_valid: "0x1" });
    const { createMarketplaceWriteAdapter } = await import("./write-adapter");
    const adapter = createMarketplaceWriteAdapter("0x1", {
      marketplaceAddress: "0x456",
    });

    await expect(adapter.isOrderValid({
      id: "7", collection: "0xabc", tokenId: "42",
    })).resolves.toBe(true);
    expect(getValidity).toHaveBeenCalledWith("7", "0xabc", "42");
    expect(adapter.buildCancelCall({
      id: "7", collection: "0xabc", tokenId: "42",
    })).toEqual({
      contractAddress: "0x456",
      entrypoint: "cancel",
      calldata: ["7", "0xabc", "42", "0"],
    });
    expect(buildCancelCalldata).toHaveBeenCalledWith("7", "0xabc", "42");

    expect(adapter.buildExecuteCall({
      orderId: "7",
      collection: "0xabc",
      tokenId: "42",
      assetId: "42",
      quantity: "1",
      royalties: true,
      clientFee: "500",
      clientReceiver: "0xfee",
    })).toEqual(expect.objectContaining({
      entrypoint: "execute",
      calldata: ["7", "0xabc", "42", "0", "42", "0", "1", "1", "500", "0xfee"],
    }));
    expect(buildExecuteCalldata).toHaveBeenCalledWith(
      "7", "0xabc", "42", "42", "1", true, "500", "0xfee",
    );
  });

  it("builds list and offer calls with ABI-compatible u256 token ids", async () => {
    const { createMarketplaceWriteAdapter } = await import("./write-adapter");
    const adapter = createMarketplaceWriteAdapter("0x1", {
      marketplaceAddress: "0x456",
    });

    expect(adapter.buildListCall({
      collection: "0xabc",
      tokenId: "340282366920938463463374607431768211457",
      quantity: "0",
      price: "100",
      currency: "0xfee",
      expiration: "200",
      royalties: true,
    }).calldata).toEqual([
      "0xabc", "1", "1", "0", "100", "0xfee", "200", "1",
    ]);
    expect(adapter.buildOfferCall({
      collection: "0xabc",
      tokenId: "42",
      quantity: "2",
      price: "100",
      currency: "0xfee",
      expiration: "200",
    }).calldata).toEqual([
      "0xabc", "42", "0", "2", "100", "0xfee", "200",
    ]);
    expect(buildListCalldata).toHaveBeenCalledOnce();
    expect(buildOfferCalldata).toHaveBeenCalledOnce();
  });

  it("directly verifies seller ownership and marketplace approval", async () => {
    getValidity.mockResolvedValue(["0x1"]);
    const callContract = vi.fn(async (call: { entrypoint: string }) => {
      if (call.entrypoint === "owner_of") return ["0xabc"];
      if (call.entrypoint === "is_approved_for_all") return ["0x1"];
      throw new Error(`Unexpected ${call.entrypoint}`);
    });
    const { createMarketplaceWriteAdapter } = await import("./write-adapter");
    const adapter = createMarketplaceWriteAdapter("0x1", {
      marketplaceAddress: "0x456",
      contractCaller: { callContract },
    });

    await expect(adapter.isSellOrderExecutable({
      key: { id: "7", collection: "0xdef", tokenId: "42" },
      owner: "0x0abc",
    })).resolves.toBe(true);
    expect(callContract).toHaveBeenCalledWith({
      contractAddress: "0xdef",
      entrypoint: "owner_of",
      calldata: ["42", "0"],
    });
    expect(callContract).toHaveBeenCalledWith({
      contractAddress: "0xdef",
      entrypoint: "is_approved_for_all",
      calldata: ["0x0abc", "0x456"],
    });
  });

  it("accepts token-specific approval and decodes ERC20 u256 allowance", async () => {
    const callContract = vi.fn(async (call: { entrypoint: string }) => {
      if (call.entrypoint === "is_approved_for_all") return ["0x0"];
      if (call.entrypoint === "get_approved") return ["0x0456"];
      if (call.entrypoint === "allowance") return ["5", "1"];
      throw new Error(`Unexpected ${call.entrypoint}`);
    });
    const { createMarketplaceWriteAdapter } = await import("./write-adapter");
    const adapter = createMarketplaceWriteAdapter("0x1", {
      marketplaceAddress: "0x456",
      contractCaller: { callContract },
    });

    await expect(adapter.isTokenApproved("0xabc", "42", "0xowner"))
      .resolves.toBe(true);
    await expect(adapter.getAllowance("0xfee", "0xowner"))
      .resolves.toBe((BigInt(1) << BigInt(128)) + BigInt(5));
  });

  it("fails closed for unknown validity, missing callers, and mismatched owners", async () => {
    getValidity.mockResolvedValue({ unexpected: "value" });
    const { createMarketplaceWriteAdapter } = await import("./write-adapter");
    const adapter = createMarketplaceWriteAdapter("0x1", {
      marketplaceAddress: "0x456",
    });
    await expect(adapter.isOrderValid({ id: "1", collection: "0x2", tokenId: "3" }))
      .resolves.toBe(false);
    await expect(adapter.isTokenOwner("0x2", "3", "0x4")).resolves.toBe(false);
    await expect(adapter.getAllowance("0xfee", "0x4")).resolves.toBe(BigInt(0));
  });
});
