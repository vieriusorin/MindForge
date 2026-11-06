import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pack and path files are read at runtime: ship them with the server output.
  outputFileTracingIncludes: { "/": ["./packs/**/*", "./paths/**/*"] },
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
