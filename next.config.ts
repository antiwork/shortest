import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // ppr: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "img.clerk.com",
        port: "",
      },
    ],
  },
  transpilePackages: ["@clerk/nextjs"],
};

export default nextConfig;
