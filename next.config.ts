import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // Ensure images work properly in production
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
};

export default nextConfig;
