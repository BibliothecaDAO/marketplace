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
});
