import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SidebarLayout } from "@/components/layout/sidebar-layout";

const {
  mockPush,
  mockPathname,
  mockGetConfig,
  mockCollectionSidebarRender,
  mockMobileSidebarSheetRender,
} = vi.hoisted(() => ({
  mockPush: vi.fn(),
  mockPathname: vi.fn(),
  mockGetConfig: vi.fn(),
  mockCollectionSidebarRender: vi.fn(),
  mockMobileSidebarSheetRender: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
  usePathname: () => mockPathname(),
}));

vi.mock("@/lib/marketplace/config", () => ({
  getMarketplaceRuntimeConfig: mockGetConfig,
}));

vi.mock("@/features/home/collection-sidebar", () => ({
  CollectionSidebar: (props: {
    collections: Array<{ address: string; name: string }>;
    activeAddress?: string;
    collapsed?: boolean;
    onSelect: (address: string) => void;
  }) => {
    mockCollectionSidebarRender(props);

    return (
      <div>
        {props.collections.map((collection) => (
          <button
            key={collection.address}
            onClick={() => props.onSelect(collection.address)}
            type="button"
          >
            {collection.name}
          </button>
        ))}
      </div>
    );
  },
}));

vi.mock("@/features/home/mobile-sidebar-sheet", () => ({
  MobileSidebarSheet: (props: {
    collections: Array<{ address: string; name: string }>;
    activeAddress?: string;
    onSelect: (address: string) => void;
  }) => {
    mockMobileSidebarSheetRender(props);
    return <div data-testid="mobile-sidebar-sheet">Mobile Sheet</div>;
  },
}));

describe("SidebarLayout", () => {
  beforeEach(() => {
    mockPush.mockReset();
    mockPathname.mockReset();
    mockGetConfig.mockReset();
    mockCollectionSidebarRender.mockReset();
    mockMobileSidebarSheetRender.mockReset();

    mockPathname.mockReturnValue("/collections/0xabc");
    mockGetConfig.mockReturnValue({
      chainLabel: "SN_MAIN",
      sdkConfig: { chainId: "0x534e5f4d41494e" },
      collections: [
        { address: "0xabc", name: "Genesis" },
        { address: "0xdef", name: "Artifacts" },
      ],
      warnings: [],
    });
  });

  it("renders_sidebar_and_children", () => {
    render(
      <SidebarLayout>
        <div>Page Content</div>
      </SidebarLayout>,
    );

    expect(screen.getByRole("complementary")).toBeVisible();
    expect(screen.getByText("Page Content")).toBeVisible();
  });

  it("uses_flex_layout", () => {
    render(
      <SidebarLayout>
        <div>Page Content</div>
      </SidebarLayout>,
    );

    expect(screen.getByTestId("sidebar-layout")).toHaveClass("flex");
  });

  it("sidebar_hidden_on_mobile", () => {
    render(
      <SidebarLayout>
        <div>Page Content</div>
      </SidebarLayout>,
    );

    expect(screen.getByRole("complementary")).toHaveClass("hidden", "lg:flex");
  });

  it("sidebar_is_sticky", () => {
    render(
      <SidebarLayout>
        <div>Page Content</div>
      </SidebarLayout>,
    );

    expect(screen.getByRole("complementary")).toHaveClass("sticky", "top-14");
  });

  it("sidebar_has_border_right", () => {
    render(
      <SidebarLayout>
        <div>Page Content</div>
      </SidebarLayout>,
    );

    expect(screen.getByRole("complementary")).toHaveClass("border-r");
  });

  it("renders_sidebar_with_collection_list", () => {
    render(
      <SidebarLayout>
        <div>Page Content</div>
      </SidebarLayout>,
    );

    expect(screen.getByRole("button", { name: "Genesis" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Artifacts" })).toBeVisible();
  });

  it("navigates_to_collection_on_select", async () => {
    const user = userEvent.setup();

    render(
      <SidebarLayout>
        <div>Page Content</div>
      </SidebarLayout>,
    );

    await user.click(screen.getByRole("button", { name: "Genesis" }));

    expect(mockPush).toHaveBeenCalledWith("/collections/0xabc");
  });

  it("sidebar_can_be_collapsed_and_expanded", async () => {
    const user = userEvent.setup();

    render(
      <SidebarLayout>
        <div>Page Content</div>
      </SidebarLayout>,
    );

    const sidebar = screen.getByRole("complementary");
    expect(sidebar).toHaveClass("w-64");
    expect(screen.getByRole("button", { name: /collapse sidebar/i })).toBeVisible();

    await user.click(screen.getByRole("button", { name: /collapse sidebar/i }));

    expect(sidebar).toHaveClass("w-20");
    expect(screen.getByRole("button", { name: /expand sidebar/i })).toBeVisible();
    expect(mockCollectionSidebarRender).toHaveBeenLastCalledWith(
      expect.objectContaining({ collapsed: true }),
    );

    await user.click(screen.getByRole("button", { name: /expand sidebar/i }));

    expect(sidebar).toHaveClass("w-64");
    expect(mockCollectionSidebarRender).toHaveBeenLastCalledWith(
      expect.objectContaining({ collapsed: false }),
    );
  });

  it("renders_toggle_control_at_sidebar_bottom", () => {
    render(
      <SidebarLayout>
        <div>Page Content</div>
      </SidebarLayout>,
    );

    expect(screen.getByTestId("sidebar-toggle-container")).toHaveClass("mt-auto", "border-t");
  });
});
