import { describe, expect, it } from "vitest";
import {
  assertOwnedReadEnabled,
  isOwnedReadEnabled,
  MarketplaceReadRolloutError,
  parseMarketplaceReadRollout,
} from "@/lib/marketplace/rollout";

describe("marketplace read rollout", () => {
  it("enables every preceding stage cumulatively", () => {
    expect(isOwnedReadEnabled("portfolio", "browse")).toBe(true);
    expect(isOwnedReadEnabled("portfolio", "portfolio")).toBe(true);
    expect(isOwnedReadEnabled("portfolio", "orders")).toBe(false);
    expect(isOwnedReadEnabled("checkout", "orders")).toBe(true);
    expect(isOwnedReadEnabled("off", "browse")).toBe(false);
  });

  it("fails startup on any unrecognized value", () => {
    expect(parseMarketplaceReadRollout(undefined)).toBe("off");
    expect(parseMarketplaceReadRollout("checkout")).toBe("checkout");
    expect(() => parseMarketplaceReadRollout("everything")).toThrow(
      /MARKETPLACE_READ_ROLLOUT/,
    );
  });

  it("fails closed with a typed error when a surface has not reached rollout", () => {
    expect(() => assertOwnedReadEnabled("browse", "orders")).toThrow(
      MarketplaceReadRolloutError,
    );
    expect(() => assertOwnedReadEnabled("orders", "browse")).not.toThrow();
  });
});
