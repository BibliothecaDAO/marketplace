import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { OpsStatusPanel } from "@/features/ops/ops-status-panel";

const { mockRefresh, mockUseMarketplaceClient, mockGetMarketplaceRuntimeConfig } = vi.hoisted(() => ({
  mockRefresh: vi.fn(async () => null),
  mockUseMarketplaceClient: vi.fn(),
  mockGetMarketplaceRuntimeConfig: vi.fn(),
}));

vi.mock("@cartridge/arcade/marketplace/react", () => ({
  useMarketplaceClient: mockUseMarketplaceClient,
}));

vi.mock("@/lib/marketplace/config", () => ({
  getMarketplaceRuntimeConfig: mockGetMarketplaceRuntimeConfig,
}));

describe("ops status panel", () => {
  beforeEach(() => {
    mockRefresh.mockClear();
    mockUseMarketplaceClient.mockReset();
    mockGetMarketplaceRuntimeConfig.mockReset();
    mockGetMarketplaceRuntimeConfig.mockReturnValue({
      chainLabel: "SN_MAIN",
      sdkConfig: { chainId: "0x534e5f4d41494e", runtime: "edge" },
      featureFlags: { enableDeferredMetadataHydration: false },
      collections: [],
      warnings: [],
    });
  });

  it("provider_reports_ready_state_after_init", () => {
    mockUseMarketplaceClient.mockReturnValue({
      client: {},
      status: "ready",
      error: null,
      refresh: mockRefresh,
    });

    render(<OpsStatusPanel />);

    expect(screen.getByText(/client status/i)).toBeVisible();
    expect(screen.getByText("ready")).toBeVisible();
    expect(screen.getByText(/runtime: edge/i)).toBeVisible();
    expect(screen.getByText(/deferred metadata: disabled/i)).toBeVisible();
  });

  it("provider_refresh_recovers_from_init_failure", async () => {
    mockUseMarketplaceClient.mockReturnValue({
      client: null,
      status: "error",
      error: new Error("bootstrap failed"),
      refresh: mockRefresh,
    });
    const user = userEvent.setup();

    render(<OpsStatusPanel />);
    await user.click(screen.getByRole("button", { name: /retry client init/i }));

    expect(mockRefresh).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/bootstrap failed/i)).toBeVisible();
  });

  it("shows_deferred_metadata_as_sdk_unsupported_when_flag_enabled_without_methods", () => {
    mockUseMarketplaceClient.mockReturnValue({
      client: {},
      status: "ready",
      error: null,
      refresh: mockRefresh,
    });
    mockGetMarketplaceRuntimeConfig.mockReturnValue({
      chainLabel: "SN_MAIN",
      sdkConfig: { chainId: "0x534e5f4d41494e", runtime: "edge" },
      featureFlags: { enableDeferredMetadataHydration: true },
      collections: [],
      warnings: [],
    });

    render(<OpsStatusPanel />);

    expect(screen.getByText(/deferred metadata: unsupported by sdk/i)).toBeVisible();
  });
});
