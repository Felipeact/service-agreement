import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@": import.meta.dirname },
  },
  test: {
    include: ["**/*.test.ts"],
    exclude: ["node_modules/**", ".next/**"],
    // Tests that import the composition root or run ESLint take over 5 s when the whole suite runs at once on a
    // slow machine; the default timeout failed them although each passes alone.
    testTimeout: 60_000,
  },
});
