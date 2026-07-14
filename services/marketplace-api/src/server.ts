import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { parseMarketplaceRegistry } from "@biblio/marketplace-registry";
import { buildApp } from "./app.js";
import { StarknetRpcClient } from "./rpc/client.js";
import { buildRpcProxy } from "./rpc/proxy.js";
import { HttpToriiClient } from "./torii/http-client.js";
import { ToriiMarketplaceRepository } from "./torii/repository.js";

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

async function main() {
  const registryPath =
    process.env.MARKETPLACE_REGISTRY_PATH ??
    fileURLToPath(new URL("../../../config/marketplace/chains.json", import.meta.url));
  const registry = parseMarketplaceRegistry(
    JSON.parse(await readFile(registryPath, "utf8")),
  );
  const torii = new HttpToriiClient({
    endpoints: {
      SN_MAIN: requiredEnv("TORII_MAIN_URL"),
      SN_SEPOLIA: requiredEnv("TORII_SEPOLIA_URL"),
    },
  });
  const providers = {
    SN_MAIN: [
      requiredEnv("RPC_MAIN_PRIMARY_URL"),
      requiredEnv("RPC_MAIN_FALLBACK_URL"),
    ],
    SN_SEPOLIA: [
      requiredEnv("RPC_SEPOLIA_PRIMARY_URL"),
      requiredEnv("RPC_SEPOLIA_FALLBACK_URL"),
    ],
  } as const;
  const rpc = new StarknetRpcClient({ providers });
  const repository = new ToriiMarketplaceRepository(torii, {
    registry,
    rpc,
    currencies: Object.fromEntries(
      Object.entries(registry.chains).map(([chain, config]) => [
        chain,
        config?.currencies.map(({ address, symbol }) => ({ address, symbol })) ?? [],
      ]),
    ),
    buildVersion: process.env.TORII_BUILD_VERSION,
    replayVersion: process.env.TORII_REPLAY_VERSION,
    databaseSchemaVersion: process.env.TORII_DATABASE_SCHEMA_VERSION,
  });
  const app = await buildApp({
    allowedOrigins: (process.env.CORS_ORIGINS ?? "")
      .split(",")
      .map((origin) => origin.trim())
      .filter(Boolean),
    repository,
    registry,
    logger: true,
  });
  const rpcProxy = await buildRpcProxy({ providers, logger: true });
  await Promise.all([
    app.listen({
      host: "0.0.0.0",
      port: Number(process.env.PORT ?? 3001),
    }),
    rpcProxy.listen({
      host: "0.0.0.0",
      port: Number(process.env.RPC_PROXY_PORT ?? 3002),
    }),
  ]);
  const shutdown = async (signal: NodeJS.Signals) => {
    app.log.info({ signal }, "Stopping marketplace API");
    await Promise.all([app.close(), rpcProxy.close()]);
  };
  process.once("SIGTERM", () => void shutdown("SIGTERM"));
  process.once("SIGINT", () => void shutdown("SIGINT"));
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
  process.exitCode = 1;
});
