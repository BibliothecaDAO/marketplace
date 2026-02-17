"use client";

import Link from "next/link";
import { useAccount, useConnect, useDisconnect } from "@starknet-react/core";
import { Button } from "@/components/ui/button";

function formatAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function Header() {
  const { address, isConnected } = useAccount();
  const { connect, connectors, isPending: isConnecting } = useConnect();
  const { disconnect, isPending: isDisconnecting } = useDisconnect();

  const controllerConnector = connectors.find(
    (connector) => connector.id === "controller",
  );
  const selectedConnector = controllerConnector ?? connectors[0];
  const isBusy = isConnecting || isDisconnecting;

  const handleConnect = async () => {
    if (!selectedConnector) {
      return;
    }

    try {
      await connect({ connector: selectedConnector });
    } catch (error) {
      console.error("Failed to connect wallet", error);
    }
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background">
      <div className="flex h-14 items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2">
          <div
            data-testid="logo-placeholder"
            className="h-8 w-8 rounded bg-muted"
          />
          <span className="text-lg font-semibold">Biblio</span>
        </Link>

        <div className="flex items-center gap-2">
          {isConnected && address ? (
            <span
              data-testid="wallet-address"
              className="hidden text-xs text-muted-foreground sm:inline"
            >
              {formatAddress(address)}
            </span>
          ) : null}

          {isConnected ? (
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => disconnect()}
              disabled={isBusy}
            >
              Disconnect
            </Button>
          ) : (
            <Button
              type="button"
              size="sm"
              onClick={handleConnect}
              disabled={!selectedConnector || isBusy}
            >
              Login
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
