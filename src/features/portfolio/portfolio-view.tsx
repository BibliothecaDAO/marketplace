"use client";

import { FormEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { WalletProfileView } from "@/features/profile/wallet-profile-view";

type PortfolioViewProps = {
  initialAddress?: string;
};

function isValidAddress(value: string) {
  return /^0x[0-9a-fA-F]+$/.test(value);
}

export function PortfolioView({ initialAddress = "" }: PortfolioViewProps) {
  const [addressInput, setAddressInput] = useState(initialAddress);
  const [activeAddress, setActiveAddress] = useState(initialAddress);
  const [errorMessage, setErrorMessage] = useState("");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalized = addressInput.trim();
    if (!isValidAddress(normalized)) {
      setErrorMessage("Enter a valid wallet address.");
      return;
    }

    setErrorMessage("");
    setActiveAddress(normalized);
  }

  return (
    <main
      className="mx-auto flex min-h-[calc(100vh-3.5rem)] w-full max-w-4xl flex-col gap-4 px-4 py-6 sm:px-6 lg:px-8"
      data-testid="portfolio-view"
    >
      <h1 className="text-2xl font-semibold tracking-tight">Portfolio</h1>
      <p className="text-sm text-muted-foreground">
        Load any wallet address to inspect holdings.
      </p>

      <form className="flex flex-col gap-2 sm:flex-row sm:items-end" onSubmit={handleSubmit}>
        <div className="w-full">
          <label
            className="mb-1 block text-xs font-medium text-muted-foreground"
            htmlFor="portfolio-address-input"
          >
            Wallet address
          </label>
          <Input
            aria-label="Wallet address"
            id="portfolio-address-input"
            onChange={(event) => setAddressInput(event.target.value)}
            placeholder="0x..."
            value={addressInput}
          />
        </div>
        <Button className="sm:w-auto" type="submit">
          Load holdings
        </Button>
      </form>

      {errorMessage ? (
        <p className="text-sm text-destructive">{errorMessage}</p>
      ) : null}

      {activeAddress ? (
        <WalletProfileView
          address={activeAddress}
          addressLabel="Selected wallet address:"
          title="Portfolio holdings"
        />
      ) : null}
    </main>
  );
}
