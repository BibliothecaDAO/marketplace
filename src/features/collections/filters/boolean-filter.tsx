"use client";

import { cn } from "@/lib/utils";
import type { PrecomputedFilterProperty } from "@/lib/marketplace/traits";

type BooleanFilterProps = {
  traitName: string;
  values: PrecomputedFilterProperty[];
  activeValues?: Set<string>;
  onToggle: (value: string) => void;
};

export function BooleanFilter({
  traitName,
  values,
  activeValues,
  onToggle,
}: BooleanFilterProps) {
  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label={traitName}>
      {values.map((item) => {
        const isActive = activeValues?.has(item.property) ?? false;
        return (
          <button
            key={`${traitName}-${item.property}`}
            type="button"
            onClick={() => onToggle(item.property)}
            className={cn(
              "inline-flex min-w-16 items-center justify-center rounded-md border px-3 py-1 text-xs font-medium transition-colors",
              isActive
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border text-muted-foreground hover:border-primary/50 hover:text-foreground",
            )}
          >
            {item.property}
          </button>
        );
      })}
    </div>
  );
}
