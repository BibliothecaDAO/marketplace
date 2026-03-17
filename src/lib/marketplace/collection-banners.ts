const COLLECTION_BANNERS_BY_NAME: Record<string, string> = {
  adventurers: "/banners/adventurers.png",
  beasts: "/banners/beasts.jpg",
};

export function getCollectionBannerImage(name: string | null | undefined) {
  if (!name) {
    return null;
  }

  return COLLECTION_BANNERS_BY_NAME[name.trim().toLowerCase()] ?? null;
}
