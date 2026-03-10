import { HydrationBoundary } from "@tanstack/react-query";
import { WalletProfileView } from "@/features/profile/wallet-profile-view";
import { buildWalletProfileHydrationState } from "@/lib/marketplace/server-prefetch";

type ProfilePageProps = {
  params: Promise<{ address: string }>;
};

export default async function ProfilePage({ params }: ProfilePageProps) {
  const { address } = await params;
  const { state } = await buildWalletProfileHydrationState(address);

  return (
    <HydrationBoundary state={state}>
      <main className="mx-auto flex min-h-[calc(100vh-3.5rem)] w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
        <WalletProfileView address={address} />
      </main>
    </HydrationBoundary>
  );
}
