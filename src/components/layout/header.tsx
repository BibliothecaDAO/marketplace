"use client";

import Link from "next/link";
import { type SVGProps, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAccount, useConnect, useDisconnect } from "@starknet-react/core";
import { ChevronDown, Github, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import dynamic from "next/dynamic";

const CartSidebar = dynamic(
  () =>
    import("@/features/cart/components/cart-sidebar").then((m) => ({
      default: m.CartSidebar,
    })),
  { ssr: false },
);
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { WalletBalances } from "@/components/layout/wallet-balances";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";

function formatAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function connectorLabel(connector: { id: string; name?: string }) {
  if (connector.name && connector.name.trim().length > 0) {
    return connector.name;
  }

  return connector.id;
}

function connectorIconUrl(connector: { icon?: unknown }) {
  return typeof connector.icon === "string" && connector.icon.trim().length > 0
    ? connector.icon
    : null;
}

const NAV_LINKS = [
  { label: "Account", href: "https://account.realms.world/velords" },
  { label: "Realms.World", href: "https://realms.world" },
  { label: "Games", href: "https://realms.world/games" },
  { label: "Blitz", href: "https://blitz.realms.world" },
] as const;

function XIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      data-testid="x-icon"
      {...props}
    >
      <path d="M18.244 2H21l-6.59 7.53L22.16 22h-6.07l-4.75-6.2L5.91 22H3.15l7.04-8.05L1.84 2h6.21l4.3 5.7L18.244 2Zm-1.07 18h1.53L7.02 3.9H5.38L17.174 20Z" />
    </svg>
  );
}

function DiscordIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      data-testid="discord-icon"
      {...props}
    >
      <path d="M20.317 4.369A19.791 19.791 0 0 0 15.419 3a13.255 13.255 0 0 0-.627 1.288 18.27 18.27 0 0 0-5.584 0A12.548 12.548 0 0 0 8.58 3a19.736 19.736 0 0 0-4.9 1.37C.533 9.032-.32 13.579.107 18.063A19.94 19.94 0 0 0 6.13 21a14.63 14.63 0 0 0 1.29-2.112 12.89 12.89 0 0 1-2.033-.976c.171-.126.338-.257.5-.392 3.922 1.841 8.177 1.841 12.053 0 .165.136.333.267.504.392a12.78 12.78 0 0 1-2.037.978A14.4 14.4 0 0 0 17.701 21a19.902 19.902 0 0 0 6.026-2.937c.5-5.196-.853-9.702-3.41-13.694ZM8.678 15.33c-1.18 0-2.15-1.085-2.15-2.419 0-1.334.95-2.419 2.15-2.419 1.21 0 2.17 1.095 2.15 2.419 0 1.334-.95 2.419-2.15 2.419Zm6.644 0c-1.18 0-2.15-1.085-2.15-2.419 0-1.334.95-2.419 2.15-2.419 1.21 0 2.17 1.095 2.15 2.419 0 1.334-.94 2.419-2.15 2.419Z" />
    </svg>
  );
}

const SOCIAL_LINKS = [
  { label: "X / Twitter", href: "https://x.com/LootRealms", Icon: XIcon },
  { label: "Discord", href: "https://discord.gg/realmsworld", Icon: DiscordIcon },
  { label: "GitHub", href: "https://github.com/BibliothecaDAO", Icon: Github },
] as const;

export function Header() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { address, isConnected } = useAccount();
  const { connect, connectors, isPending: isConnecting } = useConnect();
  const { disconnect, isPending: isDisconnecting } = useDisconnect();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [walletModalOpen, setWalletModalOpen] = useState(false);
  const [searchInput, setSearchInput] = useState(() => searchParams.get("q") ?? "");

  const isBusy = isConnecting || isDisconnecting;

  const handleConnect = async (connector: (typeof connectors)[number]) => {
    try {
      await connect({ connector });
      setWalletModalOpen(false);
    } catch (error) {
      console.error("Failed to connect wallet", error);
    }
  };

  const handleSearchSubmit = () => {
    const normalized = searchInput.trim().replace(/\s+/g, " ");
    if (normalized.length === 0) {
      router.push("/");
      return;
    }

    router.push(`/?q=${encodeURIComponent(normalized)}`);
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b border-[color:var(--realm-border-etched)] bg-[color:var(--realm-bg-void)]/95 backdrop-blur-md">
      <div className="flex h-16 items-center gap-3 px-4 sm:px-6 lg:px-8">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 shrink-0" aria-label="Realms.market home">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/realms-mark.svg"
            alt=""
            aria-hidden="true"
            data-testid="realms-logo"
            className="h-7 w-7 object-contain"
          />
          <span className="realm-title text-base text-[color:var(--realm-title)]">REALMS.MARKET</span>
        </Link>

        {/* Desktop nav */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="hidden rounded-[6px] border border-[color:var(--realm-border-etched)] bg-[color:var(--realm-surface-iron)]/70 text-[color:var(--realm-text-muted)] md:inline-flex">
              Ecosystem
              <ChevronDown className="ml-1 h-3 w-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="border-[color:var(--realm-border-etched)] bg-[color:var(--realm-surface-iron)]/95">
            {NAV_LINKS.map(({ label, href }) => (
              <DropdownMenuItem key={label} asChild>
                <a href={href} target="_blank" rel="noopener noreferrer">
                  {label}
                </a>
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            {SOCIAL_LINKS.map(({ label, href, Icon }) => (
              <DropdownMenuItem key={label} asChild>
                <a href={href} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2">
                  <Icon className="h-3.5 w-3.5" />
                  {label}
                </a>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <div className="hidden md:block lg:min-w-96">
          <Input
            aria-label="Search"
            placeholder="Search..."
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                handleSearchSubmit();
              }
            }}
            className="w-72 border-[color:var(--realm-border-etched)] bg-[color:var(--realm-surface-iron)]/80 text-foreground placeholder:text-muted-foreground/70 lg:w-96"
          />
        </div>

        {/* Right side actions */}
        <div className="ml-auto flex items-center gap-1 sm:gap-2">
          <CartSidebar />
          <Button size="sm" variant="ghost" asChild className="hidden rounded-[6px] border border-[color:var(--realm-border-etched)] bg-[color:var(--realm-surface-iron)]/70 text-[color:var(--realm-text-muted)] sm:inline-flex">
            <Link href="/portfolio">Portfolio</Link>
          </Button>

          {isConnected && address ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  data-testid="wallet-address"
                  type="button"
                  className="hidden rounded-[6px] border border-[color:var(--realm-border-etched)] bg-[color:var(--realm-surface-iron)]/80 px-2 py-1 text-xs font-mono text-primary transition-colors hover:border-[color:var(--realm-border-strong)] hover:bg-muted sm:inline-flex cursor-pointer"
                >
                  {formatAddress(address)}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52 border-[color:var(--realm-border-etched)] bg-[color:var(--realm-surface-iron)]/95">
                <WalletBalances walletAddress={address} />
                <DropdownMenuSeparator />
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
              className="hidden sm:inline-flex"
              onClick={() => setWalletModalOpen(true)}
              disabled={connectors.length === 0 || isBusy}
            >
              Connect Wallet
            </Button>
          )}

          <Dialog open={walletModalOpen} onOpenChange={setWalletModalOpen}>
            <DialogContent showCloseButton={!isBusy}>
              <DialogHeader>
                <DialogTitle className="realm-title text-xl">SELECT WALLET</DialogTitle>
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
                      className="w-full justify-start gap-2"
                      disabled={isBusy}
                      onClick={() => {
                        void handleConnect(connector);
                      }}
                      type="button"
                      variant="outline"
                    >
                      {connectorIconUrl(connector) ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={connectorIconUrl(connector)!}
                          alt={`${connectorLabel(connector)} icon`}
                          className="h-5 w-5"
                        />
                      ) : null}
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
                className="px-2 md:hidden"
                aria-label="Open menu"
              >
                <Menu className="h-4 w-4" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-64 border-[color:var(--realm-border-etched)] bg-[color:var(--realm-bg-void)]">
              <SheetHeader>
                <SheetTitle className="realm-title text-left text-base">
                  REALMS.MARKET
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
                    className="rounded-[6px] border border-transparent px-2 py-2.5 text-sm text-muted-foreground transition-colors hover:border-[color:var(--realm-border-etched)] hover:bg-muted/70 hover:text-foreground"
                  >
                    {label}
                  </a>
                ))}
                <Link
                  href="/portfolio"
                  onClick={() => setMobileMenuOpen(false)}
                  className="rounded-[6px] border border-transparent px-2 py-2.5 text-sm text-muted-foreground transition-colors hover:border-[color:var(--realm-border-etched)] hover:bg-muted/70 hover:text-foreground"
                >
                  Portfolio
                </Link>
                {!isConnected ? (
                  <button
                    type="button"
                    onClick={() => {
                      setWalletModalOpen(true);
                      setMobileMenuOpen(false);
                    }}
                    className="rounded-[6px] border border-transparent px-2 py-2.5 text-left text-sm text-muted-foreground transition-colors hover:border-[color:var(--realm-border-etched)] hover:bg-muted/70 hover:text-foreground"
                  >
                    Connect Wallet
                  </button>
                ) : null}
                {isConnected && address ? (
                  <>
                    <Link
                      href={`/profile/${address}`}
                      onClick={() => setMobileMenuOpen(false)}
                      className="rounded-[6px] border border-transparent px-2 py-2.5 text-sm text-muted-foreground transition-colors hover:border-[color:var(--realm-border-etched)] hover:bg-muted/70 hover:text-foreground"
                    >
                      Profile
                    </Link>
                    <button
                      type="button"
                      onClick={() => { disconnect(); setMobileMenuOpen(false); }}
                      className="rounded-[6px] border border-transparent px-2 py-2.5 text-left text-sm text-muted-foreground transition-colors hover:border-[color:var(--realm-border-etched)] hover:bg-muted/70 hover:text-foreground"
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
                    className="flex h-8 w-8 items-center justify-center rounded-[6px] border border-[color:var(--realm-border-etched)] text-muted-foreground transition-colors hover:border-[color:var(--realm-border-strong)] hover:text-foreground"
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
