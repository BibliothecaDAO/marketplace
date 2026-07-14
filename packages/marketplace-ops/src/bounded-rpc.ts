import { createServer } from "node:http";
import { fileURLToPath } from "node:url";

export type JsonRpcRequest = {
  jsonrpc: "2.0";
  id?: unknown;
  method: string;
  params?: unknown;
};

function boundBlockReferences(value: unknown, checkpoint: number): unknown {
  if (value === "latest" || value === "pending" || value === "pre_confirmed") {
    return { block_number: checkpoint };
  }
  if (Array.isArray(value)) {
    return value.map((child) => boundBlockReferences(child, checkpoint));
  }
  if (value && typeof value === "object") {
    const entries = Object.entries(value).map(([key, child]) => {
      if (key === "block_number" && typeof child === "number" && child > checkpoint) {
        return [key, checkpoint];
      }
      return [key, boundBlockReferences(child, checkpoint)];
    });
    return Object.fromEntries(entries);
  }
  return value;
}

export function boundRpcRequest(
  request: JsonRpcRequest,
  checkpoint: number,
): {
  localResponse: Record<string, unknown> | null;
  forwardRequest: JsonRpcRequest | null;
} {
  if (request.method === "starknet_blockNumber") {
    return {
      localResponse: { jsonrpc: "2.0", id: request.id ?? null, result: checkpoint },
      forwardRequest: null,
    };
  }
  if (request.method === "starknet_syncing") {
    return {
      localResponse: { jsonrpc: "2.0", id: request.id ?? null, result: false },
      forwardRequest: null,
    };
  }
  return {
    localResponse: null,
    forwardRequest: {
      ...request,
      params: boundBlockReferences(request.params, checkpoint),
    },
  };
}

export async function serveBoundedRpc(options: {
  upstream: string;
  checkpoint: number;
  host?: string;
  port?: number;
  fetchImpl?: typeof fetch;
}) {
  if (!Number.isInteger(options.checkpoint) || options.checkpoint < 0) {
    throw new Error("RPC_CHECKPOINT_BLOCK must be a non-negative integer.");
  }
  const fetchImpl = options.fetchImpl ?? fetch;
  const server = createServer(async (request, response) => {
    if (request.method === "GET" && request.url === "/health") {
      response.writeHead(200, { "content-type": "application/json" });
      response.end('{"status":"ok"}');
      return;
    }
    if (request.method !== "POST" || request.url !== "/") {
      response.writeHead(404).end();
      return;
    }
    try {
      const chunks: Buffer[] = [];
      let bytes = 0;
      for await (const chunk of request) {
        const buffer = Buffer.from(chunk);
        bytes += buffer.byteLength;
        if (bytes > 10 * 1024 * 1024) throw new Error("RPC request exceeds 10 MiB.");
        chunks.push(buffer);
      }
      const payload = JSON.parse(Buffer.concat(chunks).toString("utf8")) as JsonRpcRequest;
      if (!payload || payload.jsonrpc !== "2.0" || typeof payload.method !== "string") {
        throw new Error("Invalid JSON-RPC request.");
      }
      const bounded = boundRpcRequest(payload, options.checkpoint);
      if (bounded.localResponse) {
        response.writeHead(200, { "content-type": "application/json" });
        response.end(JSON.stringify(bounded.localResponse));
        return;
      }
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30_000);
      try {
        const upstreamResponse = await fetchImpl(options.upstream, {
          method: "POST",
          headers: { accept: "application/json", "content-type": "application/json" },
          body: JSON.stringify(bounded.forwardRequest),
          signal: controller.signal,
        });
        const body = await upstreamResponse.arrayBuffer();
        response.writeHead(upstreamResponse.status, {
          "content-type": upstreamResponse.headers.get("content-type") ?? "application/json",
        });
        response.end(Buffer.from(body));
      } finally {
        clearTimeout(timeout);
      }
    } catch (error) {
      response.writeHead(502, { "content-type": "application/json" });
      response.end(
        JSON.stringify({
          jsonrpc: "2.0",
          id: null,
          error: {
            code: -32097,
            message: error instanceof Error ? error.message : "Bounded RPC failed.",
          },
        }),
      );
    }
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(options.port ?? 18_545, options.host ?? "127.0.0.1", resolve);
  });
  return server;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const upstream = process.env.UPSTREAM_RPC_URL?.trim();
  if (!upstream) throw new Error("UPSTREAM_RPC_URL is required.");
  const checkpoint = Number(process.env.RPC_CHECKPOINT_BLOCK);
  const server = await serveBoundedRpc({
    upstream,
    checkpoint,
    host: process.env.RPC_PROXY_HOST ?? "127.0.0.1",
    port: Number(process.env.RPC_PROXY_PORT ?? 18_545),
  });
  const shutdown = () => server.close();
  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);
}
