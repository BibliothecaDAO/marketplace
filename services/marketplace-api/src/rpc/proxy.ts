import Fastify, { type FastifyBaseLogger, type FastifyInstance } from "fastify";
import type { MarketplaceChainAlias } from "@biblio/marketplace-registry";

type RpcProxyProviders = Record<MarketplaceChainAlias, readonly string[]>;

export type RpcProxyOptions = {
  providers: RpcProxyProviders;
  fetch?: typeof globalThis.fetch;
  timeoutMs?: number;
  logger?: boolean | FastifyBaseLogger;
};

type JsonRpcRequest = {
  id?: unknown;
  jsonrpc?: unknown;
  method?: unknown;
  params?: unknown;
};

function isTransientStatus(status: number): boolean {
  return status === 408 || status === 425 || status === 429 || status >= 500;
}

function unavailable(id: unknown) {
  return {
    jsonrpc: "2.0",
    id: id ?? null,
    error: {
      code: -32098,
      message: "All qualified RPC providers are unavailable.",
    },
  };
}

export async function buildRpcProxy(
  options: RpcProxyOptions,
): Promise<FastifyInstance> {
  const app = Fastify({
    logger: options.logger ?? false,
    bodyLimit: 10 * 1024 * 1024,
    requestIdHeader: "x-request-id",
  });
  const fetchImpl = options.fetch ?? globalThis.fetch;
  const timeoutMs = options.timeoutMs ?? 5_000;

  app.post<{ Params: { chain: MarketplaceChainAlias }; Body: JsonRpcRequest }>(
    "/:chain",
    async (request, reply) => {
      const providers = options.providers[request.params.chain];
      if (!providers) {
        return reply.code(404).send(unavailable(request.body?.id));
      }

      const body = JSON.stringify(request.body);
      for (const provider of providers) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), timeoutMs);
        try {
          const response = await fetchImpl(provider, {
            method: "POST",
            headers: {
              accept: "application/json",
              "content-type": "application/json",
              "x-request-id": request.id,
            },
            body,
            signal: controller.signal,
          });
          const responseBody = await response.text();
          if (isTransientStatus(response.status)) continue;

          reply.code(response.status);
          reply.header(
            "content-type",
            response.headers.get("content-type") ?? "application/json; charset=utf-8",
          );
          return reply.send(responseBody);
        } catch (error) {
          request.log.warn(
            {
              error: error instanceof Error ? error.message : String(error),
              chain: request.params.chain,
            },
            "RPC provider transport failure",
          );
        } finally {
          clearTimeout(timeout);
        }
      }

      return reply.code(503).send(unavailable(request.body?.id));
    },
  );

  return app;
}
