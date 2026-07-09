import type { Metadata } from "next";
import { Suspense } from "react";
import { Exo_2, Geist_Mono } from "next/font/google";
import { Header } from "@/components/layout/header";
import { SidebarLayout } from "@/components/layout/sidebar-layout";
import { MarketplaceProvider } from "@/components/providers/marketplace-provider";
import "./globals.css";

const exo2 = Exo_2({
  variable: "--font-exo-2",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Realms.market",
  description: "The Realms ecosystem marketplace",
  icons: {
    icon: "/rw-logo.svg",
    shortcut: "/rw-logo.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body
        className={`${exo2.variable} ${geistMono.variable} antialiased`}
      >
        <MarketplaceProvider>
          <Suspense fallback={null}>
            <Header />
          </Suspense>
          <SidebarLayout>{children}</SidebarLayout>
        </MarketplaceProvider>
      </body>
    </html>
  );
}
