import { ImageResponse } from "next/og";

export const size = {
  width: 1200,
  height: 630,
};

export const contentType = "image/png";

// Cache OG images at the edge for 5 minutes; revalidate in background for 15 minutes.
// Matches the collection SEO data cache TTL in seo-data.ts.
export const revalidate = 300;

export default async function Image({
  params,
}: {
  params: Promise<{ address: string }>;
}) {
  const { address } = await params;
  const title = `Collection ${address}`;

  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#09090b",
          color: "#fafafa",
          padding: "56px",
          fontFamily: "ui-sans-serif, system-ui, sans-serif",
        }}
      >
        <div
          style={{
            fontSize: 28,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: "#a1a1aa",
          }}
        >
          Realms.market
        </div>

        <div
          style={{
            fontSize: 72,
            fontWeight: 700,
            lineHeight: 1.1,
            maxWidth: "88%",
          }}
        >
          {title}
        </div>

        <div
          style={{
            fontSize: 30,
            color: "#d4d4d8",
          }}
        >
          Collection
        </div>
      </div>
    ),
    {
      ...size,
    },
  );
}
