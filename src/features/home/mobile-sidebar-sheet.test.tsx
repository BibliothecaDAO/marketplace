import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MobileSidebarSheet } from "@/features/home/mobile-sidebar-sheet";

const { mockCollectionSidebarRender } = vi.hoisted(() => ({
  mockCollectionSidebarRender: vi.fn(),
}));

vi.mock("@/features/home/collection-sidebar", () => ({
  CollectionSidebar: (props: {
    collections: Array<{ address: string; name: string }>;
    onSelect: (address: string) => void;
  }) => {
    mockCollectionSidebarRender(props);
    return (
      <div>
        <p>Collection sidebar</p>
        <button onClick={() => props.onSelect("0xabc")} type="button">
          Select Genesis
        </button>
      </div>
    );
  },
}));

describe("MobileSidebarSheet", () => {
  beforeEach(() => {
    mockCollectionSidebarRender.mockReset();
  });

  it("opens_sidebar_in_sheet", async () => {
    const user = userEvent.setup();

    render(
      <MobileSidebarSheet
        collections={[{ address: "0xabc", name: "Genesis" }]}
        onSelect={() => undefined}
      />,
    );

    await user.click(screen.getByRole("button", { name: /browse collections/i }));

    expect(screen.getByRole("dialog")).toBeVisible();
    expect(screen.getByText("Collection sidebar")).toBeVisible();
  });

  it("closes_on_collection_select", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();

    render(
      <MobileSidebarSheet
        collections={[{ address: "0xabc", name: "Genesis" }]}
        onSelect={onSelect}
      />,
    );

    await user.click(screen.getByRole("button", { name: /browse collections/i }));
    await user.click(screen.getByRole("button", { name: /select genesis/i }));

    expect(onSelect).toHaveBeenCalledWith("0xabc");
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
    });
  });

  it("sheet_slides_from_left", async () => {
    const user = userEvent.setup();

    render(
      <MobileSidebarSheet
        collections={[{ address: "0xabc", name: "Genesis" }]}
        onSelect={() => undefined}
      />,
    );

    await user.click(screen.getByRole("button", { name: /browse collections/i }));

    expect(screen.getByTestId("mobile-sidebar-sheet-content")).toHaveClass("left-0");
  });
});
