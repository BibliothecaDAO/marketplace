import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";
import { makeQueryClient } from "@/lib/marketplace/query-client";

describe("makeQueryClient", () => {
  it("returns_a_QueryClient_instance", () => {
    const client = makeQueryClient();
    expect(client).toBeInstanceOf(QueryClient);
  });

  it("has_correct_default_options", () => {
    const client = makeQueryClient();
    const queries = client.getDefaultOptions().queries;
    expect(queries?.staleTime).toBe(60_000);
    expect(queries?.gcTime).toBe(300_000);
    expect(queries?.refetchOnWindowFocus).toBe(false);
    expect(queries?.retry).toBe(1);
  });
});
