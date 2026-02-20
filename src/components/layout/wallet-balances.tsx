"use client";

import { useWalletBalances, WALLET_TOKEN_ADDRESSES } from "@/lib/marketplace/use-wallet-balances";
import { getTokenIconUrl, getTokenSymbol } from "@/lib/marketplace/token-display";

const BALANCE_TOKENS = [
  { key: "strk", address: WALLET_TOKEN_ADDRESSES.strk },
  { key: "lords", address: WALLET_TOKEN_ADDRESSES.lords },
  { key: "survivor", address: WALLET_TOKEN_ADDRESSES.survivor },
] as const;

type BalanceKey = (typeof BALANCE_TOKENS)[number]["key"];

type WalletBalancesProps = {
  walletAddress: string;
};

export function WalletBalances({ walletAddress }: WalletBalancesProps) {
  const balances = useWalletBalances(walletAddress);

  return (
    <div className="px-1 py-1.5 space-y-0.5">
      <p className="text-[10px] font-semibold tracking-widest uppercase text-muted-foreground px-1 pb-1">
        Balances
      </p>
      {BALANCE_TOKENS.map(({ key, address }) => {
        const balance = balances[key as BalanceKey];
        const iconUrl = getTokenIconUrl(address);
        const symbol = getTokenSymbol(address);
        const displayBalance = balance.formatted ?? (balance.isLoading ? "…" : "—");

        return (
          <div
            key={address}
            className="flex items-center justify-between gap-4 rounded-sm px-1 py-1 hover:bg-muted/40"
          >
            <div className="flex items-center gap-2">
              {iconUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  alt={symbol}
                  className="h-4 w-4 rounded-full object-cover shrink-0"
                  src={iconUrl}
                />
              ) : (
                <span className="h-4 w-4 flex items-center justify-center rounded-full bg-primary/20 text-[8px] font-bold text-primary shrink-0">
                  {symbol[0]}
                </span>
              )}
              <span className="text-xs font-medium">{symbol}</span>
            </div>
            <span className="text-xs text-muted-foreground font-mono tabular-nums">
              {displayBalance}
            </span>
          </div>
        );
      })}
    </div>
  );
}
