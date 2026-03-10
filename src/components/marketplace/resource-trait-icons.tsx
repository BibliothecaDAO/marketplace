"use client";

import { cn } from "@/lib/utils";

const RESOURCE_ICON_MAP: Record<string, string> = {
  Coal: "/traits/coal.svg",
  Copper: "/traits/copper.svg",
  Gold: "/traits/gold.svg",
  Obsidian: "/traits/obsidian.svg",
  Silver: "/traits/silver.svg",
  Stone: "/traits/stone.svg",
  Wood: "/traits/wood.svg",
};

type ResourceTraitIconsProps = {
  resources: string[];
  showLabels?: boolean;
  className?: string;
};

export function ResourceTraitIcons({
  resources,
  showLabels = false,
  className,
}: ResourceTraitIconsProps) {
  if (resources.length === 0) {
    return null;
  }

  return (
    <div
      className={cn("flex flex-wrap items-center gap-1.5", className)}
      data-testid="resource-trait-icons"
    >
      {resources.map((resource) => {
        const iconSrc = RESOURCE_ICON_MAP[resource];

        return (
          <span
            key={resource}
            className={cn(
              "inline-flex items-center gap-1 rounded-full border border-border/70 bg-muted/40 px-1.5 py-0.5 text-[10px] text-muted-foreground",
              !showLabels && "px-1 py-1",
            )}
          >
            {iconSrc ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                alt={resource}
                className="size-3 shrink-0"
                src={iconSrc}
              />
            ) : (
              <span className="inline-flex size-3 items-center justify-center rounded-full bg-muted text-[8px] font-semibold text-foreground">
                {resource.slice(0, 1).toUpperCase()}
              </span>
            )}
            {showLabels ? <span>{resource}</span> : <span className="sr-only">{resource}</span>}
          </span>
        );
      })}
    </div>
  );
}

