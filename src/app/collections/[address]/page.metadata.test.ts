import type { Metadata } from "next";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockGetCollectionSeoData } = vi.hoisted(() => ({
  mockGetCollectionSeoData: vi.fn(),
}));

vi.mock("@/lib/marketplace/seo-data", () => ({
  getCollectionSeoData: mockGetCollectionSeoData,
}));

vi.mock("@/features/collections/collection-route-container", () => ({
  CollectionRouteContainer: () => null,
}));

describe("collection page metadata", () => {
  beforeEach(() => {
    mockGetCollectionSeoData.mockReset();
    process.env.NEXT_PUBLIC_SITE_URL = "https://market.realms.world";
  });

  it("sets_dynamic_metadata_with_collection_image", async () => {
    mockGetCollectionSeoData.mockResolvedValue({
      exists: true,
      name: "Genesis",
      description: "Genesis artifacts marketplace",
      image: "https://cdn.example.com/genesis.png",
    });

    const { generateMetadata } = await import("@/app/collections/[address]/page");
    const metadata = (await generateMetadata({
      params: Promise.resolve({ address: "0xabc" }),
      searchParams: Promise.resolve({}),
    })) as Metadata;

    expect(metadata.title).toBe("Genesis | Realms.market");
    expect(metadata.description).toBe("Genesis artifacts marketplace");
    expect(metadata.alternates?.canonical).toBe("https://market.realms.world/collections/0xabc");
    expect(metadata.openGraph?.images).toEqual(["https://cdn.example.com/genesis.png"]);
    expect(metadata.twitter?.images).toEqual(["https://cdn.example.com/genesis.png"]);
    expect(metadata.robots).toEqual({ index: true, follow: true });
  });

  it("falls_back_to_generated_og_image_and_noindex_when_collection_missing", async () => {
    mockGetCollectionSeoData.mockResolvedValue({
      exists: false,
      name: "0x404",
      description: null,
      image: null,
    });

    const { generateMetadata } = await import("@/app/collections/[address]/page");
    const metadata = (await generateMetadata({
      params: Promise.resolve({ address: "0x404" }),
      searchParams: Promise.resolve({}),
    })) as Metadata;

    expect(metadata.title).toBe("Collection 0x404 | Realms.market");
    expect(metadata.openGraph?.images).toEqual([
      "https://market.realms.world/collections/0x404/opengraph-image",
    ]);
    expect(metadata.twitter?.images).toEqual([
      "https://market.realms.world/collections/0x404/opengraph-image",
    ]);
    expect(metadata.robots).toEqual({ index: false, follow: false });
  });
});
