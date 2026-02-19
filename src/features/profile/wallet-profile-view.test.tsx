import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockUseWalletPortfolioQuery } = vi.hoisted(() => ({
  mockUseWalletPortfolioQuery: vi.fn(),
}));

vi.mock("@/lib/marketplace/hooks", () => ({
  useWalletPortfolioQuery: mockUseWalletPortfolioQuery,
}));

import { WalletProfileView } from "@/features/profile/wallet-profile-view";

describe("WalletProfileView", () => {
  beforeEach(() => {
    mockUseWalletPortfolioQuery.mockReset();
    mockUseWalletPortfolioQuery.mockReturnValue({
      data: { page: { balances: [] } },
      status: "ready",
      error: null,
      isFetching: false,
      refresh: vi.fn(),
    });
  });

  it("shows_loading_state", () => {
    mockUseWalletPortfolioQuery.mockReturnValue({
      data: undefined,
      status: "loading",
      error: null,
      isFetching: true,
      refresh: vi.fn(),
    });

    render(<WalletProfileView address="0xabc123" />);

    expect(screen.getByText(/loading wallet items/i)).toBeVisible();
  });

  it("shows_empty_state_when_wallet_has_no_items", () => {
    render(<WalletProfileView address="0xabc123" />);

    expect(screen.getByText(/no items found for this wallet/i)).toBeVisible();
  });

  it("shows_owned_items_with_links_and_filters_zero_balances", () => {
    mockUseWalletPortfolioQuery.mockReturnValue({
      data: {
        page: {
          balances: [
            {
              contract_address: "0xcol1",
              token_id: "7",
              balance: "2",
            },
            {
              contract_address: "0xcol2",
              token_id: "9",
              balance: "0",
            },
          ],
        },
      },
      status: "ready",
      error: null,
      isFetching: false,
      refresh: vi.fn(),
    });

    render(<WalletProfileView address="0xabc123" />);

    expect(screen.getByText("0xcol1")).toBeVisible();
    expect(screen.getByText("#7")).toBeVisible();
    expect(screen.getByText("x2")).toBeVisible();
    const itemLink = screen.getByRole("link", { name: /view token 7/i });
    expect(itemLink).toHaveAttribute("href", "/collections/0xcol1/7");
    expect(
      screen.getByRole("textbox", { name: /filter collection or token/i }),
    ).toBeVisible();

    expect(screen.queryByText("0xcol2")).toBeNull();
  });

  it("filters_items_by_collection_or_token", async () => {
    const user = userEvent.setup();
    mockUseWalletPortfolioQuery.mockReturnValue({
      data: {
        page: {
          balances: [
            {
              contract_address: "0xcollection-a",
              token_id: "7",
              balance: "1",
            },
            {
              contract_address: "0xcollection-b",
              token_id: "99",
              balance: "1",
            },
          ],
        },
      },
      status: "ready",
      error: null,
      isFetching: false,
      refresh: vi.fn(),
    });

    render(<WalletProfileView address="0xabc123" />);

    await user.type(
      screen.getByRole("textbox", { name: /filter collection or token/i }),
      "99",
    );

    expect(screen.queryByText("0xcollection-a")).toBeNull();
    expect(screen.getByText("0xcollection-b")).toBeVisible();
  });
});
