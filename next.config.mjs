const readRollout = (
  process.env.MARKETPLACE_READ_ROLLOUT ??
  process.env.NEXT_PUBLIC_MARKETPLACE_READ_ROLLOUT ??
  "off"
).trim().toLowerCase();
const rolloutValues = new Set(["off", "browse", "portfolio", "orders", "checkout"]);
if (!rolloutValues.has(readRollout)) {
  throw new Error(
    `MARKETPLACE_READ_ROLLOUT must be off|browse|portfolio|orders|checkout; received ${JSON.stringify(readRollout)}.`,
  );
}
if (readRollout !== "off" && !process.env.NEXT_PUBLIC_MARKETPLACE_API_BASE_URL) {
  throw new Error(
    "NEXT_PUBLIC_MARKETPLACE_API_BASE_URL is required when owned marketplace reads are enabled.",
  );
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  allowedDevOrigins: ["127.0.0.1"],
  env: {
    NEXT_PUBLIC_MARKETPLACE_READ_ROLLOUT: readRollout,
  },
};

export default nextConfig;
