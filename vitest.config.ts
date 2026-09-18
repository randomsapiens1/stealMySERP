import { fileURLToPath } from "node:url";
import { loadEnv } from "vite";
import { defineConfig } from "vitest/config";

export default defineConfig(({ mode }) => ({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL(".", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    // Vitest doesn't auto-load .env.local the way `next dev` does — pull it
    // in so tests that hit Neon (history.test.ts) can see DATABASE_URL.
    env: loadEnv(mode, process.cwd(), ""),
  },
}));
