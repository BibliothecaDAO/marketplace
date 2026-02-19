function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => String(entry).trim())
    .filter((entry) => entry.length > 0);
}

export function normalizeTokenIds(tokenIds: unknown) {
  return Array.from(new Set(asStringArray(tokenIds))).sort((a, b) =>
    a.localeCompare(b),
  );
}

function normalizeStringSetLike(value: unknown) {
  if (value instanceof Set) {
    return Array.from(value)
      .map((entry) => String(entry).trim())
      .filter((entry) => entry.length > 0);
  }

  if (Array.isArray(value)) {
    return value
      .map((entry) => String(entry).trim())
      .filter((entry) => entry.length > 0);
  }

  if (typeof value === "string") {
    const normalized = value.trim();
    return normalized.length > 0 ? [normalized] : [];
  }

  return [];
}

export function normalizeAttributeFilters(filters: unknown) {
  if (!filters || typeof filters !== "object") {
    return undefined;
  }

  const normalized = Object.entries(filters as Record<string, unknown>)
    .sort(([a], [b]) => a.localeCompare(b))
    .reduce<Record<string, string[]>>((acc, [traitName, values]) => {
      const deduped = Array.from(new Set(normalizeStringSetLike(values))).sort((a, b) =>
        a.localeCompare(b),
      );

      if (deduped.length > 0) {
        acc[traitName] = deduped;
      }

      return acc;
    }, {});

  return Object.keys(normalized).length > 0 ? normalized : undefined;
}

function normalizeForKey(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value
      .map((entry) => normalizeForKey(entry))
      .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
  }

  if (value && typeof value === "object") {
    return Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .reduce<Record<string, unknown>>((acc, [key, entry]) => {
        acc[key] = normalizeForKey(entry);
        return acc;
      }, {});
  }

  return value;
}

export function stableCacheKey(value: unknown) {
  return JSON.stringify(normalizeForKey(value));
}
