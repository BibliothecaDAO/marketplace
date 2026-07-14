import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { OpsStatusPanel } from "@/features/ops/ops-status-panel";

const { mockRefetch, mockUseIndexerStatusQuery, mockGetMarketplaceRuntimeConfig } = vi.hoisted(() => ({
  mockRefetch: vi.fn(async () => null),
  mockUseIndexerStatusQuery: vi.fn(),
  mockGetMarketplaceRuntimeConfig: vi.fn(),
}));

vi.mock("@/lib/marketplace/hooks", () => ({
  useIndexerStatusQuery: mockUseIndexerStatusQuery,
}));

vi.mock("@/lib/marketplace/config", () => ({
  getMarketplaceRuntimeConfig: mockGetMarketplaceRuntimeConfig,
}));

describe("owned marketplace diagnostics", () => {
  beforeEach(() => {
    mockRefetch.mockClear();
    mockUseIndexerStatusQuery.mockReset();
    mockGetMarketplaceRuntimeConfig.mockReturnValue({
      chainLabel: "SN_MAIN",
      chainId: "0x00000000000000000000000000000000000000000000000000534e5f4d41494e",
      worldAddress: "0xworld",
      marketplaceAddress: "0xmarket",
      schemaVersion: "1.0.0",
      readRollout: "checkout",
    });
  });

  it("shows API, schema, contract identity, freshness, finality, and metadata failures", () => {
    mockUseIndexerStatusQuery.mockReturnValue({
      data: {
        data: {
          buildVersion: "api-abc",
          replayVersion: "replay-1",
          databaseSchemaVersion: "3",
          indexedBlock: 500,
          indexedBlockHash: "0xhash",
          chainHead: 501,
          lagBlocks: 1,
          finality: "accepted_l2",
          metadataFailures: 2,
          safeForCheckout: true,
        },
        meta: { schemaVersion: "1.0.0" },
      },
      status: "success",
      error: null,
      refetch: mockRefetch,
      isFetching: false,
    });

    render(<OpsStatusPanel />);
    expect(screen.getByText(/owned read plane/i)).toBeVisible();
    expect(screen.getByText(/api-abc/i)).toBeVisible();
    expect(screen.getByText(/schema: 1.0.0/i)).toBeVisible();
    expect(screen.getByText(/world: 0xworld/i)).toBeVisible();
    expect(screen.getByText(/marketplace: 0xmarket/i)).toBeVisible();
    expect(screen.getByText(/indexed block: 500/i)).toBeVisible();
    expect(screen.getByText(/chain head: 501/i)).toBeVisible();
    expect(screen.getByText(/lag: 1 block/i)).toBeVisible();
    expect(screen.getByText(/finality: accepted_l2/i)).toBeVisible();
    expect(screen.getByText(/metadata failures: 2/i)).toBeVisible();
  });

  it("refetches after an API failure", async () => {
    mockUseIndexerStatusQuery.mockReturnValue({
      data: undefined,
      status: "error",
      error: new Error("API unavailable"),
      refetch: mockRefetch,
      isFetching: false,
    });
    const user = userEvent.setup();
    render(<OpsStatusPanel />);
    await user.click(screen.getByRole("button", { name: /retry diagnostics/i }));
    expect(mockRefetch).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/API unavailable/i)).toBeVisible();
  });
});
