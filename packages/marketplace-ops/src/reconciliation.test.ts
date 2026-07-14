import { describe, expect, it } from "vitest";
import {
  canonicalReconciliationHash,
  compareReplayReports,
} from "./reconciliation.js";

describe("deterministic replay reconciliation", () => {
  it("hashes rows independently of object key and row order", () => {
    const left = { orders: [{ id: "2", owner: "b" }, { id: "1", owner: "a" }] };
    const right = { orders: [{ owner: "a", id: "1" }, { owner: "b", id: "2" }] };
    expect(canonicalReconciliationHash(left)).toBe(canonicalReconciliationHash(right));
  });

  it("requires order, Book, and complete replay hashes to match", () => {
    const report = {
      chain: "SN_MAIN" as const,
      checkpointBlock: 100,
      checkpointHash: "0xaa",
      orderHash: "sha256:orders",
      bookHash: "sha256:book",
      completeHash: "sha256:all",
      counts: { orders: 2, book: 1, tokens: 10, balances: 10, activity: 4 },
    };
    expect(compareReplayReports(report, { ...report })).toEqual({ matched: true, issues: [] });
    expect(
      compareReplayReports(report, { ...report, orderHash: "sha256:different" }),
    ).toEqual({ matched: false, issues: ["orderHash differs"] });
  });
});
