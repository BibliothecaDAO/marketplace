import { useMemo } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { useCollectionTokensQuery } from "@/lib/marketplace/hooks";
import { tokenImage } from "@/lib/marketplace/token-display";
import type { CollectionCardData } from "@/features/home/types";

type CollectionCardProps = CollectionCardData;

export function CollectionCard({
  address,
  name,
  projectId,
  imageUrl,
  floorPrice,
  totalSupply,
  listingCount,
}: CollectionCardProps) {
  const previewTokensQuery = useCollectionTokensQuery(
    {
      address,
      project: projectId,
      limit: 12,
      fetchImages: true,
    },
    { enabled: !imageUrl },
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
    <Link href={`/collections/${address}`} aria-label={`Open ${name}`}>
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
    </Link>
  );
}
