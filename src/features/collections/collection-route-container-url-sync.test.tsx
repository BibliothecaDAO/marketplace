import { render, screen } from "@testing-library/react";
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
  mockSearchParams: new URLSearchParams("cursor=page-2&foo=bar&trait=Eyes:Big"),
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
    onActiveFiltersChange?: (filters: ActiveFilters) => void;
  }) => {
    mockCollectionRouteView(props);

    return (
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
    );
  },
}));

describe("collection route container url sync", () => {
  it("parses_trait_filters_from_url_and_pushes_updated_query", async () => {
    const user = userEvent.setup();

    render(<CollectionRouteContainer address="0xabc" cursor={null} />);

    const firstProps = mockCollectionRouteView.mock.calls[0]?.[0];
    expect(Array.from(firstProps.activeFilters.Eyes)).toEqual(["Big"]);

    await user.click(screen.getByRole("button", { name: /apply-filters/i }));

    expect(mockPush).toHaveBeenCalledWith(
      "/collections/0xabc?foo=bar&trait=Background%3ABlue",
    );
  });
});
