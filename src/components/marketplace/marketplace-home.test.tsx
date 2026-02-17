import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";

const { mockGetConfig, mockCollectionRow } = vi.hoisted(() => ({
  mockGetConfig: vi.fn(),
  mockCollectionRow: vi.fn(),
}));

vi.mock("@/lib/marketplace/config", () => ({
  getMarketplaceRuntimeConfig: mockGetConfig,
}));

vi.mock("@/components/marketplace/collection-row", () => ({
  CollectionRow: (props: { address: string; name: string; projectId?: string }) => {
    mockCollectionRow(props);
    return <div data-testid={`collection-row-${props.address}`}>{props.name}</div>;
  },
}));

describe("marketplace home", () => {
  beforeEach(() => {
    mockGetConfig.mockReset();
    mockCollectionRow.mockReset();
  });

  it("renders_a_collection_row_for_each_collection", async () => {
    mockGetConfig.mockReturnValue({
      chainLabel: "SN_SEPOLIA",
      sdkConfig: { chainId: "0x534e5f5345504f4c4941" },
      collections: [
        { address: "0xabc", name: "Alpha Collection" },
        { address: "0xdef", name: "Beta Collection", projectId: "beta-proj" },
      ],
      warnings: [],
    });

    const { MarketplaceHome } = await import(
      "@/components/marketplace/marketplace-home"
    );

    render(<MarketplaceHome />);

    expect(screen.getByTestId("collection-row-0xabc")).toBeVisible();
    expect(screen.getByTestId("collection-row-0xdef")).toBeVisible();
  });

  it("passes_correct_props_to_collection_row", async () => {
    mockGetConfig.mockReturnValue({
      chainLabel: "SN_MAIN",
      sdkConfig: { chainId: "0x534e5f4d41494e", defaultProject: "main-proj" },
      collections: [
        { address: "0x111", name: "First", projectId: "proj-1" },
        { address: "0x222", name: "Second" },
      ],
      warnings: [],
    });

    const { MarketplaceHome } = await import(
      "@/components/marketplace/marketplace-home"
    );

    render(<MarketplaceHome />);

    expect(mockCollectionRow).toHaveBeenCalledWith(
      expect.objectContaining({
        address: "0x111",
        name: "First",
        projectId: "proj-1",
      }),
    );
    expect(mockCollectionRow).toHaveBeenCalledWith(
      expect.objectContaining({
        address: "0x222",
        name: "Second",
      }),
    );
  });

  it("shows_empty_state_when_no_collections", async () => {
    mockGetConfig.mockReturnValue({
      chainLabel: "SN_SEPOLIA",
      sdkConfig: { chainId: "0x534e5f5345504f4c4941" },
      collections: [],
      warnings: [],
    });

    const { MarketplaceHome } = await import(
      "@/components/marketplace/marketplace-home"
    );

    render(<MarketplaceHome />);

    expect(screen.getByText(/no collections configured/i)).toBeVisible();
  });

  it("renders_full_width_layout", async () => {
    mockGetConfig.mockReturnValue({
      chainLabel: "SN_SEPOLIA",
      sdkConfig: { chainId: "0x534e5f5345504f4c4941" },
      collections: [
        { address: "0xaaa", name: "Layout Test" },
      ],
      warnings: [],
    });

    const { MarketplaceHome } = await import(
      "@/components/marketplace/marketplace-home"
    );

    render(<MarketplaceHome />);

    expect(screen.getByTestId("marketplace-home")).toBeVisible();
  });
});
