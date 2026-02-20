"use client";

import Link from "next/link";
import { useState } from "react";
import { useAccount, useConnect, useDisconnect } from "@starknet-react/core";
import { Github, Menu, MessageSquare, Twitter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CartSidebar } from "@/features/cart/components/cart-sidebar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

function formatAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function connectorLabel(connector: { id: string; name?: string }) {
  if (connector.name && connector.name.trim().length > 0) {
    return connector.name;
  }

  return connector.id;
}

const NAV_LINKS = [
  { label: "Staking", href: "https://account.realms.world" },
  { label: "Ecosystem", href: "https://realms.world" },
  { label: "Eternum", href: "https://blitz.realms.world" },
] as const;

const SOCIAL_LINKS = [
  { label: "Twitter / X", href: "https://x.com/lootrealms", Icon: Twitter },
  { label: "Discord", href: "https://discord.gg/realmsworld", Icon: MessageSquare },
  { label: "GitHub", href: "https://github.com/bibliothecaDAO", Icon: Github },
] as const;

export function Header() {
  const { address, isConnected } = useAccount();
  const { connect, connectors, isPending: isConnecting } = useConnect();
  const { disconnect, isPending: isDisconnecting } = useDisconnect();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [walletModalOpen, setWalletModalOpen] = useState(false);

  const isBusy = isConnecting || isDisconnecting;

  const handleConnect = async (connector: (typeof connectors)[number]) => {
    try {
      await connect({ connector });
      setWalletModalOpen(false);
    } catch (error) {
      console.error("Failed to connect wallet", error);
    }
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/80 bg-background/95 backdrop-blur-sm">
      <div className="flex h-14 items-center justify-between px-4">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 shrink-0" aria-label="Realms.market home">
          <span
            data-testid="logo-placeholder"
            className="flex h-7 w-7 items-center justify-center rounded-sm border border-primary/40 bg-primary/10 text-xs font-bold text-primary"
          >
            R
          </span>
          <span className="text-sm font-medium tracking-widest uppercase text-foreground">Realms.market</span>
        </Link>

        {/* Desktop nav */}
        <nav aria-label="Main navigation" className="hidden md:flex items-center gap-1">
          {NAV_LINKS.map(({ label, href }) => (
            <a
              key={label}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              {label}
            </a>
          ))}
        </nav>

        {/* Right side actions */}
        <div className="flex items-center gap-2">
          {/* Social icons */}
          <div className="hidden sm:flex items-center gap-1 mr-1">
            {SOCIAL_LINKS.map(({ label, href, Icon }) => (
              <a
                key={label}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={label}
                className="flex h-8 w-8 items-center justify-center rounded-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <Icon className="h-4 w-4" />
              </a>
            ))}
          </div>

          <CartSidebar />
          <Button size="sm" variant="ghost" asChild>
            <Link href="/portfolio">Portfolio</Link>
          </Button>

          {isConnected && address ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  data-testid="wallet-address"
                  type="button"
                  className="hidden sm:inline-flex rounded-sm bg-muted/50 px-2 py-0.5 text-xs text-primary font-mono hover:bg-muted transition-colors cursor-pointer"
                >
                  {formatAddress(address)}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem asChild>
                  <Link href={`/profile/${address}`}>Profile</Link>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => disconnect()}
                  disabled={isBusy}
                >
                  Disconnect
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button
              type="button"
              size="sm"
              onClick={() => setWalletModalOpen(true)}
              disabled={connectors.length === 0 || isBusy}
            >
              Connect Wallet
            </Button>
          )}

          <Dialog open={walletModalOpen} onOpenChange={setWalletModalOpen}>
            <DialogContent showCloseButton={!isBusy}>
              <DialogHeader>
                <DialogTitle>Select wallet</DialogTitle>
                <DialogDescription>
                  Choose a wallet connector to continue.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-2">
                {connectors.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No wallet connectors are available.
                  </p>
                ) : (
                  connectors.map((connector) => (
                    <Button
                      key={connector.id}
                      className="w-full justify-start"
                      disabled={isBusy}
                      onClick={() => {
                        void handleConnect(connector);
                      }}
                      type="button"
                      variant="outline"
                    >
                      {connectorLabel(connector)}
                    </Button>
                  ))
                )}
              </div>
            </DialogContent>
          </Dialog>

          {/* Mobile hamburger */}
          <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
            <SheetTrigger asChild>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="md:hidden px-2"
                aria-label="Open menu"
              >
                <Menu className="h-4 w-4" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-64">
              <SheetHeader>
                <SheetTitle className="text-left text-sm font-medium tracking-widest uppercase">
                  Realms.market
                </SheetTitle>
              </SheetHeader>
              <nav aria-label="Mobile navigation" className="mt-6 flex flex-col gap-1">
                {NAV_LINKS.map(({ label, href }) => (
                  <a
                    key={label}
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => setMobileMenuOpen(false)}
                    className="px-2 py-2.5 text-sm text-muted-foreground hover:text-foreground transition-colors rounded-sm hover:bg-muted"
                  >
                    {label}
                  </a>
                ))}
                {isConnected && address ? (
                  <>
                    <Link
                      href={`/profile/${address}`}
                      onClick={() => setMobileMenuOpen(false)}
                      className="px-2 py-2.5 text-sm text-muted-foreground hover:text-foreground transition-colors rounded-sm hover:bg-muted"
                    >
                      Profile
                    </Link>
                    <button
                      type="button"
                      onClick={() => { disconnect(); setMobileMenuOpen(false); }}
                      className="px-2 py-2.5 text-left text-sm text-muted-foreground hover:text-foreground transition-colors rounded-sm hover:bg-muted"
                    >
                      Disconnect
                    </button>
                  </>
                ) : null}
              </nav>
              <div className="mt-6 flex items-center gap-2 px-2">
                {SOCIAL_LINKS.map(({ label, href, Icon }) => (
                  <a
                    key={label}
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={label}
                    className="flex h-8 w-8 items-center justify-center rounded-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <Icon className="h-4 w-4" />
                  </a>
                ))}
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
