import type { NextConfig } from "next";
import path from "node:path";

const standaloneEnabled =
  process.env.MOVY_FRONTEND_STANDALONE === "true" ||
  (process.env.NODE_ENV === "production" && process.platform !== "win32");

const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: standaloneEnabled ? "standalone" : undefined,
  outputFileTracingRoot: path.join(__dirname, "..")
};

export default nextConfig;
