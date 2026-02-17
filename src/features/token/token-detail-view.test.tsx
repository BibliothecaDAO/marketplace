import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { TokenDetailView } from "@/features/token/token-detail-view";

const { mockUseTokenDetailQuery } = vi.hoisted(() => ({
  mockUseTokenDetailQuery: vi.fn(),
}));

vi.mock("@/lib/marketplace/hooks", () => ({
  useTokenDetailQuery: mockUseTokenDetailQuery,
}));

function successQuery(data: unknown) {
  return {
    data,
    isLoading: false,
    isSuccess: true,
    isError: false,
    error: null,
    isFetching: false,
    refetch: vi.fn(),
  };
}

function loadingQuery() {
  return {
    data: undefined,
    isLoading: true,
    isSuccess: false,
    isError: false,
    error: null,
    isFetching: true,
    refetch: vi.fn(),
  };
}

describe("token detail view", () => {
  beforeEach(() => {
    mockUseTokenDetailQuery.mockReset();
  });

  it("renders_token_name_and_image", () => {
    mockUseTokenDetailQuery.mockReturnValue(
      successQuery({
        token: {
          token_id: "42",
          image: "https://cdn.example/dragon-42.png",
          metadata: { name: "Dragon #42" },
        },
        orders: [],
        listings: [],
      }),
    );

    render(<TokenDetailView address="0xabc" tokenId="42" />);

    expect(screen.getByRole("heading", { name: "Dragon #42" })).toBeVisible();
    expect(screen.getByAltText("Dragon #42")).toBeVisible();
    expect(screen.getByAltText("Dragon #42")).toHaveAttribute(
      "src",
      "https://cdn.example/dragon-42.png",
    );
  });

  it("renders_token_attributes", () => {
    mockUseTokenDetailQuery.mockReturnValue(
      successQuery({
        token: {
          token_id: "1",
          image: "https://cdn.example/1.png",
          metadata: {
            name: "Styled Token",
            attributes: [
              { trait_type: "Background", value: "Blue" },
              { trait_type: "Eyes", value: "Laser" },
            ],
          },
        },
        orders: [],
        listings: [],
      }),
    );

    render(<TokenDetailView address="0xabc" tokenId="1" />);

    expect(screen.getByText("Background")).toBeVisible();
    expect(screen.getByText("Blue")).toBeVisible();
    expect(screen.getByText("Eyes")).toBeVisible();
    expect(screen.getByText("Laser")).toBeVisible();
  });

  it("shows_loading_skeleton", () => {
    mockUseTokenDetailQuery.mockReturnValue(loadingQuery());

    render(<TokenDetailView address="0xabc" tokenId="1" />);

    expect(screen.getAllByTestId("token-detail-skeleton").length).toBeGreaterThan(0);
  });

  it("shows_token_listings", () => {
    mockUseTokenDetailQuery.mockReturnValue(
      successQuery({
        token: {
          token_id: "1",
          image: "https://cdn.example/1.png",
          metadata: { name: "Token #1" },
        },
        orders: [],
        listings: [
          {
            id: 1,
            price: 1000000000000000000,
            owner: "0xowner1",
            expiration: 1735689600,
          },
          {
            id: 2,
            price: 2000000000000000000,
            owner: "0xowner2",
            expiration: 1735689600,
          },
        ],
      }),
    );

    render(<TokenDetailView address="0xabc" tokenId="1" />);

    expect(screen.getByText("Listings")).toBeVisible();
    expect(screen.getByText(/0xowner1/)).toBeVisible();
    expect(screen.getByText(/0xowner2/)).toBeVisible();
  });

  it("shows_empty_listings_message", () => {
    mockUseTokenDetailQuery.mockReturnValue(
      successQuery({
        token: {
          token_id: "1",
          image: "https://cdn.example/1.png",
          metadata: { name: "Token #1" },
        },
        orders: [],
        listings: [],
      }),
    );

    render(<TokenDetailView address="0xabc" tokenId="1" />);

    expect(screen.getByText("No listings")).toBeVisible();
  });

  it("passes_correct_args_to_hook", () => {
    mockUseTokenDetailQuery.mockReturnValue(
      successQuery({
        token: {
          token_id: "7",
          image: "https://cdn.example/7.png",
          metadata: { name: "Token #7" },
        },
        orders: [],
        listings: [],
      }),
    );

    render(
      <TokenDetailView address="0x123" tokenId="7" projectId="my-project" />,
    );

    expect(mockUseTokenDetailQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: "0x123",
        tokenId: "7",
        projectId: "my-project",
        fetchImages: true,
      }),
    );
  });
});
