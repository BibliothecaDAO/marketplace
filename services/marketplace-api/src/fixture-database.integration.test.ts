import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { parseMarketplaceRegistry } from "@biblio/marketplace-registry";
import { buildApp } from "./app.js";
import { ToriiMarketplaceRepository, type ToriiQueryClient } from "./torii/repository.js";

const run = promisify(execFile);
const repositoryRoot = fileURLToPath(new URL("../../../", import.meta.url));

class SqliteFixtureClient implements ToriiQueryClient {
  constructor(private readonly databasePath: string) {}

  async query(_chain: "SN_MAIN" | "SN_SEPOLIA", sql: string): Promise<unknown[]> {
    const { stdout } = await run("sqlite3", [
      "-cmd",
      ".timeout 5000",
      "-json",
      this.databasePath,
      sql,
    ], {
      maxBuffer: 10 * 1024 * 1024,
    });
    if (stdout.trim() === "") return [];
    const parsed = JSON.parse(stdout) as unknown;
    if (!Array.isArray(parsed)) throw new Error("SQLite fixture did not return rows.");
    return parsed;
  }
}

describe("Fastify API against a fixture Torii SQLite database", () => {
  let directory = "";
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeAll(async () => {
    directory = await mkdtemp(join(tmpdir(), "marketplace-torii-fixture-"));
    const databasePath = join(directory, "torii.db");
    const fixturePath = resolve(repositoryRoot, "services/marketplace-api/fixtures/marketplace.sql");
    await run("sqlite3", [databasePath, `.read ${fixturePath}`]);
    const registry = parseMarketplaceRegistry(
      JSON.parse(
        await readFile(resolve(repositoryRoot, "config/marketplace/chains.json"), "utf8"),
      ),
    );
    const repository = new ToriiMarketplaceRepository(
      new SqliteFixtureClient(databasePath),
      {
        registry,
        currencies: Object.fromEntries(
          Object.entries(registry.chains).map(([chain, config]) => [
            chain,
            config?.currencies.map(({ address, symbol }) => ({ address, symbol })) ?? [],
          ]),
        ),
        nowEpochSeconds: () => 1_000,
        now: () => new Date("2026-07-14T00:00:00.000Z"),
        rpc: {
          getHead: async () => ({ blockNumber: 111, blockHash: "0x0aaa" }),
          getBlockHash: async () => "0x0bbb",
        },
      },
    );
    app = await buildApp({ allowedOrigins: [], repository, registry });
  });

  afterAll(async () => {
    await app?.close();
    if (directory) await rm(directory, { recursive: true, force: true });
  });

  it("reads every order lifecycle state and excludes expired rows from listings", async () => {
    const collection = "0x07ae27a31bb6526e3de9cf02f081f6ce0615ac12a6d7b85ee58b8ad7947a2809";
    const currency = "0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d";
    const orders = await app.inject({
      method: "GET",
      url: `/v1/chains/SN_MAIN/collections/${collection}/orders?currency=${currency}&limit=10`,
    });
    expect(orders.statusCode).toBe(200);
    const orderData = orders.json().data.items as Array<{
      id: string;
      status: string;
      quantity: string;
      remainingQuantity: string;
    }>;
    expect(orderData.map(({ id, status }) => ({ id, status }))).toEqual([
      { id: "11", status: "placed" },
      { id: "10", status: "placed" },
      { id: "9", status: "executed" },
      { id: "8", status: "cancelled" },
      { id: "7", status: "placed" },
    ]);
    expect(orderData[0]).toEqual(expect.objectContaining({
      quantity: "2",
      remainingQuantity: "1",
    }));

    const listings = await app.inject({
      method: "GET",
      url: `/v1/chains/SN_MAIN/collections/${collection}/listings?currency=${currency}&limit=10`,
    });
    expect(listings.statusCode).toBe(200);
    expect((listings.json().data.items as Array<{ id: string }>).map((order) => order.id))
      .toEqual(["11", "7"]);
  });

  it("returns Book governance history and tuple-safe order lookups", async () => {
    const collection = "0x07ae27a31bb6526e3de9cf02f081f6ce0615ac12a6d7b85ee58b8ad7947a2809";
    const book = await app.inject({
      method: "GET",
      url: "/v1/chains/SN_MAIN/marketplace/book",
    });
    expect(book.statusCode, book.body).toBe(200);
    expect(book.json().data).toEqual(expect.objectContaining({
      feeNumerator: "250",
      history: [
        expect.objectContaining({ changeTypes: ["initialized"] }),
        expect.objectContaining({
          changeTypes: expect.arrayContaining(["fee_changed", "version_changed"]),
        }),
      ],
    }));

    const lookup = await app.inject({
      method: "POST",
      url: "/v1/chains/SN_MAIN/orders/lookup",
      payload: {
        orders: [
          { id: "7", collection, tokenId: "42" },
          { id: "7", collection, tokenId: "43" },
        ],
      },
    });
    expect(lookup.statusCode).toBe(200);
    expect(lookup.json().data.orders).toEqual([
      expect.objectContaining({ order: expect.objectContaining({ id: "7", tokenId: "42" }) }),
      expect.objectContaining({ order: null }),
    ]);
  });
});
