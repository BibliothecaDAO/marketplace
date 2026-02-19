import { useMemo } from "react";
import {
  useTokenHolderQuery,
  useTokenOwnershipQuery,
} from "@/lib/marketplace/hooks";

type UseTokenOwnershipParams = {
  collection: string;
  tokenId: string;
  walletAddress: string | undefined;
  isConnected: boolean;
};

type BalancePage<T> = { page?: { balances?: T[] } };

export function useTokenOwnership({
  collection,
  tokenId,
  walletAddress,
  isConnected,
}: UseTokenOwnershipParams) {
  const ownershipQuery = useTokenOwnershipQuery({
    collection,
    tokenId,
    accountAddress: walletAddress,
  });

  const holderQuery = useTokenHolderQuery({ collection, tokenId });

  const holderAddress = useMemo(() => {
    const balances =
      (holderQuery.data as BalancePage<{ account_address: string; balance: string }> | null)
        ?.page?.balances ?? [];
    const holder = balances.find((b) => {
      try {
        return BigInt(b.balance) > BigInt(0);
      } catch {
        return false;
      }
    });
    return holder?.account_address ?? null;
  }, [holderQuery.data]);

  const isOwner = useMemo(() => {
    if (!walletAddress || !isConnected) return false;
    const balances =
      (ownershipQuery.data as BalancePage<{ balance: string }> | null)
        ?.page?.balances ?? [];
    return balances.some((b) => {
      try {
        return BigInt(b.balance) > BigInt(0);
      } catch {
        return false;
      }
    });
  }, [ownershipQuery.data, walletAddress, isConnected]);

  const effectiveIsOwner = useMemo(() => {
    if (holderAddress === null) return isOwner;
    if (walletAddress === undefined) return false;
    try {
      return BigInt(holderAddress) === BigInt(walletAddress);
    } catch {
      return holderAddress.toLowerCase() === walletAddress.toLowerCase();
    }
  }, [holderAddress, walletAddress, isOwner]);

  return { holderAddress, isOwner, effectiveIsOwner, ownershipQuery, holderQuery };
}
