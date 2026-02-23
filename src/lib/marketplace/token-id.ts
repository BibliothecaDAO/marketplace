export type CanonicalTokenId = {
  decimal: string;
  hex: string;
  value: bigint;
};

const PADDED_TOKEN_ID_HEX_LENGTH = 64;

function parseTokenIdValue(input: string): bigint | null {
  const trimmed = input.trim();
  if (!trimmed) {
    return null;
  }

  if (/^0x[0-9a-fA-F]+$/.test(trimmed)) {
    return BigInt(trimmed);
  }

  if (/^\d+$/.test(trimmed)) {
    return BigInt(trimmed);
  }

  if (/^[0-9a-fA-F]+$/.test(trimmed) && /[a-fA-F]/.test(trimmed)) {
    return BigInt(`0x${trimmed}`);
  }

  return null;
}

export function canonicalizeTokenId(rawTokenId: string): CanonicalTokenId | null {
  const value = parseTokenIdValue(rawTokenId);
  if (value === null) {
    return null;
  }

  return {
    decimal: value.toString(10),
    hex: `0x${value.toString(16)}`,
    value,
  };
}

export function normalizeCollectionTokenId(rawTokenId: string): string | null {
  const trimmed = rawTokenId.trim();
  if (!trimmed) {
    return null;
  }

  const scopedIndex = trimmed.lastIndexOf(":");
  const candidate = scopedIndex >= 0 ? trimmed.slice(scopedIndex + 1).trim() : trimmed;
  if (!candidate) {
    return null;
  }

  const canonical = canonicalizeTokenId(candidate);
  if (canonical) {
    return canonical.decimal;
  }

  return candidate;
}

export function alternateTokenId(rawTokenId: string): string | null {
  const trimmed = rawTokenId.trim();
  if (!trimmed) {
    return null;
  }

  const canonical = canonicalizeTokenId(trimmed);
  if (!canonical) {
    return null;
  }

  if (/^\d+$/.test(trimmed)) {
    return canonical.hex;
  }

  return canonical.decimal;
}

export function expandTokenIdVariants(tokenIds: Iterable<string>): string[] {
  const canonicalByDecimal = new Map<string, CanonicalTokenId>();
  const rawUnparsed = new Set<string>();

  for (const rawTokenId of tokenIds) {
    const trimmed = rawTokenId.trim();
    if (!trimmed) {
      continue;
    }

    const canonical = canonicalizeTokenId(trimmed);
    if (canonical) {
      canonicalByDecimal.set(canonical.decimal, canonical);
      continue;
    }

    rawUnparsed.add(trimmed);
  }

  const orderedCanonical = Array.from(canonicalByDecimal.values()).sort(
    (left, right) => (left.value < right.value ? -1 : left.value > right.value ? 1 : 0),
  );
  const orderedRawUnparsed = Array.from(rawUnparsed).sort((left, right) =>
    left.localeCompare(right),
  );

  return [
    ...orderedCanonical.flatMap((canonical) => [canonical.decimal, canonical.hex]),
    ...orderedRawUnparsed,
  ];
}

export function expandTokenIdQueryVariants(tokenIds: Iterable<string>): string[] {
  const canonicalByDecimal = new Map<string, CanonicalTokenId>();
  const rawUnparsed = new Set<string>();

  for (const rawTokenId of tokenIds) {
    const trimmed = rawTokenId.trim();
    if (!trimmed) {
      continue;
    }

    const canonical = canonicalizeTokenId(trimmed);
    if (canonical) {
      canonicalByDecimal.set(canonical.decimal, canonical);
      continue;
    }

    rawUnparsed.add(trimmed);
  }

  const orderedCanonical = Array.from(canonicalByDecimal.values()).sort(
    (left, right) => (left.value < right.value ? -1 : left.value > right.value ? 1 : 0),
  );
  const orderedRawUnparsed = Array.from(rawUnparsed).sort((left, right) =>
    left.localeCompare(right),
  );

  const expanded: string[] = [];
  const seen = new Set<string>();

  function pushUnique(value: string) {
    if (!value || seen.has(value)) {
      return;
    }

    seen.add(value);
    expanded.push(value);
  }

  for (const canonical of orderedCanonical) {
    const unprefixedHex = canonical.hex.startsWith("0x")
      ? canonical.hex.slice(2)
      : canonical.hex;
    const paddedHex = canonical.value
      .toString(16)
      .padStart(PADDED_TOKEN_ID_HEX_LENGTH, "0");

    pushUnique(canonical.decimal);
    pushUnique(canonical.hex);
    pushUnique(unprefixedHex);
    pushUnique(`0x${paddedHex}`);
    pushUnique(paddedHex);
  }

  for (const raw of orderedRawUnparsed) {
    pushUnique(raw);
  }

  return expanded;
}
