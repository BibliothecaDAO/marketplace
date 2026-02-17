import { mainnet, sepolia } from "@starknet-react/chains";
import { describe, expect, it, vi } from "vitest";

const { MockControllerConnector, mockControllerConnectorOptions } = vi.hoisted(
  () => {
    const mockControllerConnectorOptions = vi.fn();

    class MockControllerConnector {
      constructor(options?: unknown) {
        mockControllerConnectorOptions(options);
      }
    }

    return { MockControllerConnector, mockControllerConnectorOptions };
  },
);

vi.mock("@cartridge/connector", () => ({
  ControllerConnector: MockControllerConnector,
}));

import { buildStarknetConfig } from "@/lib/marketplace/starknet-config";

describe("starknet config", () => {
  it("maps SN_MAIN chain label to cartridge-backed mainnet defaults", () => {
    const config = buildStarknetConfig("SN_MAIN");

    expect(mockControllerConnectorOptions).toHaveBeenCalledWith(undefined);
    expect(config.chains).toEqual([mainnet, sepolia]);
    expect(config.defaultChainId).toBe(mainnet.id);
    expect(config.provider).toBeTypeOf("function");
    expect(config.connectors).toHaveLength(3);
    expect(config.connectors[0]).toBeInstanceOf(MockControllerConnector);
    expect(config.explorer).toBeTypeOf("function");
    const mainnetProvider = config.provider(mainnet);
    const sepoliaProvider = config.provider(sepolia);

    expect(mainnetProvider).not.toBeNull();
    expect(sepoliaProvider).not.toBeNull();
    expect(mainnetProvider?.channel.nodeUrl).toContain(
      "https://api.cartridge.gg/x/starknet/mainnet",
    );
    expect(sepoliaProvider?.channel.nodeUrl).toContain(
      "https://api.cartridge.gg/x/starknet/sepolia",
    );
  });

  it("maps SN_SEPOLIA chain label to the sepolia default chain", () => {
    const config = buildStarknetConfig("SN_SEPOLIA");

    expect(config.defaultChainId).toBe(sepolia.id);
  });

  it("does not force a default chain for custom chain labels", () => {
    const config = buildStarknetConfig("custom");

    expect(config.defaultChainId).toBeUndefined();
  });
});
