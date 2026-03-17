export function normalizeMarketplaceAddress(address: string) {
  const trimmed = address.trim().toLowerCase();
  if (!trimmed) {
    return "";
  }

  if (!/^0x[0-9a-f]+$/.test(trimmed)) {
    return trimmed;
  }

  try {
    return `0x${BigInt(trimmed).toString(16)}`;
  } catch {
    return trimmed;
  }
}
