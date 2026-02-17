import { CollectionRouteContainer } from "@/features/collections/collection-route-container";

type CollectionPageProps = {
  params: Promise<{ address: string }>;
  searchParams: Promise<{ cursor?: string }>;
};

export default async function CollectionPage({
  params,
  searchParams,
}: CollectionPageProps) {
  const { address } = await params;
  const { cursor } = await searchParams;

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-4xl items-start px-4 py-10 sm:px-8">
      <CollectionRouteContainer address={address} cursor={cursor ?? null} />
    </main>
  );
}
