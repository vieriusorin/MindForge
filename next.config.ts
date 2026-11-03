import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pack files are read at runtime: ship them with the server output.
  outputFileTracingIncludes: { "/": ["./packs/**/*"] },
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
