import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CollectionCardsSection } from "@/features/home/collection-cards-section";

vi.mock("@/features/home/collection-card", () => ({
  CollectionCard: (props: { address: string; name: string }) => (
    <a href={`/collections/${props.address}`} aria-label={`Open ${props.name}`}>
      {props.name}
    </a>
  ),
}));

describe("CollectionCardsSection", () => {
  it("renders_section_heading", () => {
    render(
      <CollectionCardsSection
        collections={[]}
      />,
    );

    expect(screen.getByRole("heading", { name: /collections/i })).toBeVisible();
  });

  it("renders_card_per_collection", () => {
    render(
      <CollectionCardsSection
        collections={[
          { address: "0xabc", name: "Genesis" },
          { address: "0xdef", name: "Artifacts" },
        ]}
      />,
    );

    expect(screen.getByRole("link", { name: /open genesis/i })).toBeVisible();
    expect(screen.getByRole("link", { name: /open artifacts/i })).toBeVisible();
  });

  it("renders_in_responsive_grid", () => {
    render(
      <CollectionCardsSection
        collections={[
          { address: "0xabc", name: "Genesis" },
        ]}
      />,
    );

    expect(screen.getByTestId("collection-cards-grid")).toHaveClass(
      "grid-cols-2",
      "md:grid-cols-3",
      "lg:grid-cols-4",
    );
  });

  it("renders_skeleton_grid_when_loading", () => {
    render(
      <CollectionCardsSection
        collections={[]}
        isLoading
      />,
    );

    expect(screen.getAllByTestId("collection-card-skeleton")).toHaveLength(8);
  });

  it("renders_empty_state", () => {
    render(
      <CollectionCardsSection
        collections={[]}
      />,
    );

    expect(screen.getByText(/no collections to show/i)).toBeVisible();
  });
});
