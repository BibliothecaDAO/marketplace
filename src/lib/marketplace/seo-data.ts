import { cache } from "react";
import { unstable_cache } from "next/cache";
import { getMarketplaceApiClient } from "@/lib/marketplace/api-client";
import { getMarketplaceRuntimeConfig } from "@/lib/marketplace/config";

const COLLECTION_CACHE_REVALIDATE_SECONDS = 300;
const TOKEN_CACHE_REVALIDATE_SECONDS = 60;

type CollectionSeoData = {
  exists: boolean;
  name: string;
  description: string | null;
  image: string | null;
};

type TokenSeoData = {
  exists: boolean;
  tokenName: string;
  collectionName: string;
  description: string | null;
  image: string | null;
  collectionImage: string | null;
};

function collectionFallbackName(address: string) {
  return getMarketplaceRuntimeConfig().collections.find(
    (collection) => collection.address.toLowerCase() === address.toLowerCase(),
  )?.name ?? address;
}

function imageUrl(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const source = value.trim();
  if (/^https?:\/\//i.test(source)) return source;
  if (source.startsWith("ipfs://")) {
    return `https://ipfs.io/ipfs/${source.slice("ipfs://".length)}`;
  }
  return null;
}

async function collectionUncached(address: string): Promise<CollectionSeoData> {
  const fallbackName = collectionFallbackName(address);
  try {
    const { data } = await getMarketplaceApiClient().collection(address);
    return {
      exists: true,
      name: data.name || fallbackName,
      description: data.description ?? null,
      image: imageUrl(data.image ?? data.bannerImage),
    };
  } catch {
    return { exists: false, name: fallbackName, description: null, image: null };
  }
}

const collectionCached = unstable_cache(collectionUncached, ["owned-seo-collection"], {
  revalidate: COLLECTION_CACHE_REVALIDATE_SECONDS,
});
const collectionData = cache((address: string) => collectionCached(address));

async function tokenUncached(address: string, rawTokenId: string): Promise<TokenSeoData> {
  const fallbackCollectionName = collectionFallbackName(address);
  let tokenId: string;
  try {
    tokenId = BigInt(rawTokenId).toString();
  } catch {
    return {
      exists: false,
      tokenName: `Token #${rawTokenId}`,
      collectionName: fallbackCollectionName,
      description: null,
      image: null,
      collectionImage: null,
    };
  }

  const [collectionResult, tokenResult] = await Promise.allSettled([
    getMarketplaceApiClient().collection(address),
    getMarketplaceApiClient().token(address, tokenId),
  ]);
  const collection = collectionResult.status === "fulfilled" ? collectionResult.value.data : null;
  const token = tokenResult.status === "fulfilled" ? tokenResult.value.data : null;
  const collectionName = collection?.name || fallbackCollectionName;
  const collectionImage = imageUrl(collection?.image ?? collection?.bannerImage);
  if (!token) {
    return {
      exists: false,
      tokenName: `Token #${rawTokenId}`,
      collectionName,
      description: null,
      image: null,
      collectionImage,
    };
  }
  return {
    exists: true,
    tokenName: token.name,
    collectionName,
    description: token.description ?? `View listings and activity for ${token.name}.`,
    image: imageUrl(token.image),
    collectionImage,
  };
}

const tokenCached = unstable_cache(tokenUncached, ["owned-seo-token"], {
  revalidate: TOKEN_CACHE_REVALIDATE_SECONDS,
});
const tokenData = cache((address: string, tokenId: string) => tokenCached(address, tokenId));

export function getCollectionSeoData(address: string): Promise<CollectionSeoData> {
  return collectionData(address);
}

export function getTokenSeoData(address: string, tokenId: string): Promise<TokenSeoData> {
  return tokenData(address, tokenId);
}
