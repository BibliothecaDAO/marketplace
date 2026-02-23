export type TraitSelection = {
  name: string;
  value: string;
};

export type TraitNameSummary = {
  traitName: string;
  valueCount: number;
};

export type TraitNameSummaryPage = {
  projectId: string;
  traits: TraitNameSummary[];
};

export type TraitValueRow = {
  traitValue: string;
  count: number;
};

export type TraitValuePage = {
  projectId: string;
  values: TraitValueRow[];
};

export type FetchTraitValuesOptions = {
  address: string;
  traitName: string;
  otherTraitFilters?: TraitSelection[];
  projects?: string[];
  defaultProjectId?: string;
};

type FetchTraitValuesResult = {
  pages: TraitValuePage[];
  errors: Array<{ projectId?: string; error: Error }>;
};

type TraitValueFetcher = (
  options: FetchTraitValuesOptions,
) => Promise<FetchTraitValuesResult>;

export type FetchTraitNamesSummaryOptions = {
  address: string;
  projects?: string[];
  defaultProjectId?: string;
};

type FetchTraitNamesSummaryResult = {
  pages: TraitNameSummaryPage[];
  errors: Array<{ projectId?: string; error: Error }>;
};

type TraitNamesSummaryFetcher = (
  options: FetchTraitNamesSummaryOptions,
) => Promise<FetchTraitNamesSummaryResult>;

export type ActiveFilters = Record<string, Set<string>>;
export type AvailableFilters = Record<string, Record<string, number>>;
export type TraitMetadataRow = {
  traitName: string;
  traitValue: string;
  count: number;
};

export type PrecomputedFilterProperty = {
  property: string;
  order: number;
  count: number;
};

export type PrecomputedFilterData = {
  attributes: string[];
  properties: Record<string, PrecomputedFilterProperty[]>;
};

type TokenLike = {
  metadata?: unknown;
};

function normalizeTraitValue(value: unknown) {
  if (value === null || value === undefined) {
    return "";
  }

  return String(value);
}

export function aggregateTraitSummaryPages(pages: TraitNameSummaryPage[]) {
  const map = new Map<string, number>();

  pages.forEach((page) => {
    page.traits.forEach((trait) => {
      const nextCount = (map.get(trait.traitName) ?? 0) + trait.valueCount;
      map.set(trait.traitName, nextCount);
    });
  });

  return Array.from(map.entries())
    .map(([traitName, valueCount]) => ({ traitName, valueCount }))
    .sort((a, b) => a.traitName.localeCompare(b.traitName));
}

export function aggregateTraitValuePages(pages: TraitValuePage[]) {
  const map = new Map<string, number>();

  pages.forEach((page) => {
    page.values.forEach((entry) => {
      const nextCount = (map.get(entry.traitValue) ?? 0) + entry.count;
      map.set(entry.traitValue, nextCount);
    });
  });

  return Array.from(map.entries())
    .map(([traitValue, count]) => ({ traitValue, count }))
    .sort((a, b) => a.traitValue.localeCompare(b.traitValue));
}

async function defaultFetchTraitNamesSummary(
  options: FetchTraitNamesSummaryOptions,
) {
  const marketplace = await import("@cartridge/arcade/marketplace");
  return marketplace.fetchTraitNamesSummary(options);
}

export async function fetchTraitNamesSummary(
  options: FetchTraitNamesSummaryOptions,
  dependencies?: { fetchTraitNamesSummary?: TraitNamesSummaryFetcher },
) {
  const fetcher =
    dependencies?.fetchTraitNamesSummary ?? defaultFetchTraitNamesSummary;
  const result = await fetcher(options);

  return {
    traitNames: aggregateTraitSummaryPages(result.pages),
    errors: result.errors,
  };
}

async function defaultFetchTraitValues(options: FetchTraitValuesOptions) {
  const marketplace = await import("@cartridge/arcade/marketplace");
  return marketplace.fetchTraitValues(options);
}

export async function fetchFilteredTraitValues(
  options: FetchTraitValuesOptions,
  dependencies?: { fetchTraitValues?: TraitValueFetcher },
) {
  const fetchTraitValues = dependencies?.fetchTraitValues ?? defaultFetchTraitValues;
  const result = await fetchTraitValues(options);

  return {
    values: aggregateTraitValuePages(result.pages),
    errors: result.errors,
  };
}

export function computeAvailableFilters(
  metadata: TraitMetadataRow[],
  activeFilters: ActiveFilters,
): AvailableFilters {
  const available: AvailableFilters = {};

  metadata.forEach((row) => {
    if (!available[row.traitName]) {
      available[row.traitName] = {};
    }

    const selectedValues = activeFilters[row.traitName];
    if (selectedValues && selectedValues.size > 0 && !selectedValues.has(row.traitValue)) {
      return;
    }

    available[row.traitName][row.traitValue] = row.count;
  });

  return available;
}

export function computePrecomputedFilters(
  availableFilters: AvailableFilters,
): PrecomputedFilterData {
  const attributes = Object.keys(availableFilters).sort((a, b) => a.localeCompare(b));
  const properties: Record<string, PrecomputedFilterProperty[]> = {};

  attributes.forEach((traitName) => {
    const sorted = Object.entries(availableFilters[traitName])
      .sort((a, b) => {
        const countDelta = b[1] - a[1];
        if (countDelta !== 0) {
          return countDelta;
        }

        return a[0].localeCompare(b[0]);
      })
      .map(([property, count], order) => ({ property, order, count }));

    properties[traitName] = sorted;
  });

  return { attributes, properties };
}

export function flattenActiveFilters(activeFilters: ActiveFilters): TraitSelection[] {
  const entries = Object.entries(activeFilters)
    .sort(([a], [b]) => a.localeCompare(b))
    .flatMap(([name, values]) =>
      Array.from(values)
        .sort((a, b) => a.localeCompare(b))
        .map((value) => ({ name, value })),
    );

  return entries;
}

export function activeFiltersToSearchParams(activeFilters: ActiveFilters) {
  const params = new URLSearchParams();
  flattenActiveFilters(activeFilters).forEach((entry) => {
    params.append("trait", `${entry.name}:${entry.value}`);
  });
  return params;
}

export function activeFiltersFromSearchParams(
  params: URLSearchParams,
): ActiveFilters {
  const filters: ActiveFilters = {};

  params.getAll("trait").forEach((entry) => {
    const delimiter = entry.indexOf(":");
    if (delimiter <= 0) {
      return;
    }

    const name = entry.slice(0, delimiter);
    const value = entry.slice(delimiter + 1);
    if (!name || !value) {
      return;
    }

    if (!filters[name]) {
      filters[name] = new Set();
    }
    filters[name].add(value);
  });

  return filters;
}

function traitValueByName(metadata: unknown, traitName: string) {
  if (!metadata || typeof metadata !== "object") {
    return undefined;
  }

  const attributes = (metadata as { attributes?: unknown }).attributes;
  if (!Array.isArray(attributes)) {
    return undefined;
  }

  for (const rawAttribute of attributes) {
    if (!rawAttribute || typeof rawAttribute !== "object") {
      continue;
    }

    const attribute = rawAttribute as Record<string, unknown>;
    const typeValue = normalizeTraitValue(
      attribute.trait_type ?? attribute.traitName ?? attribute.name,
    );

    if (typeValue !== traitName) {
      continue;
    }

    const value = normalizeTraitValue(attribute.value ?? attribute.traitValue);
    return value || undefined;
  }

  return undefined;
}

export function tokenMatchesActiveFilters(
  token: TokenLike,
  activeFilters: ActiveFilters,
) {
  const entries = Object.entries(activeFilters);
  if (entries.length === 0) {
    return true;
  }

  return entries.every(([traitName, acceptedValues]) => {
    if (acceptedValues.size === 0) {
      return true;
    }

    const actual = traitValueByName(token.metadata, traitName);
    if (!actual) {
      return false;
    }

    return acceptedValues.has(actual);
  });
}

export function filterTokensByActiveFilters<T extends TokenLike>(
  tokens: T[],
  activeFilters: ActiveFilters,
) {
  return tokens.filter((token) => tokenMatchesActiveFilters(token, activeFilters));
}
