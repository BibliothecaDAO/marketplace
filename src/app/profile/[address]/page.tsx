import { WalletProfileView } from "@/features/profile/wallet-profile-view";

type ProfilePageProps = {
  params: Promise<{ address: string }>;
};

export default async function ProfilePage({ params }: ProfilePageProps) {
  const { address } = await params;
  return <WalletProfileView address={address} />;
}
