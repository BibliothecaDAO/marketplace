import { describe, expect, it } from "vitest";
import { boundRpcRequest } from "./bounded-rpc.js";

describe("bounded replay RPC", () => {
  it("answers the head locally at the immutable checkpoint", () => {
    expect(
      boundRpcRequest(
        { jsonrpc: "2.0", id: 7, method: "starknet_blockNumber", params: [] },
        100,
      ),
    ).toEqual({
      localResponse: { jsonrpc: "2.0", id: 7, result: 100 },
      forwardRequest: null,
    });
  });

  it("rewrites latest and out-of-bounds block IDs before forwarding", () => {
    expect(
      boundRpcRequest(
        {
          jsonrpc: "2.0",
          id: 8,
          method: "starknet_getEvents",
          params: [
            {
              from_block: { block_number: 20 },
              to_block: "latest",
              nested: { block_id: { block_number: 101 } },
            },
          ],
        },
        100,
      ).forwardRequest,
    ).toEqual({
      jsonrpc: "2.0",
      id: 8,
      method: "starknet_getEvents",
      params: [
        {
          from_block: { block_number: 20 },
          to_block: { block_number: 100 },
          nested: { block_id: { block_number: 100 } },
        },
      ],
    });
  });
});
