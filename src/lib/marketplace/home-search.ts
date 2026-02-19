export function normalizeHomeSearchQuery(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

export function matchesHomeSearch(
  query: string,
  fields: Array<string | number | null | undefined>,
) {
  const normalizedQuery = normalizeHomeSearchQuery(query);
  if (!normalizedQuery) {
    return true;
  }

  return fields.some((field) =>
    normalizeHomeSearchQuery(String(field ?? "")).includes(normalizedQuery),
  );
}
