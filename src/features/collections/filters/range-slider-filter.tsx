"use client";

import { Slider } from "@/components/ui/slider";
import type { PrecomputedFilterProperty } from "@/lib/marketplace/traits";

type RangeSliderFilterProps = {
  activeValues?: Set<string>;
  max: number;
  min: number;
  onChange: (values: string[]) => void;
  traitName: string;
  values: PrecomputedFilterProperty[];
};

type NumericTraitValue = {
  numericValue: number;
  rawValue: string;
};

function toNumericTraitValues(values: PrecomputedFilterProperty[]) {
  return values
    .map((item) => {
      const numericValue = Number(item.property);
      if (!Number.isFinite(numericValue)) {
        return null;
      }

      return {
        numericValue,
        rawValue: item.property,
      } satisfies NumericTraitValue;
    })
    .filter((item): item is NumericTraitValue => item !== null)
    .sort((left, right) => left.numericValue - right.numericValue);
}

function selectedBounds(
  numericValues: NumericTraitValue[],
  activeValues: Set<string> | undefined,
  min: number,
  max: number,
) {
  const selected = numericValues
    .filter((item) => activeValues?.has(item.rawValue) ?? false)
    .map((item) => item.numericValue);

  if (selected.length === 0) {
    return [min, max] as const;
  }

  return [
    Math.max(min, Math.min(...selected)),
    Math.min(max, Math.max(...selected)),
  ] as const;
}

export function RangeSliderFilter({
  activeValues,
  max,
  min,
  onChange,
  traitName,
  values,
}: RangeSliderFilterProps) {
  const numericValues = toNumericTraitValues(values).filter(
    (item) => item.numericValue >= min && item.numericValue <= max,
  );

  if (numericValues.length === 0) {
    return <p className="text-xs text-muted-foreground">No numeric values.</p>;
  }

  const [selectedMin, selectedMax] = selectedBounds(
    numericValues,
    activeValues,
    min,
    max,
  );

  return (
    <div className="space-y-3">
      <Slider
        aria-label={`${traitName} range`}
        min={min}
        max={max}
        step={1}
        value={[selectedMin, selectedMax]}
        onValueChange={(nextValue) => {
          const start = Math.min(nextValue[0] ?? min, nextValue[1] ?? max);
          const end = Math.max(nextValue[0] ?? min, nextValue[1] ?? max);
          onChange(
            numericValues
              .filter((item) => item.numericValue >= start && item.numericValue <= end)
              .map((item) => item.rawValue),
          );
        }}
      />
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{selectedMin}</span>
        <span>{selectedMax}</span>
      </div>
    </div>
  );
}
