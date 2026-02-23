"use client";

import { useState } from "react";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { CollectionSidebar } from "@/features/home/collection-sidebar";
import type { SidebarCollection } from "@/features/home/types";

type MobileSidebarSheetProps = {
  collections: SidebarCollection[];
  activeAddress?: string;
  onSelect: (address: string) => void;
};

export function MobileSidebarSheet({
  collections,
  activeAddress,
  onSelect,
}: MobileSidebarSheetProps) {
  const [open, setOpen] = useState(false);

  function handleSelect(address: string) {
    onSelect(address);
    setOpen(false);
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="lg:hidden"
          aria-label="Browse collections"
        >
          <Menu className="h-4 w-4" />
          Collections
        </Button>
      </SheetTrigger>
      <SheetContent
        data-testid="mobile-sidebar-sheet-content"
        side="left"
        className="w-72 p-0"
      >
        <SheetHeader className="border-b border-border/70">
          <SheetTitle>Collections</SheetTitle>
        </SheetHeader>
        <CollectionSidebar
          collections={collections}
          activeAddress={activeAddress}
          onSelect={handleSelect}
        />
      </SheetContent>
    </Sheet>
  );
}
