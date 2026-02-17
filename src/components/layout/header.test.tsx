import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { Header } from "./header";

describe("Header", () => {
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
});
