"use client";

import { useBalance } from "@starknet-react/core";

function trimBalance(formatted: string | undefined): string | undefined {
  if (!formatted) return undefined;
  const num = parseFloat(formatted);
  if (isNaN(num)) return formatted;
  // Show up to 4 decimal places, strip trailing zeros
  return num.toLocaleString("en-US", { maximumFractionDigits: 4, useGrouping: false });
}

const STRK_ADDRESS = "0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d" as `0x${string}`;
const LORDS_ADDRESS = "0x0124aeb495b947201f5fac96fd1138e326ad86195b98df6dec9009158a533b49" as `0x${string}`;
const SURVIVOR_ADDRESS = "0x42dd777885ad2c116be96d4d634abc90a26a790ffb5871e037dd5ae7d2ec86b" as `0x${string}`;

export const WALLET_TOKEN_ADDRESSES = {
  strk: STRK_ADDRESS,
  lords: LORDS_ADDRESS,
  survivor: SURVIVOR_ADDRESS,
} as const;

export function useWalletBalances(address: string | undefined) {
  const enabled = !!address;
  const addr = address as `0x${string}` | undefined;

  const strk = useBalance({ address: addr, token: STRK_ADDRESS, enabled });
  const lords = useBalance({ address: addr, token: LORDS_ADDRESS, enabled });
  const survivor = useBalance({ address: addr, token: SURVIVOR_ADDRESS, enabled });

  return {
    strk: { formatted: trimBalance(strk.data?.formatted), isLoading: strk.isLoading },
    lords: { formatted: trimBalance(lords.data?.formatted), isLoading: lords.isLoading },
    survivor: { formatted: trimBalance(survivor.data?.formatted), isLoading: survivor.isLoading },
  };
}
