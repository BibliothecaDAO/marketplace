import type { MarketplaceChainAlias } from "@biblio/marketplace-registry";

type ToriiEndpoints = Record<MarketplaceChainAlias, string>;

export type HttpToriiClientOptions = {
  endpoints: ToriiEndpoints;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  retryDelayMs?: number;
  maxResponseBytes?: number;
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
  return status === 408 || status === 425 || status === 429 || status >= 500;
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

  constructor(private readonly options: HttpToriiClientOptions) {
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.timeoutMs = options.timeoutMs ?? 2_000;
    this.retryDelayMs = options.retryDelayMs ?? 50;
    this.maxResponseBytes = options.maxResponseBytes ?? 10 * 1024 * 1024;
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
