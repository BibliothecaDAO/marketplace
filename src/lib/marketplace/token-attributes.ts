type TokenAttributeRow = {
  trait: string;
  value: string;
};

const REALM_RESOURCE_ORDER = [
  "Dragonhide",
  "Mithral",
  "Adamantine",
  "Alchemical Silver",
  "Twilight Quartz",
  "True Ice",
  "Paladin T2",
  "Crossbowman T2",
  "Knight T2",
  "Ethereal Silica",
  "Ignium",
  "Deep Crystal",
  "Ruby",
  "Sapphire",
  "Diamonds",
  "Paladin",
  "Crossbowman",
  "Knight",
  "Hartwood",
  "Coal",
  "Gold",
  "Cold Iron",
  "Ironwood",
  "Silver",
  "Obsidian",
  "Copper",
  "Labor",
  "Stone",
  "Wood",
] as const;

function normalizeResourceName(value: string) {
  return value.replace(/[\s_-]+/g, "").toLowerCase();
}

const REALM_RESOURCE_ORDER_INDEX = new Map<string, number>(
  REALM_RESOURCE_ORDER.map((resource, index) => [
    normalizeResourceName(resource),
    index,
  ] as const),
);

function normalizeAttributeValue(value: unknown) {
  if (typeof value === "string") {
    const normalized = value.trim();
    return normalized.length > 0 ? normalized : null;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  return null;
}

function rawAttributes(metadata: unknown) {
  if (!metadata || typeof metadata !== "object") {
    return [];
  }

  const attributes = (metadata as { attributes?: unknown }).attributes;
  return Array.isArray(attributes) ? attributes : [];
}

export function tokenAttributes(metadata: unknown): TokenAttributeRow[] {
  const grouped = new Map<string, string[]>();

  rawAttributes(metadata).forEach((rawAttribute) => {
    if (!rawAttribute || typeof rawAttribute !== "object") {
      return;
    }

    const attribute = rawAttribute as Record<string, unknown>;
    const trait = normalizeAttributeValue(
      attribute.trait_type ?? attribute.traitName ?? attribute.name,
    );
    const value = normalizeAttributeValue(attribute.value ?? attribute.traitValue);

    if (!trait || !value) {
      return;
    }

    const values = grouped.get(trait) ?? [];
    if (!values.includes(value)) {
      values.push(value);
    }
    grouped.set(trait, values);
  });

  return Array.from(grouped.entries()).map(([trait, values]) => ({
    trait,
    value: values.join(", "),
  }));
}

export function traitValues(metadata: unknown, traitName: string) {
  const values = new Set<string>();

  rawAttributes(metadata).forEach((rawAttribute) => {
    if (!rawAttribute || typeof rawAttribute !== "object") {
      return;
    }

    const attribute = rawAttribute as Record<string, unknown>;
    const trait = normalizeAttributeValue(
      attribute.trait_type ?? attribute.traitName ?? attribute.name,
    );
    const value = normalizeAttributeValue(attribute.value ?? attribute.traitValue);

    if (trait === traitName && value) {
      values.add(value);
    }
  });

  return Array.from(values);
}

export function realmResources(metadata: unknown) {
  return traitValues(metadata, "Resource").sort((left, right) => {
    const leftIndex = REALM_RESOURCE_ORDER_INDEX.get(normalizeResourceName(left));
    const rightIndex = REALM_RESOURCE_ORDER_INDEX.get(normalizeResourceName(right));

    if (leftIndex !== undefined && rightIndex !== undefined) {
      return leftIndex - rightIndex;
    }
    if (leftIndex !== undefined) {
      return -1;
    }
    if (rightIndex !== undefined) {
      return 1;
    }

    return left.localeCompare(right);
  });
}

export function realmResourceCount(metadata: unknown) {
  return realmResources(metadata).length;
}
