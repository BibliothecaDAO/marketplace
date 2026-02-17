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

    expect(screen.getByText("Biblio")).toBeVisible();
  });

  it("header_is_a_nav_landmark", () => {
    render(<Header />);

    const header = screen.getByRole("banner");
    expect(header).toBeVisible();
  });

  it("links_logo_to_home", () => {
    render(<Header />);

    const homeLink = screen.getByRole("link", { name: /biblio/i });
    expect(homeLink).toBeVisible();
    expect(homeLink).toHaveAttribute("href", "/");
  });

  it("shows_login_button_when_disconnected", () => {
    render(<Header />);

    expect(screen.getByRole("button", { name: /login/i })).toBeVisible();
  });

  it("login_uses_controller_connector_when_available", async () => {
    const walletConnector = { id: "braavos", name: "Braavos" };
    const controllerConnector = { id: "controller", name: "Controller" };
    mockUseConnect.mockReturnValue({
      connect: mockConnect,
      connectors: [walletConnector, controllerConnector],
      pendingConnector: undefined,
      isPending: false,
    });
    const user = userEvent.setup();

    render(<Header />);
    await user.click(screen.getByRole("button", { name: /login/i }));

    expect(mockConnect).toHaveBeenCalledWith({ connector: controllerConnector });
  });

  it("shows_disconnect_button_for_connected_wallet", async () => {
    mockUseAccount.mockReturnValue({
      status: "connected",
      isConnected: true,
      isDisconnected: false,
      address: "0x1234567890abcdef",
    });
    const user = userEvent.setup();

    render(<Header />);
    await user.click(screen.getByRole("button", { name: /disconnect/i }));

    expect(screen.getByTestId("wallet-address")).toHaveTextContent("0x1234...cdef");
    expect(mockDisconnect).toHaveBeenCalledTimes(1);
  });

  it("handles_connect_errors_without_throwing", async () => {
    const user = userEvent.setup();
    const mockConsoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    mockConnect.mockRejectedValueOnce(new Error("connect failed"));

    render(<Header />);
    await user.click(screen.getByRole("button", { name: /login/i }));

    expect(mockConsoleError).toHaveBeenCalledWith(
      "Failed to connect wallet",
      expect.any(Error),
    );
    mockConsoleError.mockRestore();
  });
});
