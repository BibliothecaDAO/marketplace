import { ArcadeProvider } from "@cartridge/arcade";

export type MarketplaceOrderKey = {
  id: string;
  collection: string;
  tokenId: string;
};

export type MarketplaceAccountCall = {
  contractAddress: string;
  entrypoint: string;
  calldata: string[];
};

export type MarketplaceContractCaller = {
  callContract(call: MarketplaceAccountCall): Promise<unknown>;
};

export type MarketplaceWriteAdapterOptions = {
  marketplaceAddress?: string;
  contractCaller?: MarketplaceContractCaller | null;
};

export type ListCallInput = {
  collection: string;
  tokenId: string;
  quantity: string;
  price: string;
  currency: string;
  expiration: string;
  royalties: boolean;
};

export type OfferCallInput = Omit<ListCallInput, "royalties">;

export type ExecuteCallInput = {
  orderId: string;
  collection: string;
  tokenId: string;
  assetId: string;
  quantity: string;
  royalties: boolean;
  clientFee: string;
  clientReceiver: string;
};

const U128_MASK = (BigInt(1) << BigInt(128)) - BigInt(1);

export function toUint256Calldata(value: bigint | string): [string, string] {
  const parsed = BigInt(value);
  if (parsed < BigInt(0)) {
    throw new Error("u256 calldata cannot encode a negative value.");
  }
  return [
    (parsed & U128_MASK).toString(),
    (parsed >> BigInt(128)).toString(),
  ];
}

function booleanLike(value: unknown): boolean | null {
  if (typeof value === "boolean") return value;
  if (typeof value === "number" || typeof value === "bigint") {
    if (value === 0 || value === BigInt(0)) return false;
    if (value === 1 || value === BigInt(1)) return true;
    return null;
  }
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["0", "0x0", "false"].includes(normalized)) return false;
    if (["1", "0x1", "true"].includes(normalized)) return true;
    return null;
  }
  if (Array.isArray(value)) return value.length > 0 ? booleanLike(value[0]) : null;
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  for (const key of ["valid", "isValid", "is_valid", "value", "result", "0"]) {
    const parsed = booleanLike(record[key]);
    if (parsed !== null) return parsed;
  }
  return null;
}

function resultValues(value: unknown): readonly unknown[] {
  if (Array.isArray(value)) return value;
  if (!value || typeof value !== "object") return [];
  const record = value as Record<string, unknown>;
  for (const key of ["result", "values", "calldata"]) {
    if (Array.isArray(record[key])) return record[key];
  }
  return [];
}

function feltEqual(left: unknown, right: unknown): boolean {
  try {
    return BigInt(String(left)) === BigInt(String(right));
  } catch {
    return String(left).trim().toLowerCase() === String(right).trim().toLowerCase();
  }
}

function assertSdkBuilderCall(value: unknown, entrypoint: string): void {
  if (!value || typeof value !== "object") {
    throw new Error(`Arcade ${entrypoint} calldata builder returned no call.`);
  }
  const record = value as Record<string, unknown>;
  if (record.entrypoint !== entrypoint || record.contractName !== "Marketplace") {
    throw new Error(`Arcade ${entrypoint} calldata builder returned an unexpected target.`);
  }
}

export function createMarketplaceWriteAdapter(
  chainId: string,
  options: MarketplaceWriteAdapterOptions = {},
) {
  const provider = new ArcadeProvider(
    chainId as ConstructorParameters<typeof ArcadeProvider>[0],
  );

  const marketplaceAddress = () => {
    const value = options.marketplaceAddress?.trim();
    if (!value) throw new Error("Marketplace contract address is unavailable.");
    return value;
  };

  const callContract = async (call: MarketplaceAccountCall): Promise<readonly unknown[]> => {
    if (!options.contractCaller?.callContract) {
      throw new Error("A direct Starknet contract caller is required for write preflight.");
    }
    return resultValues(await options.contractCaller.callContract(call));
  };

  const isTokenOwner = async (
    collection: string,
    tokenId: string,
    expectedOwner: string,
  ): Promise<boolean> => {
    try {
      const owner = await callContract({
        contractAddress: collection,
        entrypoint: "owner_of",
        calldata: toUint256Calldata(tokenId),
      });
      return owner.length > 0 && feltEqual(owner[0], expectedOwner);
    } catch {
      return false;
    }
  };

  const isTokenApproved = async (
    collection: string,
    tokenId: string,
    owner: string,
  ): Promise<boolean> => {
    try {
      const approvedForAll = await callContract({
        contractAddress: collection,
        entrypoint: "is_approved_for_all",
        calldata: [owner, marketplaceAddress()],
      });
      if (booleanLike(approvedForAll) === true) return true;
    } catch {
      // Some ERC721 implementations expose only token-specific approval.
    }

    try {
      const approved = await callContract({
        contractAddress: collection,
        entrypoint: "get_approved",
        calldata: toUint256Calldata(tokenId),
      });
      return approved.length > 0 && feltEqual(approved[0], marketplaceAddress());
    } catch {
      return false;
    }
  };

  const getAllowance = async (
    currency: string,
    owner: string,
  ): Promise<bigint> => {
    try {
      const allowance = await callContract({
        contractAddress: currency,
        entrypoint: "allowance",
        calldata: [owner, marketplaceAddress()],
      });
      if (allowance.length === 0) return BigInt(0);
      const low = BigInt(String(allowance[0]));
      const high = allowance.length > 1 ? BigInt(String(allowance[1])) : BigInt(0);
      return low + (high << BigInt(128));
    } catch {
      return BigInt(0);
    }
  };

  const adapter = {
    async isOrderValid(key: MarketplaceOrderKey): Promise<boolean> {
      try {
        return booleanLike(await provider.marketplace.getValidity(
          key.id,
          key.collection,
          key.tokenId,
        )) === true;
      } catch {
        return false;
      }
    },

    isTokenOwner,
    isTokenApproved,
    getAllowance,

    async isSellOrderExecutable(input: {
      key: MarketplaceOrderKey;
      owner: string;
    }): Promise<boolean> {
      const [valid, ownsToken, approved] = await Promise.all([
        adapter.isOrderValid(input.key),
        isTokenOwner(input.key.collection, input.key.tokenId, input.owner),
        isTokenApproved(input.key.collection, input.key.tokenId, input.owner),
      ]);
      return valid && ownsToken && approved;
    },

    buildCancelCall(key: MarketplaceOrderKey): MarketplaceAccountCall {
      assertSdkBuilderCall(
        provider.marketplace.buildCancelCalldata(key.id, key.collection, key.tokenId),
        "cancel",
      );
      return {
        contractAddress: marketplaceAddress(),
        entrypoint: "cancel",
        calldata: [key.id, key.collection, ...toUint256Calldata(key.tokenId)],
      };
    },

    buildListCall(input: ListCallInput): MarketplaceAccountCall {
      assertSdkBuilderCall(provider.marketplace.buildListCalldata(
        input.collection,
        input.tokenId,
        input.quantity,
        input.price,
        input.currency,
        input.expiration,
        input.royalties,
      ), "list");
      return {
        contractAddress: marketplaceAddress(),
        entrypoint: "list",
        calldata: [
          input.collection,
          ...toUint256Calldata(input.tokenId),
          input.quantity,
          input.price,
          input.currency,
          input.expiration,
          input.royalties ? "1" : "0",
        ],
      };
    },

    buildOfferCall(input: OfferCallInput): MarketplaceAccountCall {
      assertSdkBuilderCall(provider.marketplace.buildOfferCalldata(
        input.collection,
        input.tokenId,
        input.quantity,
        input.price,
        input.currency,
        input.expiration,
      ), "offer");
      return {
        contractAddress: marketplaceAddress(),
        entrypoint: "offer",
        calldata: [
          input.collection,
          ...toUint256Calldata(input.tokenId),
          input.quantity,
          input.price,
          input.currency,
          input.expiration,
        ],
      };
    },

    buildExecuteCall(input: ExecuteCallInput): MarketplaceAccountCall {
      assertSdkBuilderCall(provider.marketplace.buildExecuteCalldata(
        input.orderId,
        input.collection,
        input.tokenId,
        input.assetId,
        input.quantity,
        input.royalties,
        input.clientFee,
        input.clientReceiver,
      ), "execute");
      return {
        contractAddress: marketplaceAddress(),
        entrypoint: "execute",
        calldata: [
          input.orderId,
          input.collection,
          ...toUint256Calldata(input.tokenId),
          ...toUint256Calldata(input.assetId),
          input.quantity,
          input.royalties ? "1" : "0",
          input.clientFee,
          input.clientReceiver,
        ],
      };
    },

    buildSetApprovalForAllCall(collection: string): MarketplaceAccountCall {
      return {
        contractAddress: collection,
        entrypoint: "set_approval_for_all",
        calldata: [marketplaceAddress(), "1"],
      };
    },

    buildErc20ApprovalCall(currency: string, amount: bigint): MarketplaceAccountCall {
      return {
        contractAddress: currency,
        entrypoint: "approve",
        calldata: [marketplaceAddress(), ...toUint256Calldata(amount)],
      };
    },
  };

  return adapter;
}
