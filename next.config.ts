import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Keeps prefetched App Router payloads warm longer so sidebar navigations feel instant.
    staleTimes: {
      dynamic: 60,
      static: 300,
    },
  },
};

export default nextConfig;
