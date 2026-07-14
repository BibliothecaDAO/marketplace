import { createServer } from "node:http";
import {
  ownedApiResponseHeaders,
  ownedMarketplaceApiResponse,
} from "./owned-marketplace-fixtures";

const port = Number(process.env.PORT ?? 3401);
const host = "127.0.0.1";

const server = createServer(async (request, response) => {
  if (request.method === "OPTIONS") {
    response.writeHead(204, ownedApiResponseHeaders());
    response.end();
    return;
  }

  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  let body: unknown;
  if (chunks.length > 0) {
    try {
      body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    } catch {
      response.writeHead(400, ownedApiResponseHeaders());
      response.end(JSON.stringify({
        error: {
          code: "INVALID_JSON",
          message: "Request body must be valid JSON.",
          requestId: "owned-e2e-request",
          retryable: false,
        },
      }));
      return;
    }
  }

  const result = ownedMarketplaceApiResponse({
    method: request.method ?? "GET",
    url: request.url ?? "/",
    body,
  });
  response.writeHead(result.status, ownedApiResponseHeaders());
  response.end(JSON.stringify(result.payload));
});

server.listen(port, host);

function close() {
  server.close(() => process.exit(0));
}

process.on("SIGINT", close);
process.on("SIGTERM", close);
