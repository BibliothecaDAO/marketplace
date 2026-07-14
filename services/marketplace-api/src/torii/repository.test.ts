import { describe, expect, it } from "vitest";
import type { MarketplaceRegistry } from "@biblio/marketplace-registry";
import { COLLECTION_SORT_MODES } from "../app.js";
import { encodeCursor } from "../cursor.js";
import { ToriiMarketplaceRepository } from "./repository.js";

describe("Torii marketplace repository", () => {
  it("maps full-key order rows to lossless domain values and preserves missing keys", async () => {
    const felt = (value: string) => `0x${value.padStart(64, "0")}`;
    let capturedSql = "";
    const repository = new ToriiMarketplaceRepository({
      query: async (_chain, sql) => {
        capturedSql = sql;
        return [
        {
          id: 2312,
          collection: felt("2"),
          token_id: felt("2a"),
          royalties: 1,
          category: 3,
          status: 2,
          expiration: "0x77359400",
          quantity: "0x0",
          original_quantity: "0x2",
          price: "0xde0b6b3a7640000",
          currency: felt("1"),
          owner: felt("3"),
          created_block_number: 100,
          created_transaction_hash: felt("4"),
          created_transaction_index: 5,
          created_event_index: 6,
          created_caller: felt("3"),
          updated_block_number: 200,
          updated_transaction_hash: felt("5"),
          updated_transaction_index: 7,
          updated_event_index: 8,
          updated_caller: felt("6"),
        },
      ];
      },
    });

    const result = await repository.lookupOrders("SN_MAIN", [
      { id: "2312", collection: felt("2"), tokenId: "42" },
      { id: "9999", collection: felt("2"), tokenId: "42" },
    ]);

    expect(result).toEqual([
      {
        key: { id: "2312", collection: felt("2"), tokenId: "42" },
        order: {
          id: "2312",
          collection: felt("2"),
          tokenId: "42",
          royaltiesEnabled: true,
          royaltyTerms: {
            enabled: true,
            receiver: null,
            amountAtomic: null,
            source: "order",
          },
          category: "buy_any",
          categoryRaw: 3,
          status: "cancelled",
          statusRaw: 2,
          expiration: "2000000000",
          quantity: "2",
          remainingQuantity: "0",
          unitPriceAtomic: "1000000000000000000",
          currency: felt("1"),
          owner: felt("3"),
          createdAt: {
            blockNumber: 100,
            transactionHash: felt("4"),
            transactionIndex: 5,
            eventIndex: 6,
            caller: felt("3"),
          },
          updatedAt: {
            blockNumber: 200,
            transactionHash: felt("5"),
            transactionIndex: 7,
            eventIndex: 8,
            caller: felt("6"),
          },
        },
      },
      {
        key: { id: "9999", collection: felt("2"), tokenId: "42" },
        order: null,
      },
    ]);
    expect(capturedSql).toContain("marketplace_order_audit");
    expect(capturedSql).not.toContain("entities_historical");
  });

  it("normalizes token metadata, ownership, selected-currency floor, and keyset cursor", async () => {
    const felt = (value: string) => `0x${value.padStart(64, "0")}`;
    let capturedSql = "";
    const repository = new ToriiMarketplaceRepository(
      {
        query: async (_chain, sql) => {
          capturedSql = sql;
          return [
          {
            contract_address: felt("2"),
            token_id: felt("2a"),
            metadata: JSON.stringify({
              name: "Mage #42",
              description: "A battle mage",
              image: "ipfs://mage",
            }),
            owner: felt("3"),
            balance: "0x1",
            first_event_id: `0x64:${felt("4")}:${felt("2")}:0x0`,
            attributes_json: JSON.stringify([
              { trait_name: "Power", trait_value: "10" },
            ]),
            floor_price: "0x64",
            sort_value: "0x64",
            best_id: "0x7",
            best_collection: felt("2"),
            best_token_id: felt("2a"),
            best_royalties: 1,
            best_category: 2,
            best_status: 1,
            best_expiration: "0x0000000077359400",
            best_quantity: "0x1",
            best_original_quantity: "0x2",
            best_price: "0x64",
            best_currency: felt("1"),
            best_owner: felt("3"),
            best_created_block_number: 90,
            best_created_transaction_hash: felt("6"),
            best_created_transaction_index: 1,
            best_created_event_index: 2,
            best_created_caller: felt("3"),
            best_updated_block_number: 100,
            best_updated_transaction_hash: felt("7"),
            best_updated_transaction_index: 3,
            best_updated_event_index: 4,
            best_updated_caller: felt("3"),
          },
          {
            contract_address: felt("2"),
            token_id: felt("2b"),
            metadata: "{}",
            owner: null,
            balance: "0x0",
            first_event_id: `0x65:${felt("5")}:${felt("2")}:0x0`,
            attributes_json: "[]",
            floor_price: "0x32",
            sort_value: "0x32",
          },
          ];
        },
      },
      {
        currencies: {
          SN_MAIN: [{ address: felt("1"), symbol: "STRK" }],
          SN_SEPOLIA: [],
        },
        nowEpochSeconds: () => 1_700_000_000,
      },
    );

    const page = await repository.listTokens("SN_MAIN", felt("2"), {
      cursor: null,
      limit: 1,
      sort: "price-desc",
      currency: felt("1"),
      traits: ["Power:10"],
      tokenIds: ["42", "43"],
    });

    expect(page.items).toEqual([
      {
        collection: felt("2"),
        tokenId: "42",
        name: "Mage #42",
        description: "A battle mage",
        image: "ipfs://mage",
        owner: felt("3"),
        balance: "1",
        firstSeenBlock: 100,
        attributes: [{ traitName: "Power", value: 10 }],
        floorByCurrency: [
          { currency: felt("1"), symbol: "STRK", unitPriceAtomic: "100" },
        ],
        bestListing: expect.objectContaining({
          id: "7",
          collection: felt("2"),
          tokenId: "42",
          currency: felt("1"),
          unitPriceAtomic: "100",
          quantity: "2",
          remainingQuantity: "1",
        }),
      },
    ]);
    expect(page.nextCursor).toEqual(expect.any(String));
    expect(capturedSql).toContain("candidate.category = 2");
    expect(capturedSql).toContain(`candidate.currency = '${felt("1")}'`);
    expect(capturedSql).toContain("ORDER BY candidate.price ASC");
  });

  it.each(COLLECTION_SORT_MODES)("builds a complete server-side %s sort", async (sort) => {
    const felt = (value: string) => `0x${value.padStart(64, "0")}`;
    let capturedSql = "";
    const repository = new ToriiMarketplaceRepository({
      query: async (_chain, sql) => {
        capturedSql = sql;
        return [];
      },
    });

    await repository.listTokens("SN_MAIN", felt("2"), {
      cursor: null,
      limit: 24,
      sort,
      currency: felt("1"),
      traits: [],
      tokenIds: [],
    });

    expect(capturedSql).toContain("ORDER BY");
    expect(capturedSql).toContain("t.token_id");
    if (sort === "recent") expect(capturedSql).toContain("first_event_id");
    if (sort.startsWith("price")) expect(capturedSql).toContain("f.floor_price");
    if (sort.startsWith("power")) expect(capturedSql).toContain("'Power'");
    if (sort.startsWith("level")) expect(capturedSql).toContain("'Level'");
    if (sort.startsWith("health")) expect(capturedSql).toContain("'Health'");
    if (sort.startsWith("resource-count")) {
      expect(capturedSql).toContain("COUNT(*) FROM token_attributes resource_trait");
    }
  });

  it("continues numeric keyset pages into missing values and keeps null cursors isolated", async () => {
    const felt = (value: string) => `0x${value.padStart(64, "0")}`;
    const capturedSql: string[] = [];
    const repository = new ToriiMarketplaceRepository({
      query: async (_chain, sql) => {
        capturedSql.push(sql);
        return [];
      },
    });
    const currency = felt("1");

    await repository.listTokens("SN_MAIN", felt("2"), {
      cursor: encodeCursor(`tokens:power-asc:${currency}`, {
        sortValue: "10",
        tokenId: "42",
      }),
      limit: 24,
      sort: "power-asc",
      currency,
      traits: [],
      tokenIds: [],
    });
    await repository.listTokens("SN_MAIN", felt("2"), {
      cursor: encodeCursor(`tokens:health-desc:${currency}`, {
        sortValue: null,
        tokenId: "42",
      }),
      limit: 24,
      sort: "health-desc",
      currency,
      traits: [],
      tokenIds: [],
    });

    expect(capturedSql[0]).toContain("IS NULL");
    expect(capturedSql[0]).toContain(") > 10");
    expect(capturedSql[0]).not.toContain(") > '10'");
    expect(capturedSql[1]).toContain("IS NULL AND t.token_id <");
  });

  it("returns one token with lossless multi-currency floors", async () => {
    const felt = (value: string) => `0x${value.padStart(64, "0")}`;
    const repository = new ToriiMarketplaceRepository(
      {
        query: async () => [
          {
            contract_address: felt("2"),
            token_id: felt("2a"),
            metadata: JSON.stringify({ name: "Mage #42" }),
            owner: felt("3"),
            balance: "0x1",
            first_event_id: `0x64:${felt("4")}:${felt("2")}:0x0`,
            attributes_json: "[]",
            floors_json: JSON.stringify([
              { currency: felt("1"), price: "0x64" },
              { currency: felt("5"), price: "0xc8" },
            ]),
          },
        ],
      },
      {
        currencies: {
          SN_MAIN: [
            { address: felt("1"), symbol: "STRK" },
            { address: felt("5"), symbol: "LORDS" },
          ],
          SN_SEPOLIA: [],
        },
      },
    );

    const token = await repository.getToken("SN_MAIN", felt("2"), "42", felt("1"));

    expect(token).toEqual(
      expect.objectContaining({
        tokenId: "42",
        floorByCurrency: [
          { currency: felt("1"), symbol: "STRK", unitPriceAtomic: "100" },
          { currency: felt("5"), symbol: "LORDS", unitPriceAtomic: "200" },
        ],
      }),
    );
  });

  it("paginates non-zero account holdings by collection and token", async () => {
    const felt = (value: string) => `0x${value.padStart(64, "0")}`;
    let capturedSql = "";
    const repository = new ToriiMarketplaceRepository({
      query: async (_chain, sql) => {
        capturedSql = sql;
        return [
          {
            account_address: felt("9"),
            contract_address: felt("2"),
            token_id: felt("2a"),
            balance: "0x2",
            metadata: JSON.stringify({ name: "Mage #42" }),
            owner: felt("9"),
            first_event_id: `0x64:${felt("4")}:${felt("2")}:0x0`,
            attributes_json: "[]",
            floors_json: "[]",
          },
          {
            account_address: felt("9"),
            contract_address: felt("2"),
            token_id: felt("2b"),
            balance: "0x1",
            metadata: "{}",
            owner: felt("9"),
            first_event_id: `0x65:${felt("5")}:${felt("2")}:0x0`,
            attributes_json: "[]",
            floors_json: "[]",
          },
        ];
      },
    });

    const page = await repository.listHoldings("SN_MAIN", felt("9"), felt("2"), {
      cursor: null,
      limit: 1,
    });

    expect(capturedSql).toContain(`b.account_address = '${felt("9")}'`);
    expect(capturedSql).toContain(`b.contract_address = '${felt("2")}'`);
    expect(page.items).toEqual([
      expect.objectContaining({
        account: felt("9"),
        collection: felt("2"),
        tokenId: "42",
        balance: "2",
      }),
    ]);
    expect(page.nextCursor).toEqual(expect.any(String));
  });

  it("decodes proven cancel/remove causes and preserves ambiguous raw activity", async () => {
    const felt = (value: string) => `0x${value.padStart(64, "0")}`;
    const cancelSelector =
      "0x02979287743fc9323bd8e3f513f06468849cf4695b9599f9e20e9704e0077523";
    const repository = new ToriiMarketplaceRepository({
      query: async () => [
        {
          raw_type: "order_status_changed",
          type_raw: "order_snapshot:2",
          collection: felt("2"),
          token_id: felt("2a"),
          order_id: "0x7",
          owner: felt("3"),
          caller: felt("3"),
          category: 2,
          currency: felt("1"),
          price: "0x64",
          activity_quantity: "0x1",
          event_id: `0x1f3:${felt("8")}:${felt("2")}:0x2`,
          transaction_hash: felt("8"),
          transaction_index: 1,
          event_index: 2,
          block_number: 499,
          calldata: JSON.stringify([cancelSelector]),
        },
        {
          raw_type: "order_status_changed",
          type_raw: "order_snapshot:2",
          collection: felt("2"),
          token_id: felt("2a"),
          order_id: "0x7",
          owner: felt("3"),
          caller: felt("4"),
          category: 2,
          currency: felt("1"),
          price: "0x64",
          activity_quantity: "0x1",
          event_id: `0x1f2:${felt("9")}:${felt("2")}:0x1`,
          transaction_hash: felt("9"),
          transaction_index: 0,
          event_index: 1,
          block_number: 498,
          calldata: "[]",
          entrypoints: JSON.stringify(["remove"]),
        },
        {
          raw_type: "order_status_changed",
          type_raw: "order_snapshot:2",
          collection: felt("2"),
          token_id: felt("2a"),
          order_id: "0x7",
          owner: felt("3"),
          caller: felt("4"),
          category: 2,
          currency: felt("1"),
          price: "0x64",
          activity_quantity: "0x1",
          event_id: `0x1f1:${felt("a")}:${felt("2")}:0x0`,
          transaction_hash: felt("a"),
          transaction_index: 0,
          event_index: 0,
          block_number: 497,
          calldata: "[]",
          entrypoints: JSON.stringify(["cancel", "remove"]),
        },
      ],
    });

    const page = await repository.listActivity("SN_MAIN", felt("2"), "42", {
      cursor: null,
      limit: 24,
    });

    expect(page.items[0]).toEqual(
      expect.objectContaining({
        type: "order_cancelled",
        from: felt("3"),
        provenance: expect.objectContaining({ caller: felt("3") }),
      }),
    );
    expect(page.items[1]).toEqual(
      expect.objectContaining({
        type: "order_removed",
        rawSource: expect.objectContaining({ calldata: [] }),
      }),
    );
    expect(page.items[2]).toEqual(
      expect.objectContaining({
        type: "order_status_changed",
        rawSource: expect.objectContaining({
          entrypoints: ["cancel", "remove"],
        }),
      }),
    );
  });

  it("reports checkout-safe diagnostics only inside the accepted-block lag window", async () => {
    const felt = (value: string) => `0x${value.padStart(64, "0")}`;
    const registry: MarketplaceRegistry = {
      schemaVersion: "1.0.0",
      chains: {
        SN_MAIN: {
          chainId: "0x534e5f4d41494e",
          world: { address: felt("a"), classHash: felt("b"), startBlock: 10 },
          marketplace: { address: felt("c"), classHash: felt("d"), startBlock: 12 },
          currencies: [],
          collections: [],
        },
      },
    };
    const repository = new ToriiMarketplaceRepository(
      {
        query: async (_chain, sql) =>
          sql.includes("marketplace_metadata_failures")
            ? [{ failure_count: 3 }]
            : [{ head: 500 }],
      },
      {
        registry,
        rpc: {
          getHead: async () => ({ blockNumber: 502, blockHash: felt("f") }),
          getBlockHash: async () => felt("e"),
        },
        now: () => new Date("2026-07-14T00:00:00.000Z"),
        buildVersion: "torii-fe3ed0f",
        replayVersion: "replay-1",
        databaseSchemaVersion: "schema-1",
      },
    );

    await expect(repository.getDetailedIndexerStatus("SN_MAIN")).resolves.toEqual({
      buildVersion: "torii-fe3ed0f",
      replayVersion: "replay-1",
      databaseSchemaVersion: "schema-1",
      indexedBlock: 500,
      indexedBlockHash: felt("e"),
      chainHead: 502,
      lagBlocks: 2,
      finality: "accepted_l2",
      metadataFailures: 3,
      safeForCheckout: true,
    });
  });
});
