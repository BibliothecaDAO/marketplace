import type { NormalizedToken } from "@cartridge/arcade/marketplace";

export type SidebarCollection = {
  address: string;
  name: string;
  projectId?: string;
  imageUrl?: string | null;
  floorPrice?: string | null;
};

export type FeaturedCollection = {
  address: string;
  name: string;
  projectId?: string;
  imageUrl?: string | null;
  floorPrice?: string | null;
  totalSupply?: string | null;
  listingCount?: string | null;
};

export type TrendingToken = {
  token: NormalizedToken;
  href: string;
  price?: string | null;
  currency?: string | null;
};

export type CollectionCardData = {
  address: string;
  name: string;
  projectId?: string;
  imageUrl?: string | null;
  floorPrice?: string | null;
  totalSupply?: string | null;
  listingCount?: string | null;
};
