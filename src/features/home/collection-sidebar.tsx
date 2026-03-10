import { useEffect, useMemo, useState } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useCollectionTokensQuery } from "@/lib/marketplace/hooks";
import { tokenImage } from "@/lib/marketplace/token-display";
import { cn } from "@/lib/utils";
import type { SidebarCollection } from "@/features/home/types";

type CollectionSidebarProps = {
  collections: SidebarCollection[];
  activeAddress?: string;
  collapsed?: boolean;
  onSelect: (address: string) => void;
};

const PREVIEW_QUERY_STALE_TIME_MS = 5 * 60 * 1000;

function initials(name: string) {
  const value = name.trim();
  if (!value) {
    return "?";
  }

  return value.slice(0, 1).toUpperCase();
}

function CollectionSidebarItem({
  collection,
  activeAddress,
  collapsed,
  onSelect,
}: {
  collection: SidebarCollection;
  activeAddress?: string;
  collapsed: boolean;
  onSelect: (address: string) => void;
}) {
  const [previewRequested, setPreviewRequested] = useState(false);
  const [buttonElement, setButtonElement] = useState<HTMLButtonElement | null>(null);
  const isActive = activeAddress === collection.address;

  useEffect(() => {
    if (collection.imageUrl || previewRequested || !buttonElement) {
      return;
    }

    if (typeof IntersectionObserver === "undefined") {
      return;
    }

    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) {
        return;
      }

      setPreviewRequested(true);
      observer.disconnect();
    }, {
      rootMargin: "200px",
    });

    observer.observe(buttonElement);

    return () => observer.disconnect();
  }, [buttonElement, collection.imageUrl, previewRequested]);

  const previewTokensQuery = useCollectionTokensQuery(
    {
      address: collection.address,
      project: collection.projectId,
      limit: 12,
      fetchImages: true,
    },
    {
      enabled: !collection.imageUrl && previewRequested,
      staleTime: PREVIEW_QUERY_STALE_TIME_MS,
    },
  );

  const resolvedImageUrl = useMemo(() => {
    if (collection.imageUrl) {
      return collection.imageUrl;
    }

    const tokens = previewTokensQuery.data?.page?.tokens ?? [];
    for (const token of tokens) {
      const image = tokenImage(token);
      if (image) {
        return image;
      }
    }

    return null;
  }, [collection.imageUrl, previewTokensQuery.data?.page?.tokens]);

  return (
    <li>
      <button
        ref={setButtonElement}
        type="button"
        aria-label={collection.name}
        onClick={() => onSelect(collection.address)}
        onFocus={() => setPreviewRequested(true)}
        onMouseEnter={() => setPreviewRequested(true)}
        className={cn(
          "flex items-center rounded-md text-left transition-colors",
          collapsed
            ? "mx-auto h-11 w-11 justify-center px-0 py-0 hover:bg-muted/70"
            : "w-full gap-2 px-2 py-2 hover:bg-accent/60",
          isActive
            ? "bg-accent text-accent-foreground"
            : collapsed ? "bg-muted/40" : "bg-transparent",
        )}
      >
        <Avatar size={collapsed ? "default" : "sm"} className="rounded-md">
          {resolvedImageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={resolvedImageUrl}
              alt={`${collection.name} thumbnail`}
              className="h-full w-full object-cover"
            />
          ) : null}
          <AvatarFallback className="rounded-md">{initials(collection.name)}</AvatarFallback>
        </Avatar>
        {!collapsed ? (
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium text-foreground">{collection.name}</span>
            {collection.floorPrice ? (
              <span className="block text-xs text-muted-foreground">Floor {collection.floorPrice}</span>
            ) : null}
          </span>
        ) : null}
      </button>
    </li>
  );
}

export function CollectionSidebar({
  collections,
  activeAddress,
  collapsed = false,
  onSelect,
}: CollectionSidebarProps) {
  return (
    <nav
      aria-label="Collections"
      className={cn("w-full", collapsed ? "px-2 py-3" : "p-2")}
    >
      {collections.length === 0 ? (
        <p className="px-2 py-3 text-sm text-muted-foreground">No collections</p>
      ) : (
        <ul className={cn("space-y-1", collapsed ? "flex flex-col items-center" : "")}>
          {collections.map((collection) => (
            <CollectionSidebarItem
              key={collection.address}
              collection={collection}
              activeAddress={activeAddress}
              collapsed={collapsed}
              onSelect={onSelect}
            />
          ))}
        </ul>
      )}
    </nav>
  );
}
