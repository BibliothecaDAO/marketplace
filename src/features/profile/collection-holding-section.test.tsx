import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockUseCollectionQuery,
  mockUseCollectionTokensQuery,
} = vi.hoisted(() => ({
  mockUseCollectionQuery: vi.fn(),
  mockUseCollectionTokensQuery: vi.fn(),
}));

vi.mock("@/lib/marketplace/hooks", () => ({
  useCollectionQuery: mockUseCollectionQuery,
  useCollectionTokensQuery: mockUseCollectionTokensQuery,
}));

vi.mock("@/components/marketplace/token-card", () => ({
  MarketplaceTokenCard: ({ href }: { href: string }) => <a href={href}>token card</a>,
}));

import { CollectionHoldingSection } from "@/features/profile/collection-holding-section";

describe("CollectionHoldingSection", () => {
  beforeEach(() => {
    mockUseCollectionQuery.mockReset();
    mockUseCollectionTokensQuery.mockReset();

    mockUseCollectionQuery.mockReturnValue({
      data: null,
      isLoading: false,
      isError: false,
    });
    mockUseCollectionTokensQuery.mockReturnValue({
      data: { page: { tokens: [] } },
      isLoading: false,
      isError: false,
    });
  });

  it("shows_empty_token_details_state_when_no_tokens_are_resolved", () => {
    render(
      <CollectionHoldingSection
        collectionAddress="0xcollection-a"
        collectionName="Golden Token"
        density="standard"
        tokenIds={["7"]}
      />,
    );

    expect(
      screen.getByText(/no token details are available for this collection yet/i),
    ).toBeVisible();
  });
});
