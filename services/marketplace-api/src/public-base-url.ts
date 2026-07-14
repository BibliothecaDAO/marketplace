const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

export function normalizePublicBaseUrl(rawValue: string): string {
  let parsed: URL;
  try {
    parsed = new URL(rawValue.trim());
  } catch {
    throw new Error("MARKETPLACE_PUBLIC_BASE_URL must be an absolute public base URL.");
  }

  if (
    parsed.protocol !== "https:" &&
    !(parsed.protocol === "http:" && LOOPBACK_HOSTS.has(parsed.hostname))
  ) {
    throw new Error("MARKETPLACE_PUBLIC_BASE_URL must use HTTPS outside loopback.");
  }
  if (parsed.username || parsed.password || parsed.pathname !== "/" || parsed.search || parsed.hash) {
    throw new Error(
      "MARKETPLACE_PUBLIC_BASE_URL must contain only scheme, host, and optional port.",
    );
  }
  return parsed.origin;
}
