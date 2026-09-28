import type { NextConfig } from "next";
import { execSync } from "child_process";

/* One build stamp for every bundle: the deploy script exports
   NEXT_PUBLIC_PT_BUILD; failing that the git commit is stable across the
   build's worker processes. */
const build = process.env.NEXT_PUBLIC_PT_BUILD || (() => {
  try {
    const sha = execSync("git rev-parse --short=10 HEAD", { stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
    return `${new Date().toISOString().slice(0, 10)}.${sha}`;
  } catch { return "dev"; }
})();

const nextConfig: NextConfig = {
  reactStrictMode: true,
  env: { NEXT_PUBLIC_PT_BUILD: build },
  /* the deploy script builds into a side directory and swaps it in */
  distDir: process.env.NEXT_DIST_DIR || ".next",
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: [{ protocol: "https", hostname: "**" }],
  },
  serverExternalPackages: ["pg", "@prisma/adapter-pg"],
  async headers() {
    const security = [
      { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "X-Frame-Options", value: "SAMEORIGIN" },
      { key: "Content-Security-Policy", value: "frame-ancestors 'self'" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "Permissions-Policy", value: "geolocation=(), microphone=(), camera=()" },
    ];
    return [
      { source: "/(.*)", headers: security },
      { source: "/uploads/:path*", headers: [{ key: "Cache-Control", value: "public, max-age=604800" }] },
    ];
  },
};

export default nextConfig;
