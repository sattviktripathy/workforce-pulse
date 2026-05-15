import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // lib/data.ts reads /data/*.csv|.json via process.cwd() at request time.
  // @vercel/nft can't resolve that dynamic path during build, so the serverless
  // bundle for /api/chat would ship without the data files. Force-include them.
  outputFileTracingIncludes: {
    "/api/chat": ["./data/**/*"],
  },
};

export default nextConfig;
