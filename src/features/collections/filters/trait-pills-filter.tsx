"use client";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { PrecomputedFilterProperty } from "@/lib/marketplace/traits";

type TraitPillsFilterProps = {
  traitName: string;
  values: PrecomputedFilterProperty[];
  activeValues?: Set<string>;
  hideSearch?: boolean;
  onSearchTermChange: (value: string) => void;
  onToggle: (value: string) => void;
  searchTerm: string;
  showCount?: boolean;
  sort?: "alpha" | "count";
};

export function TraitPillsFilter({
  traitName,
  values,
  activeValues,
  hideSearch,
  onSearchTermChange,
  onToggle,
  searchTerm,
  showCount = true,
  sort = "count",
}: TraitPillsFilterProps) {
  const sortedValues = [...values].sort((left, right) => {
    if (sort === "alpha") {
      return left.property.localeCompare(right.property);
    }

    const countDelta = right.count - left.count;
    if (countDelta !== 0) {
      return countDelta;
    }

    return left.property.localeCompare(right.property);
  });
  const normalizedSearchTerm = searchTerm.trim().toLocaleLowerCase();
  const filteredValues = sortedValues.filter((item) =>
    normalizedSearchTerm.length === 0
      ? true
      : item.property.toLocaleLowerCase().includes(normalizedSearchTerm),
  );

  return (
    <div className="space-y-2">
      {!hideSearch ? (
        <Input
          type="search"
          value={searchTerm}
          onChange={(event) => onSearchTermChange(event.target.value)}
          aria-label={`Search ${traitName}`}
          placeholder={`Search ${traitName}`}
          className="h-7 text-xs"
        />
      ) : null}
      <div className="flex flex-wrap gap-1.5">
        {filteredValues.length === 0 ? (
          <p className="text-xs text-muted-foreground">No matches.</p>
        ) : (
          filteredValues.map((item) => {
            const isActive = activeValues?.has(item.property) ?? false;
            return (
              <button
                key={`${traitName}-${item.property}`}
                onClick={() => onToggle(item.property)}
                type="button"
                className={cn(
                  "inline-flex items-center rounded-full border px-2 py-0.5 text-xs transition-colors",
                  isActive
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border text-muted-foreground hover:border-primary/50 hover:text-foreground",
                )}
              >
                {showCount ? `${item.property} (${item.count})` : item.property}
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
