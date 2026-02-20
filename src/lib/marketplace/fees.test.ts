import { describe, expect, it } from "vitest";
import {
  calculateCartSummary,
  calculateMarketplaceFee,
  sumBigIntStrings,
} from "@/lib/marketplace/fees";

describe("marketplace fees", () => {
  it("sums_bigint_price_strings_safely", () => {
    expect(sumBigIntStrings(["100", "25", "invalid", "0x10"])).toBe(BigInt(141));
  });

  it("calculates_marketplace_fee_with_floor_division", () => {
    expect(
      calculateMarketplaceFee(BigInt(150), {
        feeNum: 250,
        feeDenominator: 10_000,
      }),
    ).toBe(BigInt(3));
  });

  it("builds_cart_summary_with_marketplace_and_royalty_totals", () => {
    const summary = calculateCartSummary({
      prices: ["100", "50"],
      marketplaceFeeConfig: {
        feeNum: 250,
        feeDenominator: 10_000,
      },
      royaltyEstimate: BigInt(8),
    });

    expect(summary.subtotal).toBe(BigInt(150));
    expect(summary.marketplaceFee).toBe(BigInt(3));
    expect(summary.royaltyEstimate).toBe(BigInt(8));
    expect(summary.total).toBe(BigInt(158));
  });
});
