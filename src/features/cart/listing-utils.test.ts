import { describe, expect, it } from "vitest";
import { cheapestListingByTokenId } from "@/features/cart/listing-utils";

describe("listing utils", () => {
  it("normalizes_snake_case_listings_for_cart_selection", () => {
    const listings = [
      {
        order_id: "11",
        token_id: "0x1",
        price: "200",
        quantity: "1",
        currency: "0xfee",
      },
      {
        order_id: "12",
        token_id: "0x1",
        price: "120",
        quantity: "1",
        currency: "0xfee",
      },
    ];

    const result = cheapestListingByTokenId(listings);

    expect(result.get("1")).toMatchObject({
      orderId: "12",
      tokenId: "1",
      price: "120",
      currency: "0xfee",
      quantity: "1",
    });
  });

  it("ignores_expired_listings_when_selecting_cheapest", () => {
    const now = Math.floor(Date.now() / 1000);
    const listings = [
      {
        order_id: "11",
        token_id: "0x1",
        price: "80",
        quantity: "1",
        currency: "0xfee",
        expiration: now - 60,
      },
      {
        order_id: "12",
        token_id: "0x1",
        price: "120",
        quantity: "1",
        currency: "0xfee",
        expiration: now + 3600,
      },
    ];

    const result = cheapestListingByTokenId(listings);

    expect(result.get("1")).toMatchObject({
      orderId: "12",
      tokenId: "1",
      price: "120",
      currency: "0xfee",
      quantity: "1",
    });
  });
});
