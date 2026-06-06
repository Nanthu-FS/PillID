/** @type {import('next').NextConfig} */
const nextConfig = {
  // Pill photos can be a few MB as base64 — allow larger server action / route bodies.
  experimental: {
    serverActions: {
      bodySizeLimit: '12mb',
    },
  },
};

export default nextConfig;
