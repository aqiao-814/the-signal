import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "pbs.twimg.com" },
      { protocol: "https", hostname: "abs.twimg.com" },
      { protocol: "https", hostname: "unavatar.io" },
      { protocol: "https", hostname: "api.dicebear.com" },
    ],
  },
  experimental: {
    // PGlite / better-auth pull in optional native-ish deps that Next tries to
    // bundle for server components; keep them external to the server runtime.
    serverActions: {
      bodySizeLimit: "2mb",
    },
  },
  serverExternalPackages: ["@electric-sql/pglite", "@prisma/client"],
};

export default nextConfig;
