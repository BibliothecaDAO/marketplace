"use client";

import Link from "next/link";

export function Header() {
  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background">
      <div className="flex h-14 items-center px-4">
        <Link href="/" className="flex items-center gap-2">
          <div
            data-testid="logo-placeholder"
            className="h-8 w-8 rounded bg-muted"
          />
          <span className="text-lg font-semibold">Biblio</span>
        </Link>
      </div>
    </header>
  );
}
