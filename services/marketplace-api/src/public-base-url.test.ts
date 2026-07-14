import { describe, expect, it } from "vitest";
import { normalizePublicBaseUrl } from "./public-base-url.js";

describe("normalizePublicBaseUrl", () => {
  it.each([
    ["http://localhost:3001/", "http://localhost:3001"],
    ["http://127.0.0.1:3001/", "http://127.0.0.1:3001"],
    ["http://[::1]:3001/", "http://[::1]:3001"],
    ["https://market.example/", "https://market.example"],
  ])("accepts a secure or loopback URL %s", (input, expected) => {
    expect(normalizePublicBaseUrl(input)).toBe(expected);
  });

  it.each([
    "http://market.example",
    "ftp://market.example",
    "https://user:secret@market.example",
    "https://market.example/path",
    "not-a-url",
  ])("rejects an unsafe public base URL %s", (input) => {
    expect(() => normalizePublicBaseUrl(input)).toThrow(/MARKETPLACE_PUBLIC_BASE_URL/);
  });
});
