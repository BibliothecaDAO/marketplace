import type { Metadata } from "next";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockGetTokenSeoData } = vi.hoisted(() => ({
  mockGetTokenSeoData: vi.fn(),
}));

vi.mock("@/lib/marketplace/seo-data", () => ({
  getTokenSeoData: mockGetTokenSeoData,
}));

vi.mock("@/features/token/token-detail-view", () => ({
  TokenDetailView: () => null,
}));

describe("token page metadata", () => {
  beforeEach(() => {
    mockGetTokenSeoData.mockReset();
    process.env.NEXT_PUBLIC_SITE_URL = "https://market.realms.world";
  });

  it("sets_dynamic_metadata_with_token_image", async () => {
    mockGetTokenSeoData.mockResolvedValue({
      exists: true,
      tokenName: "Dragon #42",
      collectionName: "Genesis",
      description: "View listings and activity for Dragon #42.",
      image: "https://cdn.example.com/token-42.png",
      collectionImage: "https://cdn.example.com/collection.png",
    });

    const { generateMetadata } = await import("@/app/collections/[address]/[tokenId]/page");
    const metadata = (await generateMetadata({
      params: Promise.resolve({ address: "0xabc", tokenId: "42" }),
    })) as Metadata;

    expect(metadata.title).toBe("Dragon #42 | Genesis | Realms.market");
    expect(metadata.description).toBe("View listings and activity for Dragon #42.");
    expect(metadata.alternates?.canonical).toBe("https://market.realms.world/collections/0xabc/42");
    expect(metadata.openGraph?.images).toEqual(["https://cdn.example.com/token-42.png"]);
    expect(metadata.twitter?.images).toEqual(["https://cdn.example.com/token-42.png"]);
    expect(metadata.robots).toEqual({ index: true, follow: true });
  });

  it("falls_back_to_collection_image_when_token_image_missing", async () => {
    mockGetTokenSeoData.mockResolvedValue({
      exists: true,
      tokenName: "Dragon #7",
      collectionName: "Genesis",
      description: "View listings and activity for Dragon #7.",
      image: null,
      collectionImage: "https://cdn.example.com/collection.png",
    });

    const { generateMetadata } = await import("@/app/collections/[address]/[tokenId]/page");
    const metadata = (await generateMetadata({
      params: Promise.resolve({ address: "0xabc", tokenId: "7" }),
    })) as Metadata;

    expect(metadata.openGraph?.images).toEqual(["https://cdn.example.com/collection.png"]);
    expect(metadata.twitter?.images).toEqual(["https://cdn.example.com/collection.png"]);
  });

  it("falls_back_to_generated_og_image_and_noindex_when_token_missing", async () => {
    mockGetTokenSeoData.mockResolvedValue({
      exists: false,
      tokenName: "Token #999",
      collectionName: "Genesis",
      description: null,
      image: null,
      collectionImage: null,
    });

    const { generateMetadata } = await import("@/app/collections/[address]/[tokenId]/page");
    const metadata = (await generateMetadata({
      params: Promise.resolve({ address: "0xabc", tokenId: "999" }),
    })) as Metadata;

    expect(metadata.title).toBe("Token #999 | Genesis | Realms.market");
    expect(metadata.openGraph?.images).toEqual([
      "https://market.realms.world/collections/0xabc/999/opengraph-image",
    ]);
    expect(metadata.twitter?.images).toEqual([
      "https://market.realms.world/collections/0xabc/999/opengraph-image",
    ]);
    expect(metadata.robots).toEqual({ index: false, follow: false });
  });
});
