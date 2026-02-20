import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { TraitFilterSidebar } from "@/features/collections/trait-filter-sidebar";
import type { ActiveFilters, TraitMetadataRow } from "@/lib/marketplace/traits";

function row(traitName: string, traitValue: string, count = 1): TraitMetadataRow {
  return { traitName, traitValue, count };
}

async function openTraitGroup(user: ReturnType<typeof userEvent.setup>, traitName: string) {
  await user.click(screen.getByRole("button", { name: new RegExp(traitName, "i") }));
}

describe("trait filter sidebar", () => {
  it("trait_groups_are_collapsed_by_default_and_expand_on_click", async () => {
    const user = userEvent.setup();

    render(
      <TraitFilterSidebar
        activeFilters={{}}
        onActiveFiltersChange={vi.fn()}
        traitMetadata={[
          row("Background", "Blue"),
          row("Background", "Red"),
        ]}
      />,
    );

    expect(screen.queryByRole("button", { name: "Blue (1)" })).toBeNull();

    await openTraitGroup(user, "Background");

    expect(screen.getByRole("button", { name: "Blue (1)" })).toBeVisible();
  });

  it("only_one_trait_group_can_be_open_at_a_time", async () => {
    const user = userEvent.setup();

    render(
      <TraitFilterSidebar
        activeFilters={{}}
        onActiveFiltersChange={vi.fn()}
        traitMetadata={[
          row("Background", "Blue"),
          row("Eyes", "Big"),
        ]}
      />,
    );

    await openTraitGroup(user, "Background");
    expect(screen.getByRole("button", { name: "Blue (1)" })).toBeVisible();

    await openTraitGroup(user, "Eyes");

    expect(screen.queryByRole("button", { name: "Blue (1)" })).toBeNull();
    expect(screen.getByRole("button", { name: "Big (1)" })).toBeVisible();
  });

  it("search_filters_values_inside_open_trait_group", async () => {
    const user = userEvent.setup();

    render(
      <TraitFilterSidebar
        activeFilters={{}}
        onActiveFiltersChange={vi.fn()}
        traitMetadata={[
          row("Background", "Blue"),
          row("Background", "Red"),
          row("Background", "Green"),
        ]}
      />,
    );

    await openTraitGroup(user, "Background");
    await user.type(screen.getByRole("searchbox", { name: /search background/i }), "re");

    expect(screen.queryByRole("button", { name: "Blue (1)" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Red (1)" })).toBeVisible();
    expect(screen.queryByRole("button", { name: "Green (1)" })).toBeVisible();
  });

  it("renders_trait_groups_and_toggles_selection", async () => {
    const onActiveFiltersChange = vi.fn();
    const activeFilters: ActiveFilters = {};
    const user = userEvent.setup();

    render(
      <TraitFilterSidebar
        activeFilters={activeFilters}
        onActiveFiltersChange={onActiveFiltersChange}
        traitMetadata={[
          row("Background", "Blue"),
          row("Background", "Red"),
          row("Eyes", "Big"),
          row("Eyes", "Small"),
        ]}
      />,
    );

    expect(screen.getByText("Filters")).toBeVisible();
    expect(screen.getByText("Background")).toBeVisible();
    await openTraitGroup(user, "Background");
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
        traitMetadata={[]}
      />,
    );

    expect(screen.getByText(/No trait data/i)).toBeVisible();
  });

  it("loading_state_shows_loading_message", () => {
    render(
      <TraitFilterSidebar
        activeFilters={{}}
        onActiveFiltersChange={vi.fn()}
        traitMetadata={[]}
        isLoading
      />,
    );

    expect(screen.getByText(/loading/i)).toBeVisible();
  });

  it("renders_trait_values_from_metadata_rows", () => {
    render(
      <TraitFilterSidebar
        activeFilters={{}}
        onActiveFiltersChange={vi.fn()}
        traitMetadata={[
          row("Background", "Blue"),
          row("Eyes", "Red"),
        ]}
      />,
    );

    expect(screen.getByText("Background")).toBeVisible();
    expect(screen.queryByRole("button", { name: "Blue (1)" })).toBeNull();
    expect(screen.getByText("Eyes")).toBeVisible();
    expect(screen.queryByRole("button", { name: "Red (1)" })).toBeNull();
  });

  it("toggle_on_clicking_inactive_trait_adds_it_to_filters", async () => {
    const onActiveFiltersChange = vi.fn();
    const user = userEvent.setup();

    render(
      <TraitFilterSidebar
        activeFilters={{}}
        onActiveFiltersChange={onActiveFiltersChange}
        traitMetadata={[row("Background", "Blue")]}
      />,
    );

    await openTraitGroup(user, "Background");
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
        traitMetadata={[row("Background", "Blue")]}
      />,
    );

    await openTraitGroup(user, "Background");
    await user.click(screen.getByRole("button", { name: "Blue (1)" }));

    const nextFilters = onActiveFiltersChange.mock.calls[0][0] as ActiveFilters;
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
        traitMetadata={[row("Background", "Blue")]}
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
        traitMetadata={[row("Background", "Blue")]}
      />,
    );

    expect(screen.queryByRole("button", { name: /clear/i })).toBeNull();
  });

  it("shows_count_from_metadata_row", () => {
    render(
      <TraitFilterSidebar
        activeFilters={{}}
        onActiveFiltersChange={vi.fn()}
        traitMetadata={[row("Background", "Blue", 42)]}
      />,
    );

    expect(screen.queryByRole("button", { name: "Blue (42)" })).toBeNull();
  });
});
