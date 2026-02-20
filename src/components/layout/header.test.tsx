import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Header } from "./header";

const { mockUseAccount, mockUseConnect, mockUseDisconnect, mockConnect, mockDisconnect } =
  vi.hoisted(() => ({
    mockUseAccount: vi.fn(),
    mockUseConnect: vi.fn(),
    mockUseDisconnect: vi.fn(),
    mockConnect: vi.fn(),
    mockDisconnect: vi.fn(),
  }));

vi.mock("@starknet-react/core", () => ({
  useAccount: mockUseAccount,
  useConnect: mockUseConnect,
  useDisconnect: mockUseDisconnect,
}));

vi.mock("@/features/cart/components/cart-sidebar", () => ({
  CartSidebar: () => <button type="button">Cart (0)</button>,
}));

describe("Header", () => {
  beforeEach(() => {
    mockConnect.mockReset();
    mockDisconnect.mockReset();

    mockUseAccount.mockReturnValue({
      status: "disconnected",
      isConnected: false,
      isDisconnected: true,
      address: undefined,
    });
    mockUseConnect.mockReturnValue({
      connect: mockConnect,
      connectors: [{ id: "controller", name: "Controller" }],
      pendingConnector: undefined,
      isPending: false,
    });
    mockUseDisconnect.mockReturnValue({
      disconnect: mockDisconnect,
      isPending: false,
    });
  });

  it("renders_logo_placeholder", () => {
    render(<Header />);

    const logo = screen.getByTestId("logo-placeholder");
    expect(logo).toBeVisible();
  });

  it("renders_app_name", () => {
    render(<Header />);

    expect(screen.getByText("Realms.market")).toBeVisible();
  });

  it("header_is_a_nav_landmark", () => {
    render(<Header />);

    const header = screen.getByRole("banner");
    expect(header).toBeVisible();
  });

  it("links_logo_to_home", () => {
    render(<Header />);

    const homeLink = screen.getByRole("link", { name: /realms\.market home/i });
    expect(homeLink).toBeVisible();
    expect(homeLink).toHaveAttribute("href", "/");
  });

  it("renders_nav_links", () => {
    render(<Header />);

    const stakingLinks = screen.getAllByRole("link", { name: /staking/i });
    expect(stakingLinks.length).toBeGreaterThan(0);
    expect(stakingLinks[0]).toHaveAttribute("href", "https://account.realms.world");

    const ecosystemLinks = screen.getAllByRole("link", { name: /ecosystem/i });
    expect(ecosystemLinks.length).toBeGreaterThan(0);
    expect(ecosystemLinks[0]).toHaveAttribute("href", "https://realms.world");

    const eternumLinks = screen.getAllByRole("link", { name: /eternum/i });
    expect(eternumLinks.length).toBeGreaterThan(0);
    expect(eternumLinks[0]).toHaveAttribute("href", "https://blitz.realms.world");
  });

  it("renders_social_icon_links", () => {
    render(<Header />);

    const twitterLinks = screen.getAllByRole("link", { name: /twitter/i });
    expect(twitterLinks.length).toBeGreaterThan(0);
    expect(twitterLinks[0]).toHaveAttribute("href", "https://x.com/lootrealms");

    const discordLinks = screen.getAllByRole("link", { name: /discord/i });
    expect(discordLinks.length).toBeGreaterThan(0);
    expect(discordLinks[0]).toHaveAttribute("href", "https://discord.gg/realmsworld");

    const githubLinks = screen.getAllByRole("link", { name: /github/i });
    expect(githubLinks.length).toBeGreaterThan(0);
    expect(githubLinks[0]).toHaveAttribute("href", "https://github.com/bibliothecaDAO");
  });

  it("shows_login_button_when_disconnected", () => {
    render(<Header />);

    expect(screen.getByRole("button", { name: /connect wallet/i })).toBeVisible();
  });

  it("shows_cart_trigger_button", () => {
    render(<Header />);

    expect(screen.getByRole("button", { name: /cart \(0\)/i })).toBeVisible();
  });

  it("shows_portfolio_link_for_address_lookup", () => {
    render(<Header />);

    const portfolioLink = screen.getByRole("link", { name: /portfolio/i });
    expect(portfolioLink).toBeVisible();
    expect(portfolioLink).toHaveAttribute("href", "/portfolio");
  });

  it("login_opens_wallet_modal_with_all_connectors", async () => {
    const walletConnector = { id: "braavos", name: "Braavos" };
    const argentConnector = { id: "argentX", name: "Argent" };
    const controllerConnector = { id: "controller", name: "Controller" };
    mockUseConnect.mockReturnValue({
      connect: mockConnect,
      connectors: [walletConnector, argentConnector, controllerConnector],
      pendingConnector: undefined,
      isPending: false,
    });
    const user = userEvent.setup();

    render(<Header />);
    await user.click(screen.getByRole("button", { name: /connect wallet/i }));

    expect(screen.getByRole("heading", { name: /select wallet/i })).toBeVisible();
    expect(screen.getByRole("button", { name: /braavos/i })).toBeVisible();
    expect(screen.getByRole("button", { name: /argent/i })).toBeVisible();
    expect(screen.getByRole("button", { name: /controller/i })).toBeVisible();
  });

  it("wallet_modal_connects_selected_connector", async () => {
    const braavosConnector = { id: "braavos", name: "Braavos" };
    const controllerConnector = { id: "controller", name: "Controller" };
    mockUseConnect.mockReturnValue({
      connect: mockConnect,
      connectors: [controllerConnector, braavosConnector],
      pendingConnector: undefined,
      isPending: false,
    });
    const user = userEvent.setup();

    render(<Header />);
    await user.click(screen.getByRole("button", { name: /connect wallet/i }));
    await user.click(screen.getByRole("button", { name: /braavos/i }));

    expect(mockConnect).toHaveBeenCalledWith({ connector: braavosConnector });
  });

  it("shows_wallet_address_badge_when_connected", () => {
    mockUseAccount.mockReturnValue({
      status: "connected",
      isConnected: true,
      isDisconnected: false,
      address: "0x1234567890abcdef",
    });

    render(<Header />);

    expect(screen.getByTestId("wallet-address")).toHaveTextContent("0x1234...cdef");
  });

  it("no_top_level_disconnect_button_when_connected", () => {
    mockUseAccount.mockReturnValue({
      status: "connected",
      isConnected: true,
      isDisconnected: false,
      address: "0x1234567890abcdef",
    });

    render(<Header />);

    // Disconnect must NOT be a top-level visible button; it lives inside the dropdown
    expect(screen.queryByRole("button", { name: /^disconnect$/i })).toBeNull();
  });

  it("wallet_dropdown_contains_profile_and_disconnect", async () => {
    mockUseAccount.mockReturnValue({
      status: "connected",
      isConnected: true,
      isDisconnected: false,
      address: "0x1234567890abcdef",
    });
    const user = userEvent.setup();

    render(<Header />);
    await user.click(screen.getByTestId("wallet-address"));

    expect(screen.getByRole("menuitem", { name: /profile/i })).toBeVisible();
    expect(screen.getByRole("menuitem", { name: /disconnect/i })).toBeVisible();
  });

  it("disconnect_from_dropdown_calls_disconnect", async () => {
    mockUseAccount.mockReturnValue({
      status: "connected",
      isConnected: true,
      isDisconnected: false,
      address: "0x1234567890abcdef",
    });
    const user = userEvent.setup();

    render(<Header />);
    await user.click(screen.getByTestId("wallet-address"));
    await user.click(screen.getByRole("menuitem", { name: /disconnect/i }));

    expect(mockDisconnect).toHaveBeenCalledTimes(1);
  });

  it("profile_menuitem_links_to_wallet_profile_page", async () => {
    mockUseAccount.mockReturnValue({
      status: "connected",
      isConnected: true,
      isDisconnected: false,
      address: "0x1234567890abcdef",
    });
    const user = userEvent.setup();

    render(<Header />);
    await user.click(screen.getByTestId("wallet-address"));

    const profileItem = screen.getByRole("menuitem", { name: /profile/i });
    expect(profileItem.closest("a")).toHaveAttribute(
      "href",
      "/profile/0x1234567890abcdef",
    );
  });

  it("wallet_dropdown_not_shown_when_disconnected", () => {
    render(<Header />);

    expect(screen.queryByTestId("wallet-address")).toBeNull();
  });

  it("handles_connect_errors_without_throwing", async () => {
    const user = userEvent.setup();
    const mockConsoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    mockConnect.mockRejectedValueOnce(new Error("connect failed"));

    render(<Header />);
    await user.click(screen.getByRole("button", { name: /connect wallet/i }));
    await user.click(screen.getByRole("button", { name: /controller/i }));

    expect(mockConsoleError).toHaveBeenCalledWith(
      "Failed to connect wallet",
      expect.any(Error),
    );
    mockConsoleError.mockRestore();
  });
});
