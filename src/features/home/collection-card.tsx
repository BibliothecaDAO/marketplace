import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { useCollectionTokensQuery } from "@/lib/marketplace/hooks";
import { tokenImage } from "@/lib/marketplace/token-display";
import type { CollectionCardData } from "@/features/home/types";

type CollectionCardProps = CollectionCardData;

const PREVIEW_QUERY_STALE_TIME_MS = 5 * 60 * 1000;

export function CollectionCard({
  address,
  name,
  projectId,
  imageUrl,
  floorPrice,
  totalSupply,
  listingCount,
}: CollectionCardProps) {
  const [cardElement, setCardElement] = useState<HTMLDivElement | null>(null);
  const [previewRequested, setPreviewRequested] = useState(false);

  useEffect(() => {
    if (imageUrl || previewRequested || !cardElement) {
      return;
    }

    if (typeof IntersectionObserver === "undefined") {
      return;
    }

    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) {
        return;
      }

      setPreviewRequested(true);
      observer.disconnect();
    }, {
      rootMargin: "200px",
    });

    observer.observe(cardElement);

    return () => observer.disconnect();
  }, [cardElement, imageUrl, previewRequested]);

  const previewTokensQuery = useCollectionTokensQuery(
    {
      address,
      project: projectId,
      limit: 12,
      fetchImages: true,
    },
    {
      enabled: !imageUrl && previewRequested,
      staleTime: PREVIEW_QUERY_STALE_TIME_MS,
    },
  );

  const resolvedImageUrl = useMemo(() => {
    if (imageUrl) {
      return imageUrl;
    }

    const tokens = previewTokensQuery.data?.page?.tokens ?? [];
    for (const token of tokens) {
      const image = tokenImage(token);
      if (image) {
        return image;
      }
    }

    return null;
  }, [imageUrl, previewTokensQuery.data?.page?.tokens]);

  return (
    <Link
      href={`/collections/${address}`}
      aria-label={`Open ${name}`}
      onFocus={() => setPreviewRequested(true)}
      onMouseEnter={() => setPreviewRequested(true)}
    >
      <div ref={setCardElement}>
        <Card className="overflow-hidden py-0 transition-colors hover:border-primary/40">
          <div className="aspect-square bg-muted">
            {resolvedImageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                alt={`${name} preview`}
                src={resolvedImageUrl}
                className="h-full w-full object-cover"
              />
            ) : (
              <div
                data-testid="collection-card-image-fallback"
                className="flex h-full w-full items-center justify-center bg-gradient-to-br from-muted via-muted/60 to-accent/50"
              >
                <span className="text-xs text-muted-foreground">No image</span>
              </div>
            )}
          </div>
          <CardContent className="space-y-1 px-3 py-3">
            <p className="truncate text-sm font-medium">{name}</p>
            {floorPrice ? (
              <p className="text-xs text-muted-foreground">Floor {floorPrice}</p>
            ) : null}
            {totalSupply ? (
              <p className="text-xs text-muted-foreground">Items {totalSupply}</p>
            ) : null}
            {listingCount ? (
              <p className="text-xs text-muted-foreground">Listed {listingCount}</p>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </Link>
  );
}
