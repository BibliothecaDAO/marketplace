import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Header } from "./header";

const { mockPush, mockSearchParams } = vi.hoisted(() => ({
  mockPush: vi.fn(),
  mockSearchParams: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
  useSearchParams: () => mockSearchParams(),
}));

describe("Header", () => {
  beforeEach(() => {
    mockPush.mockReset();
    mockSearchParams.mockReset();
    mockSearchParams.mockReturnValue(new URLSearchParams());
  });

  it("renders_logo_placeholder", () => {
    render(<Header />);

    expect(screen.getByTestId("logo-placeholder")).toBeVisible();
  });

  it("renders_app_name", () => {
    render(<Header />);

    expect(screen.getByText("Realms.market")).toBeVisible();
  });

  it("renders_search_input", () => {
    render(<Header />);

    expect(screen.getByPlaceholderText("Search...")).toBeVisible();
  });

  it("search_navigates_on_enter", async () => {
    const user = userEvent.setup();

    render(<Header />);
    await user.type(screen.getByPlaceholderText("Search..."), "dragons{enter}");

    expect(mockPush).toHaveBeenCalledWith("/?q=dragons");
  });

  it("search_reads_initial_value_from_params", () => {
    mockSearchParams.mockReturnValue(new URLSearchParams("q=realms"));

    render(<Header />);

    expect(screen.getByPlaceholderText("Search...")).toHaveValue("realms");
  });

  it("header_is_a_nav_landmark", () => {
    render(<Header />);

    expect(screen.getByRole("banner")).toBeVisible();
  });

  it("links_logo_to_home", () => {
    render(<Header />);

    const homeLink = screen.getByRole("link", { name: /realms\.market home/i });
    expect(homeLink).toHaveAttribute("href", "/");
  });

  it("renders_nav_links", () => {
    render(<Header />);

    expect(screen.getAllByRole("link", { name: /staking/i })[0]).toHaveAttribute(
      "href",
      "https://account.realms.world",
    );
    expect(screen.getAllByRole("link", { name: /ecosystem/i })[0]).toHaveAttribute(
      "href",
      "https://realms.world",
    );
    expect(screen.getAllByRole("link", { name: /eternum/i })[0]).toHaveAttribute(
      "href",
      "https://blitz.realms.world",
    );
  });

  it("renders_social_icon_links", () => {
    render(<Header />);

    const twitterLinks = screen.getAllByRole("link", { name: /twitter/i });
    const discordLinks = screen.getAllByRole("link", { name: /discord/i });

    expect(twitterLinks[0]).toHaveAttribute("href", "https://x.com/lootrealms");
    expect(within(twitterLinks[0]).getByTestId("x-icon")).toBeVisible();
    expect(discordLinks[0]).toHaveAttribute("href", "https://discord.gg/realmsworld");
    expect(within(discordLinks[0]).getByTestId("discord-icon")).toBeVisible();
    expect(screen.queryByRole("link", { name: /github/i })).toBeNull();
  });

  it("shows_portfolio_link_for_address_lookup", () => {
    render(<Header />);

    const portfolioLinks = screen.getAllByRole("link", { name: /portfolio/i });
    expect(portfolioLinks[0]).toHaveAttribute("href", "/portfolio");
  });

  it("desktop_portfolio_control_is_hidden_on_mobile_breakpoints", () => {
    render(<Header />);

    const desktopPortfolioLink = screen
      .getAllByRole("link", { name: /portfolio/i })
      .find((link) => link.getAttribute("href") === "/portfolio");

    expect(desktopPortfolioLink?.className).toContain("hidden");
    expect(desktopPortfolioLink?.className).toContain("sm:inline-flex");
  });

  it("mobile_menu_contains_portfolio_link", async () => {
    const user = userEvent.setup();
    render(<Header />);

    await user.click(screen.getByRole("button", { name: /open menu/i }));

    const mobileMenuDialog = await screen.findByRole("dialog");
    const mobilePortfolioLink = within(mobileMenuDialog).getByRole("link", {
      name: /portfolio/i,
    });
    expect(mobilePortfolioLink).toHaveAttribute("href", "/portfolio");
  });

  it("mobile_menu_contains_updated_social_links_without_github", async () => {
    const user = userEvent.setup();
    render(<Header />);

    await user.click(screen.getByRole("button", { name: /open menu/i }));

    const mobileMenuDialog = await screen.findByRole("dialog");
    const twitterLink = within(mobileMenuDialog).getByRole("link", { name: /twitter/i });
    const discordLink = within(mobileMenuDialog).getByRole("link", { name: /discord/i });

    expect(twitterLink).toHaveAttribute("href", "https://x.com/lootrealms");
    expect(within(twitterLink).getByTestId("x-icon")).toBeVisible();
    expect(discordLink).toHaveAttribute("href", "https://discord.gg/realmsworld");
    expect(within(discordLink).getByTestId("discord-icon")).toBeVisible();
    expect(within(mobileMenuDialog).queryByRole("link", { name: /github/i })).toBeNull();
  });
});
