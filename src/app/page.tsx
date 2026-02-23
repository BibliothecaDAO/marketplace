import { Suspense } from "react";
import { MarketplaceHome } from "@/components/marketplace/marketplace-home";

export default function Home() {
  return (
    <Suspense fallback={null}>
      <MarketplaceHome />
    </Suspense>
  );
}
