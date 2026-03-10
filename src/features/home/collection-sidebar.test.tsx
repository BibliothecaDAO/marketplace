import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CollectionSidebar } from "@/features/home/collection-sidebar";

const { mockUseCollectionTokensQuery } = vi.hoisted(() => ({
  mockUseCollectionTokensQuery: vi.fn(),
}));

vi.mock("@/lib/marketplace/hooks", () => ({
  useCollectionTokensQuery: (...args: unknown[]) => mockUseCollectionTokensQuery(...args),
}));

const collections = [
  {
    address: "0xabc",
    name: "Genesis",
    projectId: "project-a",
    imageUrl: "https://cdn.example/genesis.png",
    floorPrice: "1.2",
  },
  {
    address: "0xdef",
    name: "Artifacts",
    projectId: "project-b",
    imageUrl: "https://cdn.example/artifacts.png",
  },
];

describe("CollectionSidebar", () => {
  beforeEach(() => {
    mockUseCollectionTokensQuery.mockReset();
    mockUseCollectionTokensQuery.mockReturnValue({
      data: null,
      isLoading: false,
      isSuccess: false,
      isError: false,
      error: null,
      isFetching: false,
      refetch: vi.fn(),
    });
  });

  it("renders_collection_list_with_names", () => {
    render(
      <CollectionSidebar
        collections={collections}
        onSelect={() => undefined}
      />,
    );

    expect(screen.getByRole("button", { name: /genesis/i })).toBeVisible();
    expect(screen.getByRole("button", { name: /artifacts/i })).toBeVisible();
  });

  it("renders_collection_thumbnails", () => {
    render(
      <CollectionSidebar
        collections={collections}
        onSelect={() => undefined}
      />,
    );

    expect(screen.getByAltText("Genesis thumbnail")).toBeVisible();
    expect(screen.getByAltText("Artifacts thumbnail")).toBeVisible();
  });

  it("highlights_active_collection", () => {
    render(
      <CollectionSidebar
        collections={collections}
        activeAddress="0xabc"
        onSelect={() => undefined}
      />,
    );

    expect(screen.getByRole("button", { name: /genesis/i })).toHaveClass("bg-accent");
  });

  it("calls_onSelect_when_clicked", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();

    render(
      <CollectionSidebar
        collections={collections}
        onSelect={onSelect}
      />,
    );

    await user.click(screen.getByRole("button", { name: /artifacts/i }));

    expect(onSelect).toHaveBeenCalledWith("0xdef");
  });

  it("renders_floor_price_when_provided", () => {
    render(
      <CollectionSidebar
        collections={collections}
        onSelect={() => undefined}
      />,
    );

    expect(screen.getByText(/floor 1.2/i)).toBeVisible();
  });

  it("renders_empty_state", () => {
    render(
      <CollectionSidebar
        collections={[]}
        onSelect={() => undefined}
      />,
    );

    expect(screen.getByText(/no collections/i)).toBeVisible();
  });

  it("sidebar_is_nav_landmark", () => {
    render(
      <CollectionSidebar
        collections={collections}
        onSelect={() => undefined}
      />,
    );

    expect(screen.getByRole("navigation", { name: /collections/i })).toBeVisible();
  });

  it("collapses_labels_when_collapsed", () => {
    render(
      <CollectionSidebar
        collections={collections}
        collapsed
        onSelect={() => undefined}
      />,
    );

    expect(screen.queryByText("Genesis")).toBeNull();
    expect(screen.queryByText("Artifacts")).toBeNull();
    expect(screen.getByRole("button", { name: "Genesis" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Artifacts" })).toBeVisible();
  });

  it("uses_padded_icon_tiles_when_collapsed", () => {
    render(
      <CollectionSidebar
        collections={collections}
        collapsed
        onSelect={() => undefined}
      />,
    );

    expect(screen.getByRole("button", { name: "Genesis" })).toHaveClass("h-11", "w-11", "px-0");
    expect(screen.getByRole("button", { name: "Artifacts" })).toHaveClass("h-11", "w-11", "px-0");
  });

  it("does_not_enable_preview_queries_on_mount_for_missing_images", () => {
    render(
      <CollectionSidebar
        collections={[
          { address: "0xghi", name: "Relics", projectId: "project-c" },
        ]}
        onSelect={() => undefined}
      />,
    );

    expect(mockUseCollectionTokensQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        address: "0xghi",
        project: "project-c",
        fetchImages: true,
      }),
      expect.objectContaining({
        enabled: false,
      }),
    );
  });

  it("loads_preview_thumbnail_after_hover_for_missing_images", async () => {
    mockUseCollectionTokensQuery.mockImplementation(
      (_options: unknown, queryOptions?: { enabled?: boolean }) => ({
        data: queryOptions?.enabled
          ? {
              page: {
                tokens: [
                  {
                    image: "https://cdn.example/relics.png",
                    metadata: { name: "Token #1" },
                  },
                ],
              },
            }
          : null,
        isLoading: false,
        isSuccess: !!queryOptions?.enabled,
        isError: false,
        error: null,
        isFetching: false,
        refetch: vi.fn(),
      }),
    );
    const user = userEvent.setup();

    render(
      <CollectionSidebar
        collections={[
          { address: "0xghi", name: "Relics", projectId: "project-c" },
        ]}
        onSelect={() => undefined}
      />,
    );

    expect(screen.queryByAltText("Relics thumbnail")).toBeNull();

    await user.hover(screen.getByRole("button", { name: "Relics" }));

    expect(await screen.findByAltText("Relics thumbnail")).toBeVisible();
    expect(mockUseCollectionTokensQuery).toHaveBeenLastCalledWith(
      expect.objectContaining({
        address: "0xghi",
        project: "project-c",
      }),
      expect.objectContaining({
        enabled: true,
      }),
    );
  });

  it("keeps_initials_when_preview_query_has_no_image", async () => {
    const user = userEvent.setup();

    render(
      <CollectionSidebar
        collections={[
          { address: "0xghi", name: "Relics", projectId: "project-c" },
        ]}
        onSelect={() => undefined}
      />,
    );

    await user.hover(screen.getByRole("button", { name: "Relics" }));

    expect(screen.queryByAltText("Relics thumbnail")).toBeNull();
    expect(screen.getByText("R")).toBeVisible();
  });
});
