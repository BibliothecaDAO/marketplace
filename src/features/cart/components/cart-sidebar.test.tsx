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
});
