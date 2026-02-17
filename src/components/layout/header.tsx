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
    <header className="sticky top-0 z-50 w-full border-b border-border/80 bg-background/95 backdrop-blur-sm">
      <div className="flex h-14 items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2">
          <span
            data-testid="logo-placeholder"
            className="flex h-7 w-7 items-center justify-center rounded-sm border border-primary/40 bg-primary/10 text-xs font-bold text-primary"
          >
            {">_"}
          </span>
          <span className="text-sm font-medium tracking-widest uppercase text-foreground">Biblio</span>
        </Link>

        <div className="flex items-center gap-2">
          {isConnected && address ? (
            <span
              data-testid="wallet-address"
              className="hidden rounded-sm bg-muted/50 px-2 py-0.5 text-xs text-primary font-mono sm:inline"
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
