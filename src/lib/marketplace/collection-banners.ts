const COLLECTION_BANNERS_BY_NAME: Record<string, string> = {
  adventurers: "/banners/adventurers.svg",
  beasts: "/banners/beasts.svg",
};

export function getCollectionBannerImage(name: string | null | undefined) {
  if (!name) {
    return null;
  }

  return COLLECTION_BANNERS_BY_NAME[name.trim().toLowerCase()] ?? null;
}
