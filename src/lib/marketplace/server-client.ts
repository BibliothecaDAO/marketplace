import "server-only";

import { cache } from "react";
import { getMarketplaceRuntimeConfig } from "@/lib/marketplace/config";

type MarketplaceModule = typeof import("@cartridge/arcade/marketplace");
type MarketplaceClient = Awaited<
  ReturnType<MarketplaceModule["createMarketplaceClient"]>
>;

const loadMarketplaceModule = cache(async (): Promise<MarketplaceModule> => {
  return await import("@cartridge/arcade/marketplace");
});

export const getServerMarketplaceClient = cache(
  async (): Promise<MarketplaceClient> => {
    const marketplaceModule = await loadMarketplaceModule();
    const { sdkConfig } = getMarketplaceRuntimeConfig();
    return await marketplaceModule.createMarketplaceClient(sdkConfig);
  },
);
