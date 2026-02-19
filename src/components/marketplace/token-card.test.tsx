import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MarketplaceTokenCard } from "@/components/marketplace/token-card";
import type { NormalizedToken } from "@cartridge/arcade/marketplace";

function token(
  tokenId: string,
  metadata: Record<string, unknown>,
): NormalizedToken {
  return {
    token_id: tokenId,
    metadata,
  } as unknown as NormalizedToken;
}

describe("MarketplaceTokenCard", () => {
  it("renders_base_token_details", () => {
    render(
      <MarketplaceTokenCard
        href="/collections/0xabc/7"
        price="1000000000000000000"
        token={token("7", { name: "Token #7", image_url: "https://cdn.example/7.png" })}
      />,
    );

    expect(screen.getByRole("link")).toHaveAttribute("href", "/collections/0xabc/7");
    expect(screen.getByText("Token #7")).toBeVisible();
    expect(screen.getByText("#7")).toBeVisible();
    expect(screen.getByText("1")).toBeVisible();
  });

  it("includes_hover_and_focus_attribute_table_overlay", () => {
    render(
      <MarketplaceTokenCard
        href="/collections/0xabc/8"
        token={token("8", {
          name: "Token #8",
          attributes: [
            { trait_type: "Background", value: "Blue" },
            { trait_type: "Eyes", value: "Laser" },
          ],
        })}
      />,
    );

    const table = screen.getByTestId("token-attributes-table");
    const overlay = screen.getByTestId("token-attributes-overlay");
    expect(overlay.className).toContain("group-hover:opacity-100");
    expect(overlay.className).toContain("group-focus-visible:opacity-100");
    expect(within(table).getByRole("columnheader", { name: /trait/i })).toBeVisible();
    expect(within(table).getByRole("columnheader", { name: /value/i })).toBeVisible();
    expect(within(table).getByText("Background")).toBeVisible();
    expect(within(table).getByText("Blue")).toBeVisible();
    expect(within(table).getByText("Eyes")).toBeVisible();
    expect(within(table).getByText("Laser")).toBeVisible();
  });

  it("groups_duplicate_trait_names_on_single_row", () => {
    render(
      <MarketplaceTokenCard
        href="/collections/0xabc/10"
        token={token("10", {
          name: "Token #10",
          attributes: [
            { trait_type: "Resource", value: "Coal" },
            { trait_type: "Resource", value: "Stone" },
            { trait_type: "Resource", value: "Wood" },
            { trait_type: "Order", value: "North" },
          ],
        })}
      />,
    );

    const table = screen.getByTestId("token-attributes-table");
    expect(within(table).getAllByText("Resource")).toHaveLength(1);
    expect(within(table).getByText("Coal, Stone, Wood")).toBeVisible();
    expect(within(table).getByText("Order")).toBeVisible();
    expect(within(table).getByText("North")).toBeVisible();
  });

  it("uses_scroll_container_for_long_attribute_lists", () => {
    render(
      <MarketplaceTokenCard
        href="/collections/0xabc/11"
        token={token("11", {
          name: "Token #11",
          attributes: Array.from({ length: 25 }, (_, index) => ({
            trait_type: `Trait ${index + 1}`,
            value: `Value ${index + 1}`,
          })),
        })}
      />,
    );

    const scroll = screen.getByTestId("token-attributes-scroll");
    expect(scroll.className).toContain("overflow-y-auto");
    expect(scroll.className).toContain("max-h");
  });

  it("shows_empty_attribute_row_when_metadata_has_no_attributes", () => {
    render(
      <MarketplaceTokenCard
        href="/collections/0xabc/9"
        token={token("9", { name: "Token #9" })}
      />,
    );

    const table = screen.getByTestId("token-attributes-table");
    expect(within(table).getByText("No attributes")).toBeVisible();
  });
});
