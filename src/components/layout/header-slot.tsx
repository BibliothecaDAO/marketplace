"use client";

import dynamic from "next/dynamic";

const HeaderShell = dynamic(
  () =>
    import("@/components/layout/header-shell").then((module) => ({
      default: module.HeaderShell,
    })),
  { ssr: false },
);

export function HeaderSlot() {
  return <HeaderShell />;
}
