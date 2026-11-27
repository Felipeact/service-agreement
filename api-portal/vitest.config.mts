import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    // The portal shares the web app's pure domain code (plan access, the tool catalogue, the API routes); nothing else crosses over.
    alias: [
      { find: /^@\/domain\/(.*)$/, replacement: path.resolve(import.meta.dirname, "../web/domain/$1") },
      { find: /^@\//, replacement: `${import.meta.dirname}/` },
    ],
  },
  test: { include: ["**/*.test.{ts,tsx}"], exclude: ["node_modules/**", ".next/**"], testTimeout: 60_000 },
});
