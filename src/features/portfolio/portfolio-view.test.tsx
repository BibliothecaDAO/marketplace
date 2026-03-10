import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/features/profile/wallet-profile-view", () => ({
  WalletProfileView: ({ address }: { address: string }) => (
    <div data-testid="wallet-profile-view">{address}</div>
  ),
}));

const { mockUseAccount } = vi.hoisted(() => ({
  mockUseAccount: vi.fn(),
}));
const { mockPush, mockUsePathname } = vi.hoisted(() => ({
  mockPush: vi.fn(),
  mockUsePathname: vi.fn(),
}));

vi.mock("@starknet-react/core", () => ({
  useAccount: mockUseAccount,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
  }),
  usePathname: mockUsePathname,
}));

import { PortfolioView } from "@/features/portfolio/portfolio-view";

describe("PortfolioView", () => {
  beforeEach(() => {
    mockUseAccount.mockReturnValue({ isConnected: false, address: undefined });
    mockPush.mockReset();
    mockUsePathname.mockReset();
    mockUsePathname.mockReturnValue("/portfolio");
  });

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
    expect(mockPush).toHaveBeenCalledWith("/portfolio?address=0xabc123");
  });

  it("pre_populates_and_auto_fetches_when_wallet_connected", () => {
    mockUseAccount.mockReturnValue({
      isConnected: true,
      address: "0xmywalletaddress",
    });

    render(<PortfolioView />);

    expect(screen.getByRole("textbox", { name: /wallet address/i })).toHaveValue(
      "0xmywalletaddress",
    );
    // Holdings should be shown without pressing Load holdings
    expect(screen.getByTestId("wallet-profile-view")).toHaveTextContent(
      "0xmywalletaddress",
    );
  });
});
