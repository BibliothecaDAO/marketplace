import { TokenDetailView } from "@/features/token/token-detail-view";

type TokenPageProps = {
  params: Promise<{ address: string; tokenId: string }>;
};

export default async function TokenPage({ params }: TokenPageProps) {
  const { address, tokenId } = await params;

  return (
    <main className="w-full px-4 py-6 sm:px-6 lg:px-8">
      <TokenDetailView address={address} tokenId={tokenId} />
    </main>
  );
}
