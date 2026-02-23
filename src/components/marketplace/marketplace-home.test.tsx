import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MarketplaceHome } from "@/components/marketplace/marketplace-home";

const { mockUseHomePageData } = vi.hoisted(() => ({
  mockUseHomePageData: vi.fn(),
}));
const { mockSearchParams } = vi.hoisted(() => ({
  mockSearchParams: vi.fn(),
}));

vi.mock("@/features/home/use-home-page-data", () => ({
  useHomePageData: mockUseHomePageData,
}));
vi.mock("next/navigation", () => ({
  useSearchParams: () => mockSearchParams(),
}));

vi.mock("@/features/home/hero-banner", () => ({
  HeroBanner: () => <section data-testid="hero-banner">Hero</section>,
}));

vi.mock("@/features/home/trending-tokens-section", () => ({
  TrendingTokensSection: () => <section data-testid="trending-tokens">Trending</section>,
}));

vi.mock("@/features/home/collection-cards-section", () => ({
  CollectionCardsSection: () => <section data-testid="collection-cards">Collections</section>,
}));

describe("MarketplaceHome", () => {
  beforeEach(() => {
    mockUseHomePageData.mockReset();
    mockSearchParams.mockReset();
    mockSearchParams.mockReturnValue(new URLSearchParams());
    mockUseHomePageData.mockReturnValue({
      featuredCollection: {
        address: "0xabc",
        name: "Genesis",
      },
      trendingTokens: [],
      sidebarCollections: [{ address: "0xabc", name: "Genesis" }],
      collectionCards: [{ address: "0xabc", name: "Genesis" }],
      isLoading: false,
    });
  });

  it("renders_hero_banner", () => {
    render(<MarketplaceHome />);

    expect(screen.getByTestId("hero-banner")).toBeVisible();
  });

  it("renders_trending_tokens_section", () => {
    render(<MarketplaceHome />);

    expect(screen.getByTestId("trending-tokens")).toBeVisible();
  });

  it("renders_collection_cards_section", () => {
    render(<MarketplaceHome />);

    expect(screen.getByTestId("collection-cards")).toBeVisible();
  });

  it("renders_empty_state_when_no_collections", () => {
    mockUseHomePageData.mockReturnValue({
      featuredCollection: null,
      trendingTokens: [],
      sidebarCollections: [],
      collectionCards: [],
      isLoading: false,
    });

    render(<MarketplaceHome />);

    expect(screen.getByText(/no collections configured/i)).toBeVisible();
  });
});
