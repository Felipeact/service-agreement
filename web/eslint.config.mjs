import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// File-parsing libraries stay behind the ImportParser adapter (import-parse door 2).
const PARSER_LIBRARIES = {
  group: ["xlsx", "xlsx/*", "mammoth", "mammoth/*"],
  message: "Parse files only in infrastructure/import-parsers, behind the ImportParser port.",
};

// The Claude SDK stays behind the AssetExtractor adapter (import-extract door 5).
const CLAUDE_SDK = {
  group: ["@anthropic-ai/sdk", "@anthropic-ai/sdk/*"],
  message: "Call Claude only in infrastructure/claude, behind the AssetExtractor port.",
};

const ADAPTER_PATTERNS = [
  {
    group: [
      "react", "react/*", "react-dom", "react-dom/*", "@/app", "@/app/*",
      "@/components", "@/components/*", "@/composition", "@/composition/*",
    ],
    message: "Adapters must not import UI or the composition root.",
  },
];

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // The domain layer is pure: no framework, database or UI imports.
  {
    files: ["domain/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["next", "next/*", "react", "react/*", "react-dom", "react-dom/*", "@supabase/*"],
              message: "The domain layer must not depend on a framework or the database.",
            },
            {
              group: ["@/lib", "@/lib/*", "@/components", "@/components/*", "@/app", "@/app/*"],
              message: "The domain layer must not import UI or app code.",
            },
            PARSER_LIBRARIES,
            CLAUDE_SDK,
          ],
        },
      ],
    },
  },
  // Use cases depend on the domain and on ports only.
  {
    files: ["application/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["next", "next/*", "react", "react/*", "react-dom", "react-dom/*", "@supabase/*"],
              message: "The application layer must not depend on a framework or the database; add a port.",
            },
            {
              group: [
                "@/lib", "@/lib/*", "@/components", "@/components/*", "@/app", "@/app/*",
                "@/infrastructure", "@/infrastructure/*", "@/composition", "@/composition/*",
              ],
              message: "The application layer must not import UI, adapters or the composition root.",
            },
            PARSER_LIBRARIES,
            CLAUDE_SDK,
          ],
        },
      ],
    },
  },
  // Adapters implement ports; they never reach UI or the composition root. Only the parser adapter parses files.
  {
    files: ["infrastructure/**/*.ts"],
    ignores: ["infrastructure/import-parsers/**", "infrastructure/claude/**"],
    rules: { "no-restricted-imports": ["error", { patterns: [...ADAPTER_PATTERNS, PARSER_LIBRARIES, CLAUDE_SDK] }] },
  },
  {
    files: ["infrastructure/import-parsers/**/*.ts"],
    rules: { "no-restricted-imports": ["error", { patterns: [...ADAPTER_PATTERNS, CLAUDE_SDK] }] },
  },
  {
    files: ["infrastructure/claude/**/*.ts"],
    rules: { "no-restricted-imports": ["error", { patterns: [...ADAPTER_PATTERNS, PARSER_LIBRARIES] }] },
  },
  // UI reaches adapters only through @/composition, which is server-only.
  {
    files: ["app/**/*.{ts,tsx}", "components/**/*.{ts,tsx}", "lib/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/infrastructure", "@/infrastructure/*", "@supabase/*"],
              message: "UI code must not use adapters or the database client directly; use @/composition.",
            },
            PARSER_LIBRARIES,
            CLAUDE_SDK,
          ],
        },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
