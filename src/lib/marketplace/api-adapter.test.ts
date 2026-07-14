import { describe, expect, it } from "vitest";
import type {
  CollectionSummary,
  MarketplaceHolding,
  MarketplaceOrder,
  MarketplaceToken,
} from "@biblio/marketplace-api-contract";
import {
  collectionFromApi,
  holdingBalanceFromApi,
  orderFromApi,
  tokenFromApi,
} from "@/lib/marketplace/api-adapter";

const felt = (digit: string) => `0x${digit.repeat(64)}`;
const provenance = {
  blockNumber: 10,
  transactionHash: felt("a"),
  transactionIndex: 2,
  eventIndex: 3,
  caller: felt("b"),
};

describe("owned API compatibility adapter", () => {
  it("maps lossless token metadata into the existing UI token boundary", () => {
    const token: MarketplaceToken = {
      collection: felt("1"),
      tokenId: "42",
      name: "Mage #42",
      description: "A battle mage",
      image: "ipfs://mage",
      owner: felt("2"),
      balance: "1",
      firstSeenBlock: 100,
      attributes: [{ traitName: "Power", value: 10 }],
      floorByCurrency: [
        { currency: felt("3"), symbol: "STRK", unitPriceAtomic: "99" },
      ],
      bestListing: {
        id: "7",
        collection: felt("1"),
        tokenId: "42",
        category: "sell",
        categoryRaw: 2,
        status: "placed",
        statusRaw: 1,
        owner: felt("2"),
        currency: felt("3"),
        unitPriceAtomic: "99",
        quantity: "1",
        remainingQuantity: "1",
        expiration: "2000000000",
        royaltiesEnabled: false,
        royaltyTerms: { enabled: false, receiver: null, amountAtomic: null, source: "order" },
        createdAt: provenance,
        updatedAt: provenance,
      },
      rawMetadata: { animation_url: "ipfs://animation" },
    };

    expect(tokenFromApi(token)).toEqual(
      expect.objectContaining({
        contract_address: felt("1"),
        token_id: "42",
        image: "ipfs://mage",
        total_supply: "1",
        price: "99",
        currency: felt("3"),
        best_listing: expect.objectContaining({
          id: "7",
          tokenId: "42",
          price: "99",
          currency: felt("3"),
        }),
        metadata: expect.objectContaining({
          name: "Mage #42",
          description: "A battle mage",
          animation_url: "ipfs://animation",
          attributes: [{ trait_type: "Power", value: 10 }],
        }),
      }),
    );
  });

  it("preserves tuple identity and contract-facing order terms", () => {
    const order: MarketplaceOrder = {
      id: "7",
      collection: felt("1"),
      tokenId: "42",
      category: "sell",
      categoryRaw: 2,
      status: "placed",
      statusRaw: 1,
      owner: felt("2"),
      currency: felt("3"),
      unitPriceAtomic: "100",
      quantity: "1",
      remainingQuantity: "1",
      expiration: "2000000000",
      royaltiesEnabled: true,
      royaltyTerms: { enabled: true, receiver: null, amountAtomic: null, source: "order" },
      createdAt: provenance,
      updatedAt: provenance,
    };

    expect(orderFromApi(order)).toEqual(
      expect.objectContaining({
        id: "7",
        collection: felt("1"),
        tokenId: "42",
        token_id: "42",
        category: "Sell",
        status: "Placed",
        price: "100",
        quantity: "1",
        remainingQuantity: "1",
        currency: felt("3"),
      }),
    );
  });

  it("maps collection and holding responses without project identifiers", () => {
    const collection: CollectionSummary = {
      address: felt("1"),
      name: "Genesis",
      standard: "ERC721",
      deploymentBlock: 1,
      verified: true,
      tokenCount: "8000",
      listingCount: "42",
      floorByCurrency: [],
    };
    const token = tokenFromApi({
      collection: felt("1"),
      tokenId: "9",
      name: "Nine",
      description: null,
      image: null,
      owner: felt("2"),
      balance: "1",
      firstSeenBlock: 1,
      attributes: [],
      floorByCurrency: [],
      bestListing: null,
    });
    const holding = {
      account: felt("2"),
      collection: felt("1"),
      tokenId: "9",
      balance: "1",
      token: {
        collection: felt("1"),
        tokenId: "9",
        name: "Nine",
        description: null,
        image: null,
        owner: felt("2"),
        balance: "1",
        firstSeenBlock: 1,
        attributes: [],
        floorByCurrency: [],
        bestListing: null,
      },
    } satisfies MarketplaceHolding;

    expect(collectionFromApi(collection)).toEqual(
      expect.objectContaining({
        address: felt("1"),
        totalSupply: "8000",
        metadata: { name: "Genesis" },
      }),
    );
    expect(holdingBalanceFromApi(holding)).toEqual({
      account_address: felt("2"),
      contract_address: felt("1"),
      token_id: "9",
      balance: "1",
      token,
    });
  });
});
