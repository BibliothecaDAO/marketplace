import type { Metadata } from "next";
import { Suspense } from "react";
import { Geist, Geist_Mono } from "next/font/google";
import { Header } from "@/components/layout/header";
import { SidebarLayout } from "@/components/layout/sidebar-layout";
import { MarketplaceProvider } from "@/components/providers/marketplace-provider";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Realms.market",
  description: "The Realms ecosystem marketplace",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
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
