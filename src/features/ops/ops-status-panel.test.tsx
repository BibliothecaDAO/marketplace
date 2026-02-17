import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { OpsStatusPanel } from "@/features/ops/ops-status-panel";

const { mockRefresh, mockUseMarketplaceClient } = vi.hoisted(() => ({
  mockRefresh: vi.fn(async () => null),
  mockUseMarketplaceClient: vi.fn(),
}));

vi.mock("@cartridge/arcade/marketplace/react", () => ({
  useMarketplaceClient: mockUseMarketplaceClient,
}));

describe("ops status panel", () => {
  beforeEach(() => {
    mockRefresh.mockClear();
    mockUseMarketplaceClient.mockReset();
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
});
