import { describe, expect, it } from "vitest";
import {
  alternateTokenId,
  canonicalizeTokenId,
  expandTokenIdVariants,
  normalizeCollectionTokenId,
} from "@/lib/marketplace/token-id";

describe("token id helpers", () => {
  it("canonicalizes_decimal_hex_and_bare_hex_variants", () => {
    expect(canonicalizeTokenId("255")).toEqual({
      decimal: "255",
      hex: "0xff",
      value: BigInt(255),
    });
    expect(canonicalizeTokenId("0xff")).toEqual({
      decimal: "255",
      hex: "0xff",
      value: BigInt(255),
    });
    expect(canonicalizeTokenId("ff")).toEqual({
      decimal: "255",
      hex: "0xff",
      value: BigInt(255),
    });
  });

  it("expands_and_dedupes_to_stable_ordering", () => {
    expect(expandTokenIdVariants(["0x2", "1", "0x01", "2"])).toEqual([
      "1",
      "0x1",
      "2",
      "0x2",
    ]);
  });

  it("returns_alternate_representation_for_decimal_and_hex", () => {
    expect(alternateTokenId("42")).toBe("0x2a");
    expect(alternateTokenId("0x2a")).toBe("42");
  });

  it("normalizes_collection_scoped_token_ids", () => {
    expect(normalizeCollectionTokenId("0xabc:0x10")).toBe("16");
    expect(normalizeCollectionTokenId("0xabc:16")).toBe("16");
    expect(normalizeCollectionTokenId("16")).toBe("16");
  });
});
