import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/features/profile/wallet-profile-view", () => ({
  WalletProfileView: ({ address }: { address: string }) => (
    <div data-testid="wallet-profile-view">{address}</div>
  ),
}));

import { PortfolioView } from "@/features/portfolio/portfolio-view";

describe("PortfolioView", () => {
  it("renders_address_input_and_submit_action", () => {
    render(<PortfolioView />);

    expect(
      screen.getByRole("heading", { name: /portfolio/i }),
    ).toBeVisible();
    expect(
      screen.getByRole("textbox", { name: /wallet address/i }),
    ).toBeVisible();
    expect(
      screen.getByRole("button", { name: /load holdings/i }),
    ).toBeVisible();
  });

  it("shows_validation_error_for_invalid_address", async () => {
    const user = userEvent.setup();
    render(<PortfolioView />);

    await user.type(
      screen.getByRole("textbox", { name: /wallet address/i }),
      "not-an-address",
    );
    await user.click(screen.getByRole("button", { name: /load holdings/i }));

    expect(
      screen.getByText(/enter a valid wallet address/i),
    ).toBeVisible();
    expect(screen.queryByTestId("wallet-profile-view")).toBeNull();
  });

  it("loads_wallet_holdings_for_valid_address", async () => {
    const user = userEvent.setup();
    render(<PortfolioView />);

    await user.type(
      screen.getByRole("textbox", { name: /wallet address/i }),
      "0xabc123",
    );
    await user.click(screen.getByRole("button", { name: /load holdings/i }));

    expect(screen.getByTestId("wallet-profile-view")).toHaveTextContent(
      "0xabc123",
    );
  });
});
