import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  generateToriiConfig,
  parseMarketplaceRegistry,
  type MarketplaceChainAlias,
} from "./index.js";

const root = fileURLToPath(new URL("../../../", import.meta.url));
const sourcePath = `${root}config/marketplace/chains.json`;
const registry = parseMarketplaceRegistry(
  JSON.parse(readFileSync(sourcePath, "utf8")) as unknown,
);

for (const alias of Object.keys(registry.chains) as MarketplaceChainAlias[]) {
  writeFileSync(
    `${root}docker/torii/config/${alias}.toml`,
    generateToriiConfig(registry, alias),
  );
}

writeFileSync(
  `${root}src/lib/marketplace/generated-registry.json`,
  `${JSON.stringify(registry, null, 2)}\n`,
);
