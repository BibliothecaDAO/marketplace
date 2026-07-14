import { describe, expect, it, vi } from "vitest";
import { waitForIndexedBlock } from "./index-confirmation";

describe("post-transaction index confirmation", () => {
  it("stops when the accepted index reaches the receipt block", async () => {
    const getIndexedBlock = vi.fn()
      .mockResolvedValueOnce(99)
      .mockResolvedValueOnce(100);
    await expect(waitForIndexedBlock({
      receiptBlock: 100,
      getIndexedBlock,
      timeoutMs: 100,
      pollIntervalMs: 1,
      sleep: async () => undefined,
    })).resolves.toEqual({ indexed: true, indexedBlock: 100 });
    expect(getIndexedBlock).toHaveBeenCalledTimes(2);
  });

  it("returns a non-failure indexing state after the bounded wait", async () => {
    let now = 0;
    await expect(waitForIndexedBlock({
      receiptBlock: 100,
      getIndexedBlock: async () => 98,
      timeoutMs: 60,
      pollIntervalMs: 20,
      now: () => now,
      sleep: async (duration) => { now += duration; },
    })).resolves.toEqual({ indexed: false, indexedBlock: 98 });
  });
});
