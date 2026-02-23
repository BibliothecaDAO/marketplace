import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import type { SidebarCollection } from "@/features/home/types";

type CollectionSidebarProps = {
  collections: SidebarCollection[];
  activeAddress?: string;
  collapsed?: boolean;
  onSelect: (address: string) => void;
};

function initials(name: string) {
  const value = name.trim();
  if (!value) {
    return "?";
  }

  return value.slice(0, 1).toUpperCase();
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
          {collections.map((collection) => {
            const isActive = activeAddress === collection.address;

            return (
              <li key={collection.address}>
                <button
                  type="button"
                  aria-label={collection.name}
                  onClick={() => onSelect(collection.address)}
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
                    {collection.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={collection.imageUrl}
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
          })}
        </ul>
      )}
    </nav>
  );
}
