import type { NextConfig } from "next";
import path from "path";
import { fileURLToPath } from "url";

const appDir = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  devIndicators: false,
  // Workspace root has its own package-lock.json; without this, Turbopack
  // resolves deps from the parent folder and tailwind/postcss fail at runtime.
  turbopack: {
    root: appDir,
  },
};

export default nextConfig;
