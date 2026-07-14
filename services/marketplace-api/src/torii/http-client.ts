import {
  canonicalFelt,
  type MarketplaceChainAlias,
} from "@biblio/marketplace-registry";

type ToriiEndpoints = Record<MarketplaceChainAlias, string>;

export type HttpToriiClientOptions = {
  endpoints: ToriiEndpoints;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  retryDelayMs?: number;
  maxResponseBytes?: number;
  maxAssetBytes?: number;
};

export type ToriiAsset = {
  status: 200 | 304 | 404;
  body: Uint8Array;
  contentType: string | null;
  etag: string | null;
  lastModified: string | null;
};

export class ToriiQueryError extends Error {
  constructor(
    message: string,
    readonly statusCode: number | null,
    readonly retryable: boolean,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "ToriiQueryError";
  }
}

function isTransientStatus(status: number): boolean {
  return status === 408 || status === 425 || status === 429 ||
    (status >= 500 && status < 600);
}

function delay(milliseconds: number): Promise<void> {
  if (milliseconds <= 0) return Promise.resolve();
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

export class HttpToriiClient {
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;
  private readonly retryDelayMs: number;
  private readonly maxResponseBytes: number;
  private readonly maxAssetBytes: number;

  constructor(private readonly options: HttpToriiClientOptions) {
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.timeoutMs = options.timeoutMs ?? 2_000;
    this.retryDelayMs = options.retryDelayMs ?? 50;
    this.maxResponseBytes = options.maxResponseBytes ?? 10 * 1024 * 1024;
    this.maxAssetBytes = options.maxAssetBytes ?? 15 * 1024 * 1024;
  }

  async getImage(
    chain: MarketplaceChainAlias,
    rawCollection: string,
    rawTokenId: string | null,
    conditional: { etag?: string; modifiedSince?: string } = {},
  ): Promise<ToriiAsset> {
    let lastError: ToriiQueryError | null = null;

    for (let attempt = 0; attempt < 2; attempt += 1) {
      if (attempt > 0) await delay(this.retryDelayMs);
      try {
        return await this.getImageOnce(
          chain,
          rawCollection,
          rawTokenId,
          conditional,
        );
      } catch (error) {
        const assetError = error instanceof ToriiQueryError
          ? error
          : new ToriiQueryError("Torii asset request failed.", null, true, {
              cause: error,
            });
        lastError = assetError;
        if (!assetError.retryable) throw assetError;
      }
    }

    throw lastError ?? new ToriiQueryError("Torii asset request failed.", null, true);
  }

  private async getImageOnce(
    chain: MarketplaceChainAlias,
    rawCollection: string,
    rawTokenId: string | null,
    conditional: { etag?: string; modifiedSince?: string },
  ): Promise<ToriiAsset> {
    const collection = canonicalFelt(rawCollection);
    const tokenPath = rawTokenId === null
      ? ""
      : `/0x${BigInt(rawTokenId).toString(16).padStart(64, "0")}`;
    const endpoint = this.options.endpoints[chain].replace(/\/$/, "");
    const url = `${endpoint}/static/${collection}${tokenPath}/image`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await this.fetchImpl(url, {
        headers: {
          accept: "image/png,image/jpeg,image/webp,image/gif,image/svg+xml",
          ...(conditional.etag ? { "if-none-match": conditional.etag } : {}),
          ...(conditional.modifiedSince
            ? { "if-modified-since": conditional.modifiedSince }
            : {}),
        },
        signal: controller.signal,
      });
      if (response.status === 304 || response.status === 404) {
        return {
          status: response.status,
          body: new Uint8Array(),
          contentType: null,
          etag: response.headers.get("etag"),
          lastModified: response.headers.get("last-modified"),
        };
      }
      if (!response.ok) {
        throw new ToriiQueryError(
          `Torii asset request failed with HTTP ${response.status}.`,
          response.status,
          isTransientStatus(response.status),
        );
      }
      const contentType = response.headers.get("content-type")
        ?.split(";", 1)[0]
        ?.trim()
        .toLowerCase() ?? "";
      const supported = new Set([
        "image/png",
        "image/jpeg",
        "image/webp",
        "image/gif",
        "image/svg+xml",
      ]);
      if (!supported.has(contentType)) {
        throw new ToriiQueryError(
          `Torii returned unsupported image content type ${JSON.stringify(contentType)}.`,
          502,
          false,
        );
      }
      const contentLength = Number(response.headers.get("content-length") ?? 0);
      if (contentLength > this.maxAssetBytes) {
        throw new ToriiQueryError("Torii asset exceeded the size limit.", 502, false);
      }
      const chunks: Uint8Array[] = [];
      let size = 0;
      if (response.body) {
        const reader = response.body.getReader();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          size += value.byteLength;
          if (size > this.maxAssetBytes) {
            await reader.cancel();
            throw new ToriiQueryError("Torii asset exceeded the size limit.", 502, false);
          }
          chunks.push(value);
        }
      }
      const body = new Uint8Array(size);
      let offset = 0;
      for (const chunk of chunks) {
        body.set(chunk, offset);
        offset += chunk.byteLength;
      }
      return {
        status: 200,
        body,
        contentType,
        etag: response.headers.get("etag"),
        lastModified: response.headers.get("last-modified"),
      };
    } catch (error) {
      if (error instanceof ToriiQueryError) throw error;
      throw new ToriiQueryError(
        controller.signal.aborted
          ? "Torii asset request timed out."
          : "Torii asset connection failed.",
        controller.signal.aborted ? 504 : null,
        true,
        { cause: error },
      );
    } finally {
      clearTimeout(timeout);
    }
  }

  async query<T>(chain: MarketplaceChainAlias, sql: string): Promise<T[]> {
    let lastError: ToriiQueryError | null = null;

    for (let attempt = 0; attempt < 2; attempt += 1) {
      if (attempt > 0) await delay(this.retryDelayMs);
      try {
        return await this.queryOnce<T>(chain, sql);
      } catch (error) {
        const queryError =
          error instanceof ToriiQueryError
            ? error
            : new ToriiQueryError("Torii request failed.", null, true, {
                cause: error,
              });
        lastError = queryError;
        if (!queryError.retryable) throw queryError;
      }
    }

    throw lastError ?? new ToriiQueryError("Torii request failed.", null, true);
  }

  private async queryOnce<T>(
    chain: MarketplaceChainAlias,
    sql: string,
  ): Promise<T[]> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const endpoint = this.options.endpoints[chain].replace(/\/$/, "");
      const response = await this.fetchImpl(`${endpoint}/sql`, {
        method: "POST",
        headers: {
          accept: "application/json",
          "content-type": "application/json",
        },
        body: sql,
        signal: controller.signal,
      });
      if (!response.ok) {
        throw new ToriiQueryError(
          `Torii query failed with HTTP ${response.status}.`,
          response.status,
          isTransientStatus(response.status),
        );
      }

      const contentLength = Number(response.headers.get("content-length") ?? 0);
      if (contentLength > this.maxResponseBytes) {
        throw new ToriiQueryError("Torii response exceeded the size limit.", 502, false);
      }
      const text = await response.text();
      if (Buffer.byteLength(text, "utf8") > this.maxResponseBytes) {
        throw new ToriiQueryError("Torii response exceeded the size limit.", 502, false);
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(text);
      } catch (error) {
        throw new ToriiQueryError("Torii returned invalid JSON.", 502, false, {
          cause: error,
        });
      }

      const rows = Array.isArray(parsed)
        ? parsed
        : parsed && typeof parsed === "object" && Array.isArray((parsed as { data?: unknown }).data)
          ? (parsed as { data: unknown[] }).data
          : null;
      if (!rows) {
        throw new ToriiQueryError("Torii returned an invalid row payload.", 502, false);
      }
      return rows as T[];
    } catch (error) {
      if (error instanceof ToriiQueryError) throw error;
      const timedOut = controller.signal.aborted;
      throw new ToriiQueryError(
        timedOut ? "Torii query timed out." : "Torii connection failed.",
        timedOut ? 504 : null,
        true,
        { cause: error },
      );
    } finally {
      clearTimeout(timeout);
    }
  }
}
