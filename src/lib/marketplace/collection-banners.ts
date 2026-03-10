const COLLECTION_BANNERS_BY_NAME: Record<string, string> = {
  adventurers: "/banners/adventurers.svg",
  beasts: "/banners/beasts.svg",
};

function asNonEmptyString(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeImageUrl(value: unknown) {
  const source = asNonEmptyString(value);
  if (!source) {
    return null;
  }

  if (/^https?:\/\//i.test(source)) {
    return source;
  }

  if (source.startsWith("ipfs://")) {
    return `https://ipfs.io/ipfs/${source.slice("ipfs://".length)}`;
  }

  return null;
}

export function getCollectionBannerImage(name: string | null | undefined) {
  if (!name) {
    return null;
  }

  return COLLECTION_BANNERS_BY_NAME[name.trim().toLowerCase()] ?? null;
}

export function getCollectionMetadataImage(collection: unknown) {
  if (!collection || typeof collection !== "object") {
    return null;
  }

  const fields = collection as Record<string, unknown>;
  const metadata =
    fields.metadata && typeof fields.metadata === "object"
      ? (fields.metadata as Record<string, unknown>)
      : null;

  return (
    normalizeImageUrl(fields.image) ??
    normalizeImageUrl(metadata?.image) ??
    normalizeImageUrl(metadata?.image_url)
  );
}
