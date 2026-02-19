const DEFAULT_SITE_URL = "http://localhost:3000";

function normalizedBase(rawValue: string | undefined) {
  const value = rawValue?.trim();
  if (!value) {
    return new URL(DEFAULT_SITE_URL);
  }

  try {
    return new URL(value.endsWith("/") ? value : `${value}/`);
  } catch {
    return new URL(DEFAULT_SITE_URL);
  }
}

export function getSiteUrl() {
  return normalizedBase(process.env.NEXT_PUBLIC_SITE_URL);
}

export function toAbsoluteUrl(pathname: string) {
  const normalizedPath = pathname.startsWith("/") ? pathname : `/${pathname}`;
  return new URL(normalizedPath, getSiteUrl()).toString();
}
