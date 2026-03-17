import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { CollectionRouteContainer } from "@/features/collections/collection-route-container";
import type { ActiveFilters } from "@/lib/marketplace/traits";

const {
  mockCollectionRouteView,
  mockPush,
  mockSearchParams,
  mockPathname,
} = vi.hoisted(() => ({
  mockCollectionRouteView: vi.fn(),
  mockPush: vi.fn(),
  mockSearchParams: new URLSearchParams("cursor=page-2&foo=bar&trait=Eyes:Big&sort=price-asc"),
  mockPathname: "/collections/0xabc",
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
  }),
  usePathname: () => mockPathname,
  useSearchParams: () => mockSearchParams,
}));

vi.mock("@/features/collections/collection-route-view", () => ({
  CollectionRouteView: (props: {
    activeFilters: ActiveFilters;
    sortMode:
      | "recent"
      | "price-asc"
      | "price-desc"
      | "power-asc"
      | "power-desc"
      | "level-asc"
      | "level-desc"
      | "health-asc"
      | "health-desc"
      | "resource-count-asc"
      | "resource-count-desc";
    onActiveFiltersChange?: (filters: ActiveFilters) => void;
    onSortModeChange?: (
      sortMode:
        | "recent"
        | "price-asc"
        | "price-desc"
        | "power-asc"
        | "power-desc"
        | "level-asc"
        | "level-desc"
        | "health-asc"
        | "health-desc"
        | "resource-count-asc"
        | "resource-count-desc"
    ) => void;
  }) => {
    mockCollectionRouteView(props);

    return (
      <div>
        <button
          onClick={() =>
            props.onActiveFiltersChange?.({
              Background: new Set(["Blue"]),
            })
          }
          type="button"
        >
          apply-filters
        </button>
        <button
          onClick={() => props.onSortModeChange?.("power-desc")}
          type="button"
        >
          sort-power-desc
        </button>
      </div>
    );
  },
}));

describe("collection route container url sync", () => {
  it("parses_trait_filters_from_url_and_pushes_updated_query", async () => {
    const user = userEvent.setup();

    render(<CollectionRouteContainer address="0xabc" cursor={null} />);

    const firstProps = mockCollectionRouteView.mock.calls[0]?.[0];
    expect(Array.from(firstProps.activeFilters.Eyes)).toEqual(["Big"]);
    expect(firstProps.sortMode).toBe("price-asc");

    await user.click(screen.getByRole("button", { name: /apply-filters/i }));

    expect(mockPush).toHaveBeenCalledWith(
      "/collections/0xabc?foo=bar&trait=Background%3ABlue",
    );
  });

  it("pushes_updated_sort_to_url_and_resets_cursor", async () => {
    const user = userEvent.setup();

    render(<CollectionRouteContainer address="0xabc" cursor={null} />);

    await user.click(screen.getByRole("button", { name: /sort-power-desc/i }));

    expect(mockPush).toHaveBeenCalledWith(
      "/collections/0xabc?foo=bar&trait=Eyes%3ABig&sort=power-desc",
    );
  });

  it("updates_active_filters_optimistically_before_url_state_catches_up", async () => {
    const user = userEvent.setup();

    render(<CollectionRouteContainer address="0xabc" cursor={null} />);

    await user.click(screen.getByRole("button", { name: /apply-filters/i }));

    await waitFor(() => {
      const latestProps = mockCollectionRouteView.mock.lastCall?.[0];
      expect(Array.from(latestProps.activeFilters.Background)).toEqual(["Blue"]);
      expect(latestProps.sortMode).toBe("price-asc");
    });
  });

  it("preserves_pending_filters_when_sort_changes_during_navigation", async () => {
    const user = userEvent.setup();

    render(<CollectionRouteContainer address="0xabc" cursor={null} />);

    await user.click(screen.getByRole("button", { name: /apply-filters/i }));
    await user.click(screen.getByRole("button", { name: /sort-power-desc/i }));

    expect(mockPush).toHaveBeenLastCalledWith(
      "/collections/0xabc?foo=bar&trait=Background%3ABlue&sort=power-desc",
    );
  });
});
