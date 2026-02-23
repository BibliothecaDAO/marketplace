import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { CollectionSidebar } from "@/features/home/collection-sidebar";

const collections = [
  {
    address: "0xabc",
    name: "Genesis",
    imageUrl: "https://cdn.example/genesis.png",
    floorPrice: "1.2",
  },
  {
    address: "0xdef",
    name: "Artifacts",
    imageUrl: "https://cdn.example/artifacts.png",
  },
];

describe("CollectionSidebar", () => {
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
});
