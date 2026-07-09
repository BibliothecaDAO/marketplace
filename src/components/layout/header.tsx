"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { type SVGProps, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAccount, useConnect, useDisconnect } from "@starknet-react/core";
import { Github, Menu, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
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

const CartSidebar = dynamic(
  () =>
    import("@/features/cart/components/cart-sidebar").then((m) => ({
      default: m.CartSidebar,
    })),
  { ssr: false },
);

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

const ECOSYSTEM_LINKS = [
  { label: "Home", href: "https://realms.world/", external: true },
  { label: "Games", href: "https://realms.world/games", external: true },
  { label: "Account", href: "https://account.realms.world/velords", external: true },
  { label: "Marketplace", href: "/", external: false },
  { label: "Scroll", href: "https://realms.world/scroll", external: true },
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

function topNavClass(isCurrent = false) {
  return [
    "realm-nav-link text-xs uppercase tracking-[0.15em] transition-colors",
    isCurrent
      ? "text-primary"
      : "text-foreground/75 hover:text-primary",
  ].join(" ");
}

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
    <header className="sticky top-0 z-50 w-full">
      <div className="realm-market-header-shell border-b border-[color:var(--realm-border-etched)] bg-black/45 backdrop-blur-xl supports-[backdrop-filter]:bg-black/35">
        <div className="mx-auto px-3 sm:px-4 lg:px-8">
          <div className="relative flex h-16 items-center justify-between gap-2 sm:gap-4">
            <a
              href="https://realms.world/"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-left"
              aria-label="Realms.World home"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/rw-logo.svg"
                alt="Realms.World"
                data-testid="realms-logo"
                className="w-11 object-contain sm:w-[3.25rem]"
              />
            </a>

            <nav
              aria-label="Primary ecosystem navigation"
              className="absolute left-1/2 hidden -translate-x-1/2 items-center justify-center gap-5 lg:flex xl:gap-7"
            >
              {ECOSYSTEM_LINKS.map((link) =>
                link.external ? (
                  <a
                    key={link.label}
                    href={link.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={topNavClass()}
                  >
                    {link.label}
                  </a>
                ) : (
                  <Link
                    key={link.label}
                    href={link.href}
                    className={topNavClass(true)}
                    aria-current="page"
                  >
                    {link.label}
                  </Link>
                ),
              )}
            </nav>

            <div className="flex items-center justify-end gap-2 sm:gap-3">
              <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
                <SheetTrigger asChild>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="rounded-[6px] border border-[color:var(--realm-border-etched)] bg-[color:var(--realm-surface-iron)]/70 px-2 text-[color:var(--realm-text-muted)] lg:hidden"
                    aria-label="Open navigation menu"
                  >
                    <Menu className="h-4 w-4" />
                  </Button>
                </SheetTrigger>
                <SheetContent
                  side="right"
                  className="w-72 border-[color:var(--realm-border-etched)] bg-[color:var(--realm-bg-void)]"
                >
                  <SheetHeader>
                    <SheetTitle className="realm-title text-left text-base">
                      REALMS.WORLD
                    </SheetTitle>
                  </SheetHeader>
                  <nav aria-label="Mobile navigation" className="mt-6 flex flex-col gap-1">
                    {ECOSYSTEM_LINKS.map((link) =>
                      link.external ? (
                        <a
                          key={link.label}
                          href={link.href}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={() => setMobileMenuOpen(false)}
                          className="rounded-[6px] border border-transparent px-2 py-2.5 text-sm uppercase tracking-[0.12em] text-muted-foreground transition-colors hover:border-[color:var(--realm-border-etched)] hover:bg-muted/70 hover:text-foreground"
                        >
                          {link.label}
                        </a>
                      ) : (
                        <Link
                          key={link.label}
                          href={link.href}
                          onClick={() => setMobileMenuOpen(false)}
                          className="rounded-[6px] border border-[color:var(--realm-border-etched)] px-2 py-2.5 text-sm uppercase tracking-[0.12em] text-primary transition-colors hover:bg-muted/70"
                          aria-current="page"
                        >
                          {link.label}
                        </Link>
                      ),
                    )}
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

              <div className="hidden items-center gap-1 lg:flex">
                {SOCIAL_LINKS.map(({ label, href, Icon }) => (
                  <a
                    key={label}
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-foreground/50 transition-colors hover:bg-primary/10 hover:text-primary"
                    aria-label={label}
                  >
                    <Icon className="h-3.5 w-3.5" />
                  </a>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="border-b border-[color:var(--realm-border-etched)] bg-[color:var(--realm-bg-void)]/95 backdrop-blur-xl">
        <div className="mx-auto flex min-h-14 items-center px-3 sm:px-4 lg:px-8">
          <div className="ml-auto flex w-full items-center justify-end gap-2 overflow-x-auto py-2 sm:gap-3">
            <form
              className="relative shrink-0"
              role="search"
              onSubmit={(event) => {
                event.preventDefault();
                handleSearchSubmit();
              }}
            >
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/70" />
              <Input
                aria-label="Search"
                placeholder="Search..."
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                className="h-9 w-[14rem] border-[color:var(--realm-border-etched)] bg-[color:var(--realm-surface-iron)]/80 pl-9 text-foreground placeholder:text-muted-foreground/70 sm:w-72 lg:w-96"
              />
            </form>

            <CartSidebar />

            <Button
              size="sm"
              variant="ghost"
              asChild
              className="h-9 rounded-[6px] border border-[color:var(--realm-border-etched)] bg-[color:var(--realm-surface-iron)]/70 px-3 text-[color:var(--realm-text-muted)] hover:border-[color:var(--realm-border-strong)]"
            >
              <Link href="/portfolio">Portfolio</Link>
            </Button>

            {isConnected && address ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    data-testid="wallet-address"
                    type="button"
                    className="inline-flex h-9 cursor-pointer items-center rounded-[6px] border border-[color:var(--realm-border-etched)] bg-[color:var(--realm-surface-iron)]/80 px-3 text-xs font-mono text-primary transition-colors hover:border-[color:var(--realm-border-strong)] hover:bg-muted"
                  >
                    {formatAddress(address)}
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  className="w-52 border-[color:var(--realm-border-etched)] bg-[color:var(--realm-surface-iron)]/95"
                >
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
                className="h-9 px-3"
                onClick={() => setWalletModalOpen(true)}
                disabled={connectors.length === 0 || isBusy}
              >
                Connect Wallet
              </Button>
            )}
          </div>
        </div>
      </div>

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
    </header>
  );
}
