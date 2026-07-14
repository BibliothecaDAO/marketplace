import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  canonicalFelt,
  generateToriiConfig,
  parseMarketplaceRegistry,
} from "./index.js";

describe("marketplace registry", () => {
  it("rejects values outside the Starknet field range", () => {
    const starkFieldPrime = (1n << 251n) + 17n * (1n << 192n) + 1n;

    expect(() => canonicalFelt(`0x${starkFieldPrime.toString(16)}`)).toThrow(
      /outside the Starknet field range/i,
    );
    expect(() => canonicalFelt(`0x${(starkFieldPrime + 1n).toString(16)}`)).toThrow(
      /outside the Starknet field range/i,
    );
  });

  it("accepts a complete chain registry and canonicalizes felt addresses", () => {
    const registry = parseMarketplaceRegistry({
      schemaVersion: "1.0.0",
      chains: {
        SN_MAIN: {
          chainId: "0x534e5f4d41494e",
          world: {
            address: "0xabc",
            classHash: "0x123",
            startBlock: 10,
          },
          marketplace: {
            address: "0xdef",
            classHash: "0x456",
            startBlock: 12,
          },
          currencies: [
            {
              address: "0x1",
              symbol: "STRK",
              decimals: 18,
              icon: "/tokens/strk.svg",
            },
          ],
          collections: [
            {
              address: "0x2",
              name: "Genesis",
              standard: "ERC721",
              startBlock: 1,
              metadata: { enabled: true },
            },
          ],
        },
      },
    });

    expect(registry.chains.SN_MAIN?.world.address).toBe(
      `0x${"abc".padStart(64, "0")}`,
    );
    expect(registry.chains.SN_MAIN?.collections[0]?.address).toBe(
      `0x${"2".padStart(64, "0")}`,
    );
  });

  it("rejects duplicate normalized collection addresses", () => {
    expect(() =>
      parseMarketplaceRegistry({
        schemaVersion: "1.0.0",
        chains: {
          SN_MAIN: {
            chainId: "0x534e5f4d41494e",
            world: { address: "0xabc", classHash: "0x123", startBlock: 10 },
            marketplace: { address: "0xdef", classHash: "0x456", startBlock: 12 },
            currencies: [
              { address: "0x1", symbol: "STRK", decimals: 18, icon: "/strk.svg" },
            ],
            collections: [
              {
                address: "0x2",
                name: "Genesis",
                standard: "ERC721",
                startBlock: 1,
                metadata: { enabled: true },
              },
              {
                address: "0x02",
                name: "Duplicate",
                standard: "ERC721",
                startBlock: 1,
                metadata: { enabled: true },
              },
            ],
          },
        },
      }),
    ).toThrow(/duplicate collection address/i);
  });

  it("generates a deterministic Torii configuration without embedding RPC secrets", () => {
    const registry = parseMarketplaceRegistry({
      schemaVersion: "1.0.0",
      chains: {
        SN_MAIN: {
          chainId: "0x534e5f4d41494e",
          world: { address: "0xabc", classHash: "0x123", startBlock: 10 },
          marketplace: { address: "0xdef", classHash: "0x456", startBlock: 12 },
          currencies: [
            { address: "0x1", symbol: "STRK", decimals: 18, icon: "/strk.svg" },
          ],
          collections: [
            {
              address: "0x2",
              name: "Genesis",
              standard: "ERC721",
              startBlock: 1,
              metadata: { enabled: true },
            },
          ],
        },
      },
    });

    const config = generateToriiConfig(registry, "SN_MAIN");

    expect(config).toContain('rpc = "${TORII_RPC_URL}"');
    expect(config).toContain("world_block = 10");
    expect(config).toContain('namespaces = ["ARCADE"]');
    expect(config).toContain("preconfirmed = false");
    expect(config).toContain("transactions = true");
    expect(config).toContain("transaction_receipts = true");
    expect(config).toContain("strict_model_reader = true");
    expect(config).toContain(
      `"ERC721:0x${"2".padStart(64, "0")}:1"`,
    );
    expect(config).toContain('historical = ["ARCADE-Order", "ARCADE-Book"]');
    expect(config).toContain('migrations = "/etc/torii/migrations"');
    expect(config).toContain("model_updated:ARCADE-Order:INSERT OR IGNORE");
    expect(config).toContain("model_updated:ARCADE-Book:INSERT OR IGNORE");
    expect(config).toContain("max_metadata_tasks = 8");
    expect(config).toContain("trait_counts = true");
    expect(config).toContain("metadata_updates_only_at_head = true");
    expect(config).toContain("async_metadata_updates = true");
    expect(config).toContain(
      `metadata_update_whitelist = ["0x${"2".padStart(64, "0")}"]`,
    );
    expect(config).not.toContain("models =");
    expect(config).not.toContain("https://");
  });

  it("rejects duplicate currency symbols and addresses after normalization", () => {
    expect(() =>
      parseMarketplaceRegistry({
        schemaVersion: "1.0.0",
        chains: {
          SN_MAIN: {
            chainId: "0x534e5f4d41494e",
            world: { address: "0xabc", classHash: "0x123", startBlock: 10 },
            marketplace: { address: "0xdef", classHash: "0x456", startBlock: 12 },
            currencies: [
              { address: "0x1", symbol: "STRK", decimals: 18, icon: "/strk.svg" },
              { address: "0x01", symbol: "strk", decimals: 18, icon: "/other.svg" },
            ],
            collections: [],
          },
        },
      }),
    ).toThrow(/duplicate currency/i);
  });

  it("validates the checked-in production registry for both supported chains", () => {
    const path = fileURLToPath(
      new URL("../../../config/marketplace/chains.json", import.meta.url),
    );
    const source = readFileSync(path, "utf8");
    const registry = parseMarketplaceRegistry(JSON.parse(source));

    expect(Object.keys(registry.chains).sort()).toEqual(["SN_MAIN", "SN_SEPOLIA"]);
    expect(registry.chains.SN_MAIN?.collections).toHaveLength(7);
    expect(registry.chains.SN_SEPOLIA?.collections).toHaveLength(0);
    expect(source).not.toMatch(/rpc|secret|api[_-]?key/i);
  });

  it("keeps generated Torii and frontend artifacts byte-for-byte deterministic", () => {
    const root = fileURLToPath(new URL("../../../", import.meta.url));
    const source = readFileSync(`${root}config/marketplace/chains.json`, "utf8");
    const registry = parseMarketplaceRegistry(JSON.parse(source));

    expect(readFileSync(`${root}docker/torii/config/SN_MAIN.toml`, "utf8")).toBe(
      generateToriiConfig(registry, "SN_MAIN"),
    );
    expect(readFileSync(`${root}docker/torii/config/SN_SEPOLIA.toml`, "utf8")).toBe(
      generateToriiConfig(registry, "SN_SEPOLIA"),
    );
    expect(
      JSON.parse(
        readFileSync(`${root}src/lib/marketplace/generated-registry.json`, "utf8"),
      ),
    ).toEqual(registry);
  });
});
