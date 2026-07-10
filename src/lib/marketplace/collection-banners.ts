const COLLECTION_BANNERS_BY_NAME: Record<string, string> = {
  adventurers: "/banners/adventurers.png",
  beasts: "/banners/beasts.jpg",
  "golden token": "/banners/golden-token.png",
  "loot chests": "/banners/loot-chests.png",
  realms: "/banners/realms.png",
};

export function getCollectionBannerImage(name: string | null | undefined) {
  if (!name) {
    return null;
  }

  return COLLECTION_BANNERS_BY_NAME[name.trim().toLowerCase()] ?? null;
}
