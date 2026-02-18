import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { TraitFilterSidebar } from "@/features/collections/trait-filter-sidebar";
import type { ActiveFilters } from "@/lib/marketplace/traits";

function token(name: string, background: string, eyes: string) {
  return {
    metadata: {
      name,
      attributes: [
        { trait_type: "Background", value: background },
        { trait_type: "Eyes", value: eyes },
      ],
    },
  };
}

describe("trait filter sidebar", () => {
  it("renders_trait_groups_and_toggles_selection", async () => {
    const onActiveFiltersChange = vi.fn();
    const activeFilters: ActiveFilters = {};
    const user = userEvent.setup();

    render(
      <TraitFilterSidebar
        activeFilters={activeFilters}
        onActiveFiltersChange={onActiveFiltersChange}
        tokens={[token("Token #1", "Blue", "Big"), token("Token #2", "Red", "Small")]}
      />,
    );

    expect(screen.getByText("Traits")).toBeVisible();
    expect(screen.getByText("Background")).toBeVisible();
    expect(screen.getByRole("button", { name: "Blue (1)" })).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Blue (1)" }));

    const nextFilters = onActiveFiltersChange.mock.calls[0][0] as ActiveFilters;
    expect(Array.from(nextFilters.Background)).toEqual(["Blue"]);
  });

  it("empty_state_shows_no_trait_data_message", () => {
    render(
      <TraitFilterSidebar
        activeFilters={{}}
        onActiveFiltersChange={vi.fn()}
        tokens={[]}
      />,
    );

    expect(screen.getByText(/No trait data yet/i)).toBeVisible();
  });

  it("renders_trait_values_from_token_attributes", () => {
    const tokens = [
      {
        metadata: {
          attributes: [
            { trait_type: "Background", value: "Blue" },
            { trait_type: "Eyes", value: "Red" },
          ],
        },
      },
    ];

    render(
      <TraitFilterSidebar
        activeFilters={{}}
        onActiveFiltersChange={vi.fn()}
        tokens={tokens}
      />,
    );

    expect(screen.getByText("Background")).toBeVisible();
    expect(screen.getByRole("button", { name: "Blue (1)" })).toBeVisible();
    expect(screen.getByText("Eyes")).toBeVisible();
    expect(screen.getByRole("button", { name: "Red (1)" })).toBeVisible();
  });

  it("toggle_on_clicking_inactive_trait_adds_it_to_filters", async () => {
    const onActiveFiltersChange = vi.fn();
    const user = userEvent.setup();

    render(
      <TraitFilterSidebar
        activeFilters={{}}
        onActiveFiltersChange={onActiveFiltersChange}
        tokens={[token("Token #1", "Blue", "Big")]}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Blue (1)" }));

    const nextFilters = onActiveFiltersChange.mock.calls[0][0] as ActiveFilters;
    expect(nextFilters.Background).toBeDefined();
    expect(Array.from(nextFilters.Background)).toContain("Blue");
  });

  it("toggle_off_clicking_active_trait_removes_it_from_filters", async () => {
    const onActiveFiltersChange = vi.fn();
    const user = userEvent.setup();
    const activeFilters: ActiveFilters = { Background: new Set(["Blue"]) };

    render(
      <TraitFilterSidebar
        activeFilters={activeFilters}
        onActiveFiltersChange={onActiveFiltersChange}
        tokens={[token("Token #1", "Blue", "Big")]}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Blue (1)" }));

    const nextFilters = onActiveFiltersChange.mock.calls[0][0] as ActiveFilters;
    // After toggling off the only value, the key should be removed entirely
    expect(nextFilters.Background).toBeUndefined();
  });

  it("clear_button_shows_when_active_filters_exist_and_resets_on_click", async () => {
    const onActiveFiltersChange = vi.fn();
    const user = userEvent.setup();
    const activeFilters: ActiveFilters = { Background: new Set(["Blue"]) };

    render(
      <TraitFilterSidebar
        activeFilters={activeFilters}
        onActiveFiltersChange={onActiveFiltersChange}
        tokens={[token("Token #1", "Blue", "Big")]}
      />,
    );

    const clearButton = screen.getByRole("button", { name: /clear/i });
    expect(clearButton).toBeVisible();

    await user.click(clearButton);

    expect(onActiveFiltersChange).toHaveBeenCalledWith({});
  });

  it("clear_button_hidden_when_no_active_filters", () => {
    render(
      <TraitFilterSidebar
        activeFilters={{}}
        onActiveFiltersChange={vi.fn()}
        tokens={[token("Token #1", "Blue", "Big")]}
      />,
    );

    expect(screen.queryByRole("button", { name: /clear/i })).toBeNull();
  });
});
