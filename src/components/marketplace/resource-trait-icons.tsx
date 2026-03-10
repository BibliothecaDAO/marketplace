"use client";

import { cn } from "@/lib/utils";

function normalizeResourceName(value: string) {
  return value.replace(/[\s_-]+/g, "").toLowerCase();
}

const RESOURCE_ICON_MAP: Record<string, string> = {
  dragonhide: "/traits/dragonhide.svg",
  mithral: "/traits/mithral.svg",
  adamantine: "/traits/adamantine.svg",
  alchemicalsilver: "/traits/silver.svg",
  twilightquartz: "/traits/quartz.svg",
  trueice: "/traits/true-ice.svg",
  paladint2: "/traits/paladin.svg",
  crossbowmant2: "/traits/crossbowman.svg",
  knightt2: "/traits/knight.svg",
  etherealsilica: "/traits/quartz.svg",
  ignium: "/traits/ignium.svg",
  deepcrystal: "/traits/quartz.svg",
  ruby: "/traits/ruby.svg",
  sapphire: "/traits/sapphire.svg",
  diamonds: "/traits/diamonds.svg",
  paladin: "/traits/paladin.svg",
  crossbowman: "/traits/crossbowman.svg",
  knight: "/traits/knight.svg",
  hartwood: "/traits/wood.svg",
  gold: "/traits/gold.svg",
  coldiron: "/traits/cold-iron.svg",
  ironwood: "/traits/wood.svg",
  silver: "/traits/silver.svg",
  obsidian: "/traits/obsidian.svg",
  copper: "/traits/copper.svg",
  labor: "/traits/labor.svg",
  coal: "/traits/coal.svg",
  stone: "/traits/stone.svg",
  wood: "/traits/wood.svg",
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
        const iconSrc = RESOURCE_ICON_MAP[normalizeResourceName(resource)];

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
