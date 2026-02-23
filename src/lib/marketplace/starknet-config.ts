import { ControllerConnector } from "@cartridge/connector";
import { mainnet, sepolia } from "@starknet-react/chains";
import { braavos, cartridge, jsonRpcProvider, ready } from "@starknet-react/core";
import type { MarketplaceRuntimeConfig } from "@/lib/marketplace/config";

type MarketplaceChainLabel = MarketplaceRuntimeConfig["chainLabel"];

const CARTRIDGE_RPC_BASE_URL = "https://api.cartridge.gg/x/starknet";

let _controllerConnector: ControllerConnector | null = null;
function getControllerConnector() {
  if (!_controllerConnector) {
    _controllerConnector = new ControllerConnector();
  }
  return _controllerConnector;
}

export function buildStarknetConfig(chainLabel: MarketplaceChainLabel) {
  return {
    chains: [mainnet, sepolia],
    provider: jsonRpcProvider({
      rpc: (chain) => ({
        nodeUrl: `${CARTRIDGE_RPC_BASE_URL}/${chain.network}`,
      }),
    }),
    explorer: cartridge,
    connectors: [getControllerConnector(), ready(), braavos()],
    defaultChainId:
      chainLabel === "SN_MAIN"
        ? mainnet.id
        : chainLabel === "SN_SEPOLIA"
          ? sepolia.id
          : undefined,
  };
}
