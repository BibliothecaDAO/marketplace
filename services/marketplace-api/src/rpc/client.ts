import {
  canonicalFelt,
  type MarketplaceChainAlias,
} from "@biblio/marketplace-registry";

type RpcProviders = Record<MarketplaceChainAlias, readonly [string, string]>;

export type StarknetRpcClientOptions = {
  providers: RpcProviders;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
};

export class RpcClientError extends Error {
  constructor(
    message: string,
    readonly retryable: boolean,
    readonly provider: string,
    readonly rpcCode: number | null = null,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "RpcClientError";
  }
}

type JsonRpcResponse<T> = {
  result?: T;
  error?: { code: number; message: string; data?: unknown };
};

function transientHttpStatus(status: number): boolean {
  return status === 408 || status === 425 || status === 429 || status >= 500;
}

function transientRpcCode(code: number): boolean {
  return code === -32005 || code === -32010 || code === -32099;
}

export class StarknetRpcClient {
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;

  constructor(private readonly options: StarknetRpcClientOptions) {
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.timeoutMs = options.timeoutMs ?? 2_000;
  }

  async getHead(chain: MarketplaceChainAlias): Promise<{
    blockNumber: number;
    blockHash: string;
  }> {
    const block = await this.call<{ block_number: number; block_hash: string }>(
      chain,
      "starknet_getBlockWithTxHashes",
      { block_id: "latest" },
    );
    return {
      blockNumber: block.block_number,
      blockHash: canonicalFelt(block.block_hash),
    };
  }

  async getBlockHash(
    chain: MarketplaceChainAlias,
    blockNumber: number,
  ): Promise<string> {
    const block = await this.call<{ block_hash: string }>(
      chain,
      "starknet_getBlockWithTxHashes",
      { block_id: { block_number: blockNumber } },
    );
    return canonicalFelt(block.block_hash);
  }

  async call<T>(
    chain: MarketplaceChainAlias,
    method: string,
    params: unknown,
  ): Promise<T> {
    let lastError: RpcClientError | null = null;
    for (const provider of this.options.providers[chain]) {
      try {
        return await this.callProvider<T>(provider, method, params);
      } catch (error) {
        const rpcError =
          error instanceof RpcClientError
            ? error
            : new RpcClientError("RPC connection failed.", true, provider, null, {
                cause: error,
              });
        lastError = rpcError;
        if (!rpcError.retryable) throw rpcError;
      }
    }
    throw lastError ?? new RpcClientError("No RPC providers configured.", false, "none");
  }

  private async callProvider<T>(
    provider: string,
    method: string,
    params: unknown,
  ): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await this.fetchImpl(provider, {
        method: "POST",
        headers: { accept: "application/json", "content-type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
        signal: controller.signal,
      });
      if (!response.ok) {
        throw new RpcClientError(
          `RPC provider returned HTTP ${response.status}.`,
          transientHttpStatus(response.status),
          provider,
        );
      }
      const payload = (await response.json()) as JsonRpcResponse<T>;
      if (payload.error) {
        throw new RpcClientError(
          `RPC ${payload.error.code}: ${payload.error.message}`,
          transientRpcCode(payload.error.code),
          provider,
          payload.error.code,
        );
      }
      if (payload.result === undefined) {
        throw new RpcClientError("RPC provider omitted the result.", false, provider);
      }
      return payload.result;
    } catch (error) {
      if (error instanceof RpcClientError) throw error;
      throw new RpcClientError(
        controller.signal.aborted ? "RPC request timed out." : "RPC connection failed.",
        true,
        provider,
        null,
        { cause: error },
      );
    } finally {
      clearTimeout(timeout);
    }
  }
}
