import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Not part of the Next.js app: a separate Python service (with its
    // own .venv/ and gitignored .real-chrome-profile/ that can contain
    // arbitrary vendored JS) and a plain-JS browser extension.
    "crawler-service/**",
    "extension/**",
  ]),
]);

export default eslintConfig;
