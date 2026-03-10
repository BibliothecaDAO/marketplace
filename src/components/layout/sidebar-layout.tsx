"use client";

import { useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { getMarketplaceRuntimeConfig } from "@/lib/marketplace/config";
import { getCollectionBannerImage } from "@/lib/marketplace/collection-banners";
import { CollectionSidebar } from "@/features/home/collection-sidebar";
import { MobileSidebarSheet } from "@/features/home/mobile-sidebar-sheet";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function activeCollectionAddress(pathname: string | null) {
  if (!pathname) {
    return undefined;
  }

  const [segmentA, segmentB] = pathname.split("/").filter(Boolean);
  if (segmentA !== "collections" || !segmentB) {
    return undefined;
  }

  try {
    return decodeURIComponent(segmentB);
  } catch {
    return segmentB;
  }
}

export function SidebarLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { collections } = getMarketplaceRuntimeConfig();
  const [collapsed, setCollapsed] = useState(false);

  const sidebarCollections = useMemo(
    () =>
      collections.map((collection) => ({
        address: collection.address,
        name: collection.name,
        projectId: collection.projectId,
        imageUrl: getCollectionBannerImage(collection.name),
      })),
    [collections],
  );

  const activeAddress = activeCollectionAddress(pathname);

  function handleSelect(address: string) {
    router.push(`/collections/${address}`);
  }

  return (
    <div
      data-testid="sidebar-layout"
      className="flex min-h-[calc(100vh-3.5rem)]"
    >
      <aside
        className={cn(
          "sticky top-14 hidden h-[calc(100vh-3.5rem)] shrink-0 border-r border-border transition-[width] duration-200 lg:flex lg:flex-col",
          collapsed ? "w-20" : "w-64",
        )}
      >
        <div className="min-h-0 flex-1 overflow-y-auto">
          <CollectionSidebar
            collections={sidebarCollections}
            activeAddress={activeAddress}
            collapsed={collapsed}
            onSelect={handleSelect}
          />
        </div>
        <div
          data-testid="sidebar-toggle-container"
          className="mt-auto flex items-center justify-end border-t border-border/60 p-2"
        >
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            onClick={() => setCollapsed((current) => !current)}
          >
            {collapsed ? (
              <PanelLeftOpen className="h-4 w-4" />
            ) : (
              <PanelLeftClose className="h-4 w-4" />
            )}
          </Button>
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        <div className="border-b border-border/60 px-4 py-2 lg:hidden">
          <MobileSidebarSheet
            collections={sidebarCollections}
            activeAddress={activeAddress}
            onSelect={handleSelect}
          />
        </div>
        {children}
      </div>
    </div>
  );
}
