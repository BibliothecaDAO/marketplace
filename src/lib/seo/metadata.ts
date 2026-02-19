import type { Metadata } from "next";
import { toAbsoluteUrl } from "@/lib/seo/site-url";

type BuildMetadataOptions = {
  title: string;
  description: string;
  pathname: string;
  image: string;
  noIndex?: boolean;
};

function resolveImageUrl(image: string) {
  if (/^https?:\/\//i.test(image)) {
    return image;
  }

  return toAbsoluteUrl(image);
}

export function buildMarketplacePageMetadata({
  title,
  description,
  pathname,
  image,
  noIndex = false,
}: BuildMetadataOptions): Metadata {
  const canonical = toAbsoluteUrl(pathname);
  const imageUrl = resolveImageUrl(image);

  return {
    title,
    description,
    alternates: {
      canonical,
    },
    openGraph: {
      title,
      description,
      type: "website",
      url: canonical,
      siteName: "Realms.market",
      images: [imageUrl],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [imageUrl],
    },
    robots: {
      index: !noIndex,
      follow: !noIndex,
    },
  };
}
