import { describe, expect, it } from "vitest";
import { CursorError, decodeCursor, encodeCursor } from "./cursor.js";

describe("API cursors", () => {
  it("round-trips versioned keyset values without exposing an offset contract", () => {
    const cursor = encodeCursor("orders", {
      orderId: "2312",
      collection: `0x${"a".padStart(64, "0")}`,
      tokenId: "42",
    });

    expect(cursor).not.toContain("2312");
    expect(decodeCursor(cursor, "orders")).toEqual({
      orderId: "2312",
      collection: `0x${"a".padStart(64, "0")}`,
      tokenId: "42",
    });
  });

  it("rejects cursors issued for another query shape", () => {
    const cursor = encodeCursor("tokens", { tokenId: "42" });

    expect(() => decodeCursor(cursor, "orders")).toThrow(CursorError);
  });
});
