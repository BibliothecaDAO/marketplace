import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ThemePalette } from "@/components/marketplace/theme-palette";

describe("theme palette", () => {
  it("renders_theme_tokens_heading", () => {
    render(<ThemePalette />);
    expect(screen.getByText("Theme Tokens")).toBeVisible();
  });

  it("renders_all_token_swatches", () => {
    render(<ThemePalette />);
    expect(screen.getByText("background")).toBeVisible();
    expect(screen.getByText("foreground")).toBeVisible();
    expect(screen.getByText("primary")).toBeVisible();
    expect(screen.getByText("destructive")).toBeVisible();
    expect(screen.getByText("chart-1")).toBeVisible();
  });
});
