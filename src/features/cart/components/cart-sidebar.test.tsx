import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import { CartSidebar } from "@/features/cart/components/cart-sidebar";
import { useCartStore } from "@/features/cart/store/cart-store";

function seedCart() {
  useCartStore.setState({
    items: [
      {
        orderId: "7001",
        collection: "0xabc",
        tokenId: "1",
        price: "100",
        currency: "0xfee",
        quantity: "1",
        tokenName: "Token #1",
      },
    ],
    inlineErrors: {
      "7001": "Listing is stale.",
    },
    isOpen: false,
    lastActionError: null,
  });
}

describe("cart sidebar", () => {
  beforeEach(() => {
    localStorage.clear();
    useCartStore.setState({ items: [], inlineErrors: {}, isOpen: false, lastActionError: null });
  });

  it("shows_trigger_count_in_header", () => {
    seedCart();

    render(<CartSidebar />);

    expect(screen.getByRole("button", { name: /cart \(1\)/i })).toBeVisible();
  });

  it("header_cart_trigger_opens_top_right_sidebar", async () => {
    seedCart();
    const user = userEvent.setup();

    render(<CartSidebar />);

    await user.click(screen.getByRole("button", { name: /cart \(1\)/i }));

    expect(await screen.findByRole("heading", { name: /cart/i })).toBeVisible();
    expect(screen.getByText("Token #1")).toBeVisible();
  });

  it("cart_sidebar_renders_inline_item_errors", async () => {
    seedCart();
    const user = userEvent.setup();

    render(<CartSidebar />);
    await user.click(screen.getByRole("button", { name: /cart \(1\)/i }));

    expect(await screen.findByText("Listing is stale.")).toBeVisible();
  });

  it("formats_wei_prices_for_items_and_totals", async () => {
    const user = userEvent.setup();
    useCartStore.setState({
      items: [
        {
          orderId: "9001",
          collection: "0xabc",
          tokenId: "1",
          price: "1000000000000000000",
          currency: "0xfee",
          quantity: "1",
          tokenName: "Token #1",
        },
        {
          orderId: "9002",
          collection: "0xabc",
          tokenId: "2",
          price: "500000000000000000",
          currency: "0xfee",
          quantity: "1",
          tokenName: "Token #2",
        },
      ],
      inlineErrors: {},
      isOpen: false,
      lastActionError: null,
    });

    render(<CartSidebar />);
    await user.click(screen.getByRole("button", { name: /cart \(2\)/i }));

    expect(await screen.findByText("1 0xfee")).toBeVisible();
    expect(screen.getByText("0.5 0xfee")).toBeVisible();
    expect(screen.getAllByText("1.5")).toHaveLength(2);
    expect(screen.queryByText("1000000000000000000 0xfee")).toBeNull();
  });
});
