export type MarketActivityDetail = {
  label: string | null;
  value: string;
};

export type MarketActivityConfig = {
  details: Array<{
    label?: string;
    traitNames: string[];
    mode?: "first" | "all";
  }>;
};

function asRecord(value: unknown) {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : null;
}

function normalizeValue(value: unknown) {
  if (value === null || value === undefined) {
    return "";
  }

  return String(value).trim();
}

function getTokenAttributes(token: unknown) {
  const tokenRecord = asRecord(token);
  const metadata = tokenRecord?.metadata;
  const metadataRecord = asRecord(metadata);
  const attributes = metadataRecord?.attributes;
  return Array.isArray(attributes) ? attributes : [];
}

function matchingTraitValues(token: unknown, traitNames: string[]) {
  const acceptedNames = new Set(
    traitNames.map((traitName) => normalizeValue(traitName)).filter(Boolean),
  );
  if (acceptedNames.size === 0) {
    return [];
  }

  return getTokenAttributes(token).flatMap((rawAttribute) => {
    const attribute = asRecord(rawAttribute);
    if (!attribute) {
      return [];
    }

    const traitName = normalizeValue(
      attribute.trait_type ?? attribute.traitName ?? attribute.name,
    );
    if (!acceptedNames.has(traitName)) {
      return [];
    }

    const value = normalizeValue(attribute.value ?? attribute.traitValue);
    return value ? [value] : [];
  });
}

export function resolveMarketActivityDetails(
  token: unknown,
  config: MarketActivityConfig | undefined,
): MarketActivityDetail[] {
  if (!config) {
    return [];
  }

  return config.details.flatMap((detail) => {
    const values = matchingTraitValues(token, detail.traitNames);
    if (values.length === 0) {
      return [];
    }

    if (detail.mode === "all") {
      return Array.from(new Set(values)).map((value) => ({
        label: detail.label ?? null,
        value,
      }));
    }

    return [{
      label: detail.label ?? null,
      value: values[0],
    }];
  });
}
